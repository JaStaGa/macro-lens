// app/components/CpiCard.tsx
import { getCPI, type Point } from '@/app/lib/fetchers';
import { Card, CardHeader, CardBody } from './ui/Card';

function calcYoY(points: Point[]) {
    if (points.length < 13) return null;
    const last = points.at(-1)!.value;
    const prev12 = points.at(-13)!.value;
    if (!isFinite(last) || !isFinite(prev12) || prev12 === 0) return null;
    return ((last / prev12) - 1) * 100;
}
function calcYoYDeltaMoM(points: Point[]) {
    if (points.length < 14) return null;
    const now = calcYoY(points);
    const prev = calcYoY(points.slice(0, -1));
    if (now == null || prev == null) return null;
    return now - prev; // m/m change in YoY
}
function fmtMonth(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Build a 12‑point YoY series for the sparkline (last 12 months)
function yoySeries(points: Point[]): number[] {
    if (points.length < 25) return [];
    const out: number[] = [];
    for (let i = points.length - 12; i < points.length; i++) {
        const cur = points[i]?.value;
        const prev12 = points[i - 12]?.value;
        if (!isFinite(cur) || !isFinite(prev12) || !prev12) continue;
        out.push(((cur / prev12) - 1) * 100);
    }
    return out;
}

function Sparkline({ points }: { points: number[] }) {
    const width = 220, height = 40, pad = 2;
    if (!points.length) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const pts = points.map((p, i) => {
        const x = pad + (i * (width - pad * 2)) / Math.max(points.length - 1, 1);
        const y = height - pad - ((p - min) / span) * (height - pad * 2);
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="CPI YoY ~12‑month trend">
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pts}
            />
        </svg>
    );
}

export default async function CpiCard() {
    const data = await getCPI();
    const latest = data.observations.at(-1);
    const yoy = calcYoY(data.observations);
    const yoyDelta = calcYoYDeltaMoM(data.observations);
    const series = yoySeries(data.observations);

    // CPI semantics: higher inflation = worse (red)
    const deltaClass =
        yoyDelta == null
            ? 'bg-zinc-700/20 text-zinc-400'
            : yoyDelta > 0
                ? 'bg-red-500/15 text-red-400'
                : 'bg-emerald-500/15 text-emerald-400';

    const lineColorClass =
        yoyDelta == null ? 'text-zinc-400' : yoyDelta > 0 ? 'text-red-400' : 'text-emerald-400';

    return (
        <Card>
            <CardHeader title="Headline CPI (YoY)" asOf={fmtMonth(latest?.date)} />
            <CardBody>
                <div className="flex items-center gap-3">
                    <div className="text-3xl font-semibold tabular-nums">
                        {typeof yoy === 'number' ? `${yoy.toFixed(1)}%` : '—'}
                    </div>
                    {yoyDelta != null && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${deltaClass}`}>
                            {yoyDelta > 0 ? '+' : ''}{yoyDelta.toFixed(1)}% m/m
                        </span>
                    )}
                </div>

                <div className={`mt-3 h-10 ${lineColorClass}`}>
                    <Sparkline points={series} />
                </div>

                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Index level:&nbsp;<span className="tabular-nums">{latest ? latest.value.toFixed(1) : '—'}</span>
                </p>
            </CardBody>
        </Card>
    );
}
