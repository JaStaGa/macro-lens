// app/components/ChatDock.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

const ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_WEBLLM === '1' ||
    process.env.ENABLE_WEBLLM === '1';

export default function ChatDock({
    systemPrompt,
    dataContext,
}: { systemPrompt: string; dataContext: string }) {
    const [open, setOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Msg[]>([
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: 'Hi! Ask me about the latest CPI, unemployment, 10‑year yields, S&P 500, or EUR/USD.' },
        { role: 'assistant', content: dataContext },
    ]);

    const engineRef = useRef<any>(null);

    useEffect(() => {
        let canceled = false;
        async function init() {
            if (!open || engineRef.current || !ENABLED) return;

            if (!(navigator as any).gpu) {
                setErr('This browser/device does not support WebGPU; falling back to basic answers.');
                setReady(true);
                return;
            }

            try {
                // ✅ correct module name
                const webllm = await import('@mlc-ai/web-llm');

                // Small model that loads reasonably fast on WebGPU
                const modelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

                // API per docs: CreateMLCEngine(modelId, options)
                const engine = await webllm.CreateMLCEngine(modelId, {
                    initProgressCallback: ({ progress }: { progress: number }) => {
                        // optional: you could surface a tiny “loading … {progress}%”
                        // console.log('WebLLM load:', Math.round(progress * 100), '%');
                    },
                });

                if (canceled) return;
                engineRef.current = engine;
                setReady(true);
            } catch (e) {
                console.error(e);
                setErr('Failed to load on-device model; using basic answers.');
                setReady(true);
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

        const fallbackReply = async (): Promise<string> => {
            const plain = (dataContext || '').replace(/^Data snapshot:\s*/i, '');
            return `Based on the latest data, ${plain}
Generally:
• Falling 10‑year yields support existing bond prices; rising yields pressure them.
• Equity moves reflect risk appetite over the past month.
• EUR/USD shifts can nudge cross‑border prices in that direction.
Ask a follow‑up if you want specifics.`;
        };

        setBusy(true);
        try {
            if (!ENABLED || !ready || !engineRef.current) {
                const text = await fallbackReply();
                setMessages(m => [...m, { role: 'assistant', content: text }]);
                return;
            }

            const engine = engineRef.current;
            const full = [
                { role: 'system', content: systemPrompt },
                { role: 'system', content: dataContext },
                ...messages.filter(m => m.role !== 'system'),
                userMsg,
            ];

            // WebLLM chat completion (non-stream; easy first)
            const result = await engine.chat.completions.create({
                messages: full,
                temperature: 0.2,
                max_tokens: 256,
            });

            const content = result?.choices?.[0]?.message?.content ?? '';
            setMessages(m => [...m, { role: 'assistant', content: content || '…' }]);
        } catch (e) {
            console.error(e);
            const text = await fallbackReply();
            setMessages(m => [...m, { role: 'assistant', content: text }]);
        } finally {
            setBusy(false);
        }
    }

    const canUseLLM = ENABLED && ready && !err;

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
                        <span>MacroLens Chat {canUseLLM ? '' : '(basic mode)'}</span>
                        {busy && <span className="text-xs opacity-60 animate-pulse">Thinking…</span>}
                    </div>

                    <div className="flex-1 overflow-auto p-3 space-y-3">
                        {messages.filter(m => m.role !== 'system').map((m, i) => (
                            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                                <div className={
                                    'inline-block rounded-xl px-3 py-2 text-sm ' +
                                    (m.role === 'user' ? 'bg-zinc-800' : 'bg-zinc-100 text-zinc-900')
                                }>
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

                    {!ready && ENABLED && (
                        <div className="absolute inset-x-0 bottom-12 text-center text-xs text-zinc-400 py-1">
                            Loading on‑device model…
                        </div>
                    )}
                    {err && (
                        <div className="absolute inset-x-0 bottom-12 text-center text-xs text-zinc-400 py-1">
                            {err}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
