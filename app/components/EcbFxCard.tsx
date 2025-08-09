import { getEurUsdLastN } from '@/app/lib/fetchers';

function Sparkline({ points }: { points: number[] }) {
    const width = 220, height = 40, padding = 2;
    if (!points.length) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const pts = points.map((p, i) => {
        const x = padding + (i * (width - padding * 2)) / Math.max(points.length - 1, 1);
        const y = height - padding - ((p - min) / span) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend">
            <polyline fill="none" strokeWidth="2" points={pts} />
        </svg>
    );
}

export default async function EcbFxCard() {
    const series = await getEurUsdLastN(30);
    const latest = series.at(-1);
    const prev = series.at(-2);
    const change = latest && prev ? latest.value - prev.value : null;

    return (
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
            <h2 className="font-semibold mb-1">EUR/USD (ECB)</h2>
            <p className="text-xs text-gray-500 mb-2">Daily spot, USD per EUR</p>

            {!latest ? (
                <p className="text-sm text-gray-500">No data</p>
            ) : (
                <>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{latest.value.toFixed(4)}</span>
                        {change !== null && (
                            <span className={`text-sm ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {change > 0 ? '+' : ''}{change.toFixed(4)} d/d
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">As of {latest.date}</p>
                    <div className="h-10">
                        <Sparkline points={series.slice(-30).map(d => d.value)} />
                    </div>
                </>
            )}
        </div>
    );
}
