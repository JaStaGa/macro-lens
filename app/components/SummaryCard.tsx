// app/components/SummaryCard.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SummaryResp = {
    summary: string;
    source?: string;
    inputs?: Partial<{
        cpiDate: string;
        unempDate: string;
        yldDate: string;
        spxDate: string;
        fxDate: string;
    }>;
};

export default function SummaryCard() {
    const [data, setData] = useState<SummaryResp | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Shimmer should show for ~300ms even if the fetch is fast
    const [showShimmer, setShowShimmer] = useState(true);
    const shimmerTimer = useRef<number | null>(null);

    useEffect(() => {
        shimmerTimer.current = window.setTimeout(() => setShowShimmer(false), 300);

        let aborted = false;
        fetch('/api/summary', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then(json => { if (!aborted) setData(json as SummaryResp); })
            .catch(e => { if (!aborted) setError(e instanceof Error ? e.message : String(e)); });

        return () => {
            aborted = true;
            if (shimmerTimer.current) window.clearTimeout(shimmerTimer.current);
        };
    }, []);

    const asOfLine = useMemo(() => {
        const i = data?.inputs || {};
        // Build a compact “as of” chip line; only include what exists
        const parts: string[] = [];
        if (i.cpiDate) parts.push(`CPI ${i.cpiDate}`);
        if (i.unempDate) parts.push(`U‑3 ${i.unempDate}`);
        if (i.yldDate) parts.push(`10y ${i.yldDate}`);
        if (i.spxDate) parts.push(`SPX ${i.spxDate}`);
        if (i.fxDate) parts.push(`EUR/USD ${i.fxDate}`);
        return parts.join(' · ');
    }, [data]);

    return (
        <div className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900 text-zinc-100">
            <div className="text-sm opacity-70 mb-2">AI Summary</div>

            {/* Loading state (shimmer) */}
            {(showShimmer || (!data && !error)) && (
                <div className="space-y-2 animate-pulse" aria-hidden>
                    <div className="h-3 rounded bg-zinc-800/80 w-11/12" />
                    <div className="h-3 rounded bg-zinc-800/80 w-10/12" />
                </div>
            )}

            {/* Error */}
            {error && !showShimmer && (
                <div className="text-red-400">Error: {error}</div>
            )}

            {/* Summary */}
            {data && !showShimmer && (
                <>
                    <p className="leading-relaxed">{data.summary}</p>
                    {asOfLine && (
                        <p className="mt-2 text-xs text-zinc-400">
                            As of: {asOfLine}
                        </p>
                    )}
                    {data.source && (
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                            Source: {data.source}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
