import { getSP500Window } from '@/app/lib/fetchers';

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

export default async function Sp500Card() {
    const spx = await getSP500Window(90, 180);
    const obs = spx.observations ?? [];
    const { cur, prev } = nBack(obs, 21);
    const v = cur?.value as number | undefined;
    const pct = (cur?.value != null && prev?.value != null && prev.value !== 0)
        ? Number((((cur.value / prev.value) - 1) * 100).toFixed(2))
        : undefined;

    return (
        <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900">
            <div className="text-xs uppercase text-gray-500">S&amp;P 500</div>
            <div className="text-3xl font-semibold">{v != null ? v.toFixed(0) : '—'}</div>
            <div className="text-xs text-gray-500">
                {cur?.date ? `As of ${fmtDay(cur.date)}` : '—'} • {pct != null ? `${pct > 0 ? '+' : ''}${pct}% ~1m` : '1m change n/a'}
            </div>
        </div>
    );
}
