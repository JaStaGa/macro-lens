'use client'
import { useEffect, useState } from 'react'

type SummaryResp = {
    summary: string
    inputs: Record<string, unknown>
}

export default function SummaryCard() {
    const [data, setData] = useState<SummaryResp | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        fetch('/api/summary', { cache: 'no-store' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(json => { if (mounted) setData(json) })
            .catch(e => { if (mounted) setError(String(e)) })
            .finally(() => { if (mounted) setLoading(false) })
        return () => { mounted = false }
    }, [])

    return (
        <div className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900 text-zinc-100">
            <div className="text-sm opacity-70 mb-1">AI Summary</div>
            {loading && <div className="animate-pulse text-zinc-400">Generating…</div>}
            {error && <div className="text-red-400">Error: {error}</div>}
            {data && <p className="leading-relaxed">{data.summary}</p>}
        </div>
    )
}
