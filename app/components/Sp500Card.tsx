import { getSP500Window } from '@/app/lib/fetchers';
import { Card, CardHeader, CardBody } from './ui/Card';

type Obs = { date: string; value: number };

function fmtDay(dateISO?: string) {
    if (!dateISO) return '—';
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function nBack<T extends Obs>(arr: T[], n: number): { cur?: T; prev?: T } {
    if (arr.length === 0) return {};
    const i = arr.length - 1;
    const j = Math.max(0, i - n);
    return { cur: arr[i], prev: arr[j] };
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
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="S&P 500 ~30‑day trend">
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

export default async function Sp500Card() {
    const spx = await getSP500Window(90, 180);
    const obs: Obs[] = (spx.observations ?? []) as Obs[];

    if (obs.length === 0) {
        return (
            <Card>
                <CardHeader title="S&P 500" asOf="—" />
                <CardBody>
                    <div className="text-sm text-zinc-500">Data unavailable</div>
                </CardBody>
            </Card>
        );
    }

    const { cur, prev } = nBack(obs, 21);
    const level = cur?.value;
    const asOf = fmtDay(cur?.date);
    const oneMonthPct =
        cur?.value != null && prev?.value != null && prev.value !== 0
            ? Number((((cur.value / prev.value) - 1) * 100).toFixed(2))
            : null;

    const deltaText = oneMonthPct == null ? '1m n/a' : `${oneMonthPct > 0 ? '+' : ''}${oneMonthPct}% ~1m`;
    const deltaClass =
        oneMonthPct == null ? 'bg-zinc-700/20 text-zinc-400' : oneMonthPct > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400';
    const lineColorClass =
        oneMonthPct == null ? 'text-zinc-400' : oneMonthPct > 0 ? 'text-emerald-400' : 'text-red-400';

    return (
        <Card>
            <CardHeader
                title="S&P 500"
                asOf={asOf}
                right={
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${deltaClass}`}>
                        {deltaText}
                    </span>
                }
            />
            <CardBody>
                <div className="text-3xl font-semibold">{level != null ? level.toFixed(0) : '—'}</div>
                <div className={`mt-3 h-10 ${lineColorClass}`}>
                    <Sparkline points={obs.slice(-30).map(d => d.value)} />
                </div>
                <div className="mt-2 text-xs text-zinc-500">Index level (price)</div>
            </CardBody>
        </Card>
    );
}
