import { getEurUsdLastN } from '@/app/lib/fetchers';
import { Card, CardHeader, CardBody } from './ui/Card';

function fmtDay(dateISO?: string) {
    if (!dateISO) return '—';
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Sparkline({ points }: { points: number[] }) {
    const width = 220, height = 40, pad = 2;
    if (!points.length) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;

    const pts = points
        .map((p, i) => {
            const x = pad + (i * (width - pad * 2)) / Math.max(points.length - 1, 1);
            const y = height - pad - ((p - min) / span) * (height - pad * 2);
            return `${x},${y}`;
        })
        .join(' ');

    // stroke="currentColor" lets the parent color control the line color
    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="EUR/USD 30‑day trend">
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

export default async function EcbFxCard() {
    const series = await getEurUsdLastN(30);

    // Empty state (rare)
    if (!series.length) {
        return (
            <Card>
                <CardHeader title="EUR/USD (ECB)" asOf="—" />
                <CardBody>
                    <div className="text-xs text-zinc-500">Daily spot, USD per EUR</div>
                    <div className="mt-2 text-sm text-zinc-500">Data unavailable</div>
                </CardBody>
            </Card>
        );
    }

    const latest = series.at(-1)!;
    const prev = series.at(-2);
    const change = prev ? latest.value - prev.value : null;

    const asOf = fmtDay(latest?.date);
    const levelText = latest ? latest.value.toFixed(4) : '—';
    const deltaText =
        change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(4)} d/d`;

    // Convention here: EUR/USD ↑ (EUR stronger vs USD) = green; ↓ = red.
    // If you prefer the opposite, just swap the classes in the ternary below.
    const deltaClass =
        change == null
            ? 'bg-zinc-700/20 text-zinc-400'
            : change > 0
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400';

    // Use the same color for the sparkline (via currentColor).
    const lineColorClass =
        change == null ? 'text-zinc-400' : change > 0 ? 'text-emerald-400' : 'text-red-400';

    return (
        <Card>
            <CardHeader
                title="EUR/USD (ECB)"
                asOf={asOf}
                right={
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${deltaClass}`}>
                        {deltaText}
                    </span>
                }
            />
            <CardBody>
                <div className="text-3xl font-semibold">{levelText}</div>
                <div className={`mt-3 h-10 ${lineColorClass}`}>
                    <Sparkline points={series.slice(-30).map(d => d.value)} />
                </div>
                <div className="mt-2 text-xs text-zinc-500">Daily spot, USD per EUR</div>
            </CardBody>
        </Card>
    );
}
