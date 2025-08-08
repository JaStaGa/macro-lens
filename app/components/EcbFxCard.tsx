'use client';

import { useEffect, useMemo, useState } from 'react';

type Obs = { date: string; value: number };

function parseSdmxToSeries(json: any): Obs[] {
    // SDMX-JSON shape (ECB): dataSets[0].series['0:...'].observations
    const ds = json?.dataSets?.[0];
    const series = ds?.series;
    if (!series) return [];

    const firstSeriesKey = Object.keys(series)[0];
    const observations = series?.[firstSeriesKey]?.observations;
    if (!observations) return [];

    // Time labels live in structure.dimensions.observation (TIME_PERIOD usually first)
    const obsDims = json?.structure?.dimensions?.observation ?? [];
    const timeDim =
        obsDims.find((d: any) => d?.id === 'TIME_PERIOD') ?? obsDims[0] ?? { values: [] };
    const timeValues: Array<{ id?: string; name?: string }> = timeDim.values ?? [];

    const out: Obs[] = [];
    for (const [idxStr, arr] of Object.entries<any>(observations)) {
        const i = Number(idxStr);
        const label = timeValues[i]?.id || timeValues[i]?.name; // e.g., "2025-07-18" or "2025-07"
        const v = Array.isArray(arr) ? arr[0] : arr;
        const num = Number(v);
        if (label && Number.isFinite(num)) {
            out.push({ date: label, value: num });
        }
    }
    // Sort by date ascending just in case
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function Sparkline({ points }: { points: number[] }) {
    const width = 220;
    const height = 40;
    const padding = 2;

    const path = useMemo(() => {
        if (points.length === 0) return '';
        const min = Math.min(...points);
        const max = Math.max(...points);
        const span = max - min || 1;

        return points
            .map((p, i) => {
                const x =
                    padding + (i * (width - padding * 2)) / Math.max(points.length - 1, 1);
                const y = height - padding - ((p - min) / span) * (height - padding * 2);
                return `${x},${y}`;
            })
            .join(' ');
    }, [points]);

    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend">
            <polyline fill="none" strokeWidth="2" points={path} />
        </svg>
    );
}

export default function EcbFxCard() {
    const [series, setSeries] = useState<Obs[] | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Daily USD per EUR spot (ECB), last 30 obs
        const url = `/api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=30`;
        fetch(url)
            .then(async (r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const j = await r.json();
                const parsed = parseSdmxToSeries(j);
                if (!parsed.length) throw new Error('No observations found');
                setSeries(parsed);
            })
            .catch((e) => setErr(String(e)))
            .finally(() => setLoading(false));
    }, []);

    const latest = series?.[series.length - 1];
    const prev = series?.[series.length - 2];
    const change = latest && prev ? latest.value - prev.value : null;

    return (
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
            <h2 className="font-semibold mb-1">EUR/USD (ECB)</h2>
            <p className="text-xs text-gray-500 mb-2">Daily spot, USD per EUR</p>

            {loading && <p className="text-sm text-gray-500">Loading…</p>}
            {err && <p className="text-sm text-red-500">Error: {err}</p>}

            {!loading && !err && latest && (
                <>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">
                            {latest.value.toFixed(4)}
                        </span>
                        {change !== null && (
                            <span
                                className={`text-sm ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                                    }`}
                            >
                                {change > 0 ? '+' : ''}
                                {change?.toFixed(4)} d/d
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        As of {latest.date}
                    </p>

                    <div className="h-10">
                        <Sparkline points={series!.slice(-30).map((d) => d.value)} />
                    </div>
                </>
            )}
        </div>
    );
}
