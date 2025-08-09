import { getCPI, type Point } from '@/app/lib/fetchers';

function calcYoY(points: Point[]) {
    if (points.length < 13) return null;
    const last = points[points.length - 1]!.value;
    const prev12 = points[points.length - 13]!.value;
    if (!isFinite(last) || !isFinite(prev12) || prev12 === 0) return null;
    return ((last / prev12) - 1) * 100;
}

export default async function CpiCard() {
    const data = await getCPI();
    const latest = data.observations.at(-1);
    const yoy = calcYoY(data.observations);

    return (
        <div className="p-4 rounded-xl border flex flex-col gap-1 bg-white dark:bg-zinc-900">
            <h2 className="font-semibold mb-1">Headline CPI (YoY)</h2>
            <div className="text-3xl font-semibold">
                {typeof yoy === 'number' ? `${yoy.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-gray-500">
                Level (index): {latest ? latest.value.toFixed(1) : '—'} • As of {latest?.date ?? '—'}
            </div>
        </div>
    );
}
