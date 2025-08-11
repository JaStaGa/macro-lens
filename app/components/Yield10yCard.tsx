import { getDGS10Window } from '@/app/lib/fetchers';
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
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="10y yield ~30‑day trend">
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

export default async function Yield10yCard() {
    const dgs10 = await getDGS10Window(90, 180);
    const obs: Obs[] = (dgs10.observations ?? []) as Obs[];

    if (obs.length === 0) {
        return (
            <Card>
                <CardHeader title="US 10‑Year Treasury" asOf="—" />
                <CardBody>
                    <div className="text-sm text-zinc-500">Data unavailable</div>
                </CardBody>
            </Card>
        );
    }

    const { cur, prev } = nBack(obs, 21);
    const level = cur?.value;
    const asOf = fmtDay(cur?.date);
    const chgBps =
        cur?.value != null && prev?.value != null
            ? Number(((cur.value - prev.value) * 100).toFixed(1))
            : null;

    const deltaText = chgBps == null ? '1m n/a' : `${chgBps > 0 ? '+' : ''}${chgBps} bps ~1m`;
    const deltaClass =
        chgBps == null
            ? 'bg-zinc-700/20 text-zinc-400'
            : chgBps > 0
                ? 'bg-red-500/15 text-red-400' // yields ↑ = red
                : 'bg-emerald-500/15 text-emerald-400'; // yields ↓ = green

    const lineColorClass =
        chgBps == null
            ? 'text-zinc-400'
            : chgBps > 0
                ? 'text-red-400'
                : 'text-emerald-400';


    return (
        <Card>
            <CardHeader
                title="US 10‑Year Treasury"
                asOf={asOf}
                right={
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${deltaClass}`}>
                        {deltaText}
                    </span>
                }
            />
            <CardBody>
                <div className="text-3xl font-semibold">{level != null ? `${level.toFixed(2)}%` : '—'}</div>
                <div className={`mt-3 h-10 ${lineColorClass}`}>
                    <Sparkline points={obs.slice(-30).map(d => d.value)} />
                </div>
                <div className="mt-2 text-xs text-zinc-500">Market yield on U.S. Treasury securities, 10‑year</div>
            </CardBody>
        </Card>
    );
}
