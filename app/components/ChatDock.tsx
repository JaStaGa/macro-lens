// app/components/ChatDock.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { MLCEngine } from '@mlc-ai/web-llm';

// Extend Navigator so we can feature‑detect WebGPU without `any`
declare global {
    interface Navigator {
        gpu?: unknown;
    }
}

// Messages the OpenAI‑compatible endpoint accepts (no tools in this app)
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatRequest = {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
};

// Minimal shape we read back from the completion
type ChatCompletionResult = {
    choices?: Array<{ message?: { content?: string } }>;
};

// Local UI message (same shape as ChatMessage, kept separate for clarity)
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_WEBLLM === '1' ||
    process.env.ENABLE_WEBLLM === '1';

export default function ChatDock({
    systemPrompt,
    dataContext,
}: {
    systemPrompt: string;
    dataContext: string;
}) {
    const [open, setOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Msg[]>([
        { role: 'system', content: systemPrompt },
        {
            role: 'assistant',
            content:
                'Hi! Ask me about the latest CPI, unemployment, 10‑year yields, S&P 500, or EUR/USD.',
        },
        { role: 'assistant', content: dataContext },
    ]);

    const engineRef = useRef<MLCEngine | null>(null);

    // Lazy‑load the on‑device model when the dock first opens
    useEffect(() => {
        let canceled = false;

        async function init() {
            if (!open || engineRef.current || !ENABLED) return;

            // Require WebGPU; if absent, we stay in basic (fallback) mode
            if (!('gpu' in navigator)) {
                setErr('This browser/device does not support WebGPU; using basic answers.');
                setReady(true);
                return;
            }

            try {
                const webllm = await import('@mlc-ai/web-llm');
                const modelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

                // Keep options minimal to avoid “unused” warnings
                const engine = await webllm.CreateMLCEngine(modelId);

                if (canceled) return;
                engineRef.current = engine;
                setReady(true);
            } catch (e) {
                // If model fails, fall back to basic mode
                console.error(e);
                setErr('Failed to load on‑device model; using basic answers.');
                setReady(true);
            }
        }

        init();
        return () => {
            canceled = true;
        };
    }, [open]);

    async function handleSend() {
        if (!input.trim()) return;

        const userMsg: Msg = { role: 'user', content: input.trim() };
        setMessages((m) => [...m, userMsg]);
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
            const engine = engineRef.current;

            if (!ENABLED || !ready || !engine) {
                const text = await fallbackReply();
                setMessages((m) => [...m, { role: 'assistant', content: text }]);
                return;
            }

            // Build a strictly typed message array for WebLLM
            const full: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                { role: 'system', content: dataContext },
                ...messages
                    .filter((m) => m.role !== 'system')
                    .map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
                { role: 'user', content: userMsg.content },
            ];

            const req: ChatRequest = {
                messages: full,
                temperature: 0.2,
                max_tokens: 256,
            };

            const result = (await engine.chat.completions.create(req)) as ChatCompletionResult;
            const content = result?.choices?.[0]?.message?.content?.trim() ?? '…';
            setMessages((m) => [...m, { role: 'assistant', content }]);
        } catch (e) {
            console.error(e);
            const text = await fallbackReply();
            setMessages((m) => [...m, { role: 'assistant', content: text }]);
        } finally {
            setBusy(false);
        }
    }

    const canUseLLM = ENABLED && ready && !err;

    return (
        <>
            <button
                onClick={() => setOpen((v) => !v)}
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
                        {messages
                            .filter((m) => m.role !== 'system')
                            .map((m, i) => (
                                <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                                    <div
                                        className={
                                            'inline-block rounded-xl px-3 py-2 text-sm ' +
                                            (m.role === 'user' ? 'bg-zinc-800' : 'bg-zinc-100 text-zinc-900')
                                        }
                                    >
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
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSend();
                            }}
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
