// app/components/ChatDock.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { MLCEngine } from '@mlc-ai/web-llm';
import type { DataFacts } from './ChatDockServer';

// WebLLM-openai compatible shapes
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatRequest = { messages: ChatMessage[]; temperature?: number; max_tokens?: number };
type ChatCompletionResult = { choices?: Array<{ message?: { content?: string } }> };

// Local UI message
type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

type NavigatorWithGPU = Navigator & { gpu?: unknown };

const ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_WEBLLM === '1' ||
    process.env.ENABLE_WEBLLM === '1';

// ---------- smarter fallback text ----------
function basicAnswer(q: string, facts: DataFacts): string {
    const t = q.toLowerCase();
    const pct = (n?: number) => (n == null ? 'n/a' : `${n.toFixed(Math.abs(n) < 1 ? 2 : 1)}%`);
    const bps = (n?: number) => (n == null ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)} bps`);
    const d4 = (n?: number) => (n == null ? 'n/a' : n.toFixed(4));
    const lvl = (n?: number) => (n == null ? 'n/a' : `${n}`);

    const lines: string[] = [];
    const pushNumbers = () => {
        lines.push(
            `3) Numbers: CPI ${pct(facts.cpi.yoy)} (${facts.cpi.date}); ` +
            `Unemp ${facts.unemployment.level?.toFixed?.(1) ?? 'n/a'}% (${facts.unemployment.date}, m/m ${facts.unemployment.mom_pp ?? 0}pp); ` +
            `10y ${facts.y10.level?.toFixed?.(2) ?? 'n/a'}% (${facts.y10.date}, ~1m ${bps(facts.y10.d1m_bps)}); ` +
            `S&P ${lvl(facts.spx.level)} (${facts.spx.date}, ~1m ${pct(facts.spx.d1m_pct)}); ` +
            `EUR/USD ${d4(facts.eurusd.level)} (${facts.eurusd.date}, d/d ${facts.eurusd.d1d != null ? (facts.eurusd.d1d > 0 ? '+' : '') + facts.eurusd.d1d.toFixed(4) : 'n/a'}).`
        );
    };

    if (/\bcpi\b|inflation|prices? index|cost of living/.test(t)) {
        lines.push(
            `1) Takeaway: CPI year‑over‑year is ${pct(facts.cpi.yoy)} (${facts.cpi.date}). ` +
            `That means prices are ${facts.cpi.yoy && facts.cpi.yoy > 0 ? 'still rising vs. a year ago' : 'roughly flat vs. a year ago'}.`
        );
        lines.push(
            `2) What it generally means: Softer inflation can ease pressure on interest rates over time (supports bonds); sticky or re‑accelerating inflation can do the opposite.`
        );
        pushNumbers();
        return lines.join('\n');
    }

    if (/unemploy|labor|labour|jobs?\b|jobless|employment rate/.test(t)) {
        lines.push(
            `1) Takeaway: Unemployment is ${facts.unemployment.level?.toFixed?.(1) ?? 'n/a'}% (${facts.unemployment.date}), ` +
            `${facts.unemployment.mom_pp != null ? (facts.unemployment.mom_pp === 0 ? 'unchanged' : (facts.unemployment.mom_pp > 0 ? 'up' : 'down') + ` ${Math.abs(facts.unemployment.mom_pp).toFixed(1)}pp m/m`) : 'm/m change n/a'}.`
        );
        lines.push(
            `2) What it generally means: A stable labor market can support spending and equities; a sharp weakening tends to weigh on risk appetite and can support bonds as yields fall.`
        );
        pushNumbers();
        return lines.join('\n');
    }

    if (/bond|yield|rates?|treasury|10[\s-]?year|10y/.test(t)) {
        lines.push(`1) Takeaway: The 10‑year yield is ${facts.y10.level?.toFixed?.(2) ?? 'n/a'}% (${facts.y10.date}), ~1m change ${bps(facts.y10.d1m_bps)}.`);
        lines.push(`2) What it generally means: Falling yields support existing bond prices; rising yields pressure them. Yields also reflect the market’s view on inflation and growth.`);
        pushNumbers();
        return lines.join('\n');
    }

    if (/equit|stock|spx|s&p|s & p|s and p|index/.test(t)) {
        lines.push(`1) Takeaway: The S&P 500 is ${lvl(facts.spx.level)} (${facts.spx.date}), ~1m ${pct(facts.spx.d1m_pct)}.`);
        lines.push(`2) What it generally means: Gains usually reflect firmer risk appetite and earnings confidence; declines suggest caution about growth, rates, or profits.`);
        pushNumbers();
        return lines.join('\n');
    }

    if (/fx\b|foreign|currency|eur\/?usd|euro|usd\b|dollar|payments?/.test(t)) {
        lines.push(`1) Takeaway: EUR/USD is ${d4(facts.eurusd.level)} (${facts.eurusd.date}), d/d ${facts.eurusd.d1d != null ? (facts.eurusd.d1d > 0 ? '+' : '') + facts.eurusd.d1d.toFixed(4) : 'n/a'}.`);
        lines.push(`2) What it generally means: A rising EUR/USD implies a somewhat weaker USD (and vice‑versa), which can nudge cross‑border pricing and payment decisions.`);
        pushNumbers();
        return lines.join('\n');
    }

    lines.push(
        `1) Takeaway: Inflation (CPI) is ${pct(facts.cpi.yoy)}; unemployment is ${facts.unemployment.level?.toFixed?.(1) ?? 'n/a'}%; ` +
        `10‑year yields are ${facts.y10.level?.toFixed?.(2) ?? 'n/a'}%; the S&P 500 is ${lvl(facts.spx.level)}; and EUR/USD is ${d4(facts.eurusd.level)}.`
    );
    lines.push(
        `2) What it generally means: Softer inflation and lower yields can support bonds; firmer equities signal risk appetite; EUR/USD moves hint at USD strength/weakness for payments.`
    );
    pushNumbers();
    return lines.join('\n');
}

// ---------------------------------------------------------------

export default function ChatDock({
    systemPrompt,
    dataContext,
    dataFacts,
}: {
    systemPrompt: string;
    dataContext: string;
    dataFacts: DataFacts;
}) {
    const [open, setOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'idle' | 'basic' | 'webllm' | 'webllm-error'>('idle'); // <— instrumentation
    const [messages, setMessages] = useState<Msg[]>([
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: 'Hi! Ask me about CPI, unemployment, 10‑year yields, S&P 500, or EUR/USD.' },
    ]);

    const engineRef = useRef<MLCEngine | null>(null);

    // Lazy-load WebLLM when opened
    useEffect(() => {
        let canceled = false;
        async function init() {
            if (!open || engineRef.current || !ENABLED) return;

            const hasWebGPU = typeof (navigator as NavigatorWithGPU).gpu !== 'undefined';
            if (!hasWebGPU) {
                setErr('This browser/device does not support WebGPU; falling back to basic answers.');
                setReady(true);
                setMode('basic');
                console.log('[ChatDock] No WebGPU → BASIC mode');
                return;
            }
            try {
                const webllm = await import('@mlc-ai/web-llm');

                // Try a very small, instruction-following model (often better behavior)
                // You can swap back to 'Llama-3.2-1B-Instruct-q4f32_1-MLC' if you prefer.
                const modelId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';

                console.log('[ChatDock] Loading model:', modelId);
                const engine = await webllm.CreateMLCEngine(modelId, {
                    initProgressCallback: (p: { progress: number }) => {
                        if (p?.progress != null) {
                            // Uncomment if you want to see % in console:
                            // console.log(`[ChatDock] load progress: ${Math.round(p.progress * 100)}%`);
                        }
                    },
                });

                if (canceled) return;
                engineRef.current = engine;
                setReady(true);
                setMode('webllm');
                console.log('[ChatDock] WebLLM ready');
            } catch (e) {
                console.error('[ChatDock] WebLLM init error:', e);
                setErr('Failed to load on-device model; using basic answers.');
                setReady(true);
                setMode('webllm-error');
            }
        }
        init();
        return () => { canceled = true; };
    }, [open]);

    async function handleSend() {
        if (!input.trim()) return;

        const userMsg: Msg = { role: 'user', content: input.trim() };
        setMessages(m => [...m, userMsg]);
        setInput('');

        setBusy(true);
        try {
            const engine = engineRef.current;

            // Fallback path
            if (!ENABLED || !ready || !engine) {
                const text = basicAnswer(userMsg.content, dataFacts);
                setMessages(m => [...m, { role: 'assistant', content: text }]);
                setMode('basic');
                console.log('[ChatDock] ANSWER PATH → BASIC');
                return;
            }



            // inside handleSend(), before building `full`
            const systemAll = `${systemPrompt}\n\nContext:\n${dataContext}`;

            // Build the message array with a single system message:
            const full: ChatMessage[] = [
                { role: 'system', content: systemAll },
                ...messages
                    .filter(m => m.role !== 'system') // keep only user/assistant history
                    .map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: userMsg.content },
            ];

            const req: ChatRequest = { messages: full, temperature: 0.3, max_tokens: 320 };
            console.log('[ChatDock] Calling WebLLM…', req);
            const result = (await engine.chat.completions.create(req)) as ChatCompletionResult;
            const content = result?.choices?.[0]?.message?.content?.trim() ?? '…';
            setMessages(m => [...m, { role: 'assistant', content }]);
            setMode('webllm');
            console.log('[ChatDock] ANSWER PATH → WEBLLM', result);
        } catch (e) {
            console.error('[ChatDock] WebLLM call error:', e);
            const text = basicAnswer(userMsg.content, dataFacts);
            setMessages(m => [...m, { role: 'assistant', content: text }]);
            setMode('webllm-error');
            console.log('[ChatDock] ANSWER PATH → WEBLLM-ERROR (fell back to BASIC)');
        } finally {
            setBusy(false);
        }
    }

    const modeBadge =
        mode === 'webllm' ? 'WebLLM'
            : mode === 'basic' ? 'Basic'
                : mode === 'webllm-error' ? 'WebLLM error'
                    : (ENABLED ? 'Loading…' : 'Disabled');

    return (
        <>
            <button
                onClick={() => setOpen(v => !v)}
                className="fixed bottom-4 right-4 rounded-full px-4 py-2 shadow-lg bg-zinc-900 text-white border border-zinc-700"
            >
                {open ? 'Close chat' : 'Chat about the data'}
            </button>

            {open && (
                <div className="fixed bottom-20 right-4 w-[min(420px,90vw)] h-[min(520px,70vh)] rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-xl flex flex-col overflow-hidden">
                    <div className="px-3 py-2 text-sm border-b border-zinc-800 flex items-center justify-between">
                        <span>MacroLens Chat</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300">
                            {modeBadge}{busy ? ' • thinking…' : ''}
                        </span>
                    </div>

                    <div className="flex-1 overflow-auto p-3 space-y-3">
                        {messages.filter(m => m.role !== 'system').map((m, i) => (
                            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                                <div className={'inline-block rounded-xl px-3 py-2 text-sm ' + (m.role === 'user' ? 'bg-zinc-800' : 'bg-zinc-100 text-zinc-900')}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 border-t border-zinc-800 flex gap-2">
                        <input
                            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none"
                            placeholder="Ask about CPI, unemployment, yields, SPX, EUR/USD…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                            disabled={busy}
                        />
                        <button
                            onClick={handleSend}
                            disabled={busy || !input.trim()}
                            className="rounded-lg px-3 py-2 text-sm bg-white text-zinc-900 disabled:opacity-50"
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
