export const revalidate = 300;

type Health = { ok: boolean; results: Record<string, { ok: boolean; status?: number }> };

export default async function StatusPage() {
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    const r = await fetch(`${base}/api/health`, { cache: 'no-store' });
    const data = (await r.json()) as Health;

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-6">
            <h1 className="text-2xl font-bold">Status</h1>
            <div className="flex flex-wrap gap-3">
                {Object.entries(data.results).map(([k, v]) => (
                    <span
                        key={k}
                        className={`px-3 py-1 rounded-full text-sm ${v.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                        title={v.status ? `HTTP ${v.status}` : 'No response'}
                    >
                        {k.toUpperCase()}: {v.ok ? 'OK' : 'Down'}
                    </span>
                ))}
            </div>
            <p className="text-sm text-gray-500">
                Overall: {data.ok ? 'All systems nominal' : 'Some upstream errors'}
            </p>
        </main>
    );
}
