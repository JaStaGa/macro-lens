import { getUnemployment } from '@/app/lib/fetchers';
import { Card, CardHeader, CardBody } from './ui/Card';

type Obs = { date: string; value: number };

function diffPp(points: Obs[]) {
    if (points.length < 2) return null;
    const last = points.at(-1)!.value;
    const prev = points.at(-2)!.value;
    return last - prev; // percentage points m/m
}
function fmtMonth(dateISO?: string) {
    if (!dateISO) return '—';
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
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
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Unemployment ~12‑month trend">
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

export default async function UnemploymentCard() {
    const data = await getUnemployment();
    const obs = (data.observations ?? []) as Obs[];
    const latest = obs.at(-1);
    const delta = diffPp(obs);
    const asOf = fmtMonth(latest?.date);

    const levelText = latest ? `${latest.value.toFixed(1)}%` : '—';
    const deltaText =
        delta == null ? 'm/m n/a' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp m/m`;

    // Unemployment semantics: higher is worse (red)
    const deltaClass =
        delta == null
            ? 'bg-zinc-700/20 text-zinc-400'
            : delta > 0
                ? 'bg-red-500/15 text-red-400'
                : 'bg-emerald-500/15 text-emerald-400';

    const lineColorClass =
        delta == null ? 'text-zinc-400' : delta > 0 ? 'text-red-400' : 'text-emerald-400';

    // last 12 levels for sparkline
    const last12 = obs.slice(-12).map(d => d.value);

    return (
        <Card>
            <CardHeader title="Unemployment Rate (U‑3, SA)" asOf={asOf} />
            <CardBody>
                <div className="flex items-center gap-3">
                    <div className="text-3xl font-semibold">{levelText}</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${deltaClass}`}>
                        {deltaText}
                    </span>
                </div>

                <div className={`mt-3 h-10 ${lineColorClass}`}>
                    <Sparkline points={last12} />
                </div>

                <div className="mt-2 text-xs text-zinc-500">Seasonally adjusted rate</div>
            </CardBody>
        </Card>
    );
}
