import { getDGS10Window } from '@/app/lib/fetchers';

function fmtDay(dateISO?: string) {
    if (!dateISO) return '';
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function nBack<T>(arr: T[], n: number) {
    const i = arr.length - 1;
    const j = Math.max(0, i - n);
    return { cur: (arr as any)[i], prev: (arr as any)[j] };
}

export default async function Yield10yCard() {
    const dgs10 = await getDGS10Window(90, 180);
    const obs = dgs10.observations ?? [];
    const { cur, prev } = nBack(obs, 21);
    const yld = cur?.value as number | undefined;
    const chgBps = (cur?.value != null && prev?.value != null)
        ? Number(((cur.value - prev.value) * 100).toFixed(1))
        : undefined;

    return (
        <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900">
            <div className="text-xs uppercase text-gray-500">US 10‑Year Treasury</div>
            <div className="text-3xl font-semibold">{yld != null ? `${yld.toFixed(2)}%` : '—'}</div>
            <div className="text-xs text-gray-500">
                {cur?.date ? `As of ${fmtDay(cur.date)}` : '—'} • {chgBps != null ? `${chgBps > 0 ? '+' : ''}${chgBps} bps ~1m` : '1m change n/a'}
            </div>
        </div>
    );
}
