import { getUnemployment } from '@/app/lib/fetchers';

function diffPct(points: { value: number }[]) {
    if (points.length < 2) return null;
    const last = points[points.length - 1]!.value;
    const prev = points[points.length - 2]!.value;
    return last - prev; // percentage points m/m
}

export default async function UnemploymentCard() {
    const data = await getUnemployment();
    const latest = data.observations.at(-1);
    const delta = diffPct(data.observations);

    const deltaText =
        typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp m/m` : '—';

    return (
        <div className="p-4 rounded-xl border flex flex-col gap-1 bg-white dark:bg-zinc-900">
            <div className="text-xs uppercase text-gray-500">Unemployment Rate (U‑3, SA)</div>
            <div className="text-3xl font-semibold">
                {latest ? `${latest.value.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-gray-500">
                Change: {deltaText} • As of {latest?.date}
            </div>
        </div>
    );
}
