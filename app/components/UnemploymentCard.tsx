"use client";
import { useEffect, useState } from "react";

type Point = { date: string; value: number };
type BLSResp = {
    observations: Point[];
    series: string;
    units: string;
    lastUpdated: string;
};

function diffPct(points: Point[]) {
    if (points.length < 2) return null;
    const last = points[points.length - 1]!.value;
    const prev = points[points.length - 2]!.value;
    return last - prev; // percentage points m/m
}

export default function UnemploymentCard() {
    const [data, setData] = useState<BLSResp | null>(null);
    const [delta, setDelta] = useState<number | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/bls?series=LNS14000000&limit=200");
                if (!res.ok) throw new Error("Failed to fetch Unemployment");
                const json: BLSResp = await res.json();
                setData(json);
                setDelta(diffPct(json.observations));
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Unknown error");
            }
        })();
    }, []);

    if (err) return <div className="p-4 rounded bg-red-100 text-red-800">Error: {err}</div>;
    if (!data) return <div className="p-4 rounded bg-gray-100 text-gray-700">Loading Unemployment…</div>;

    const latest = data.observations.at(-1);
    const deltaText =
        typeof delta === "number"
            ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp m/m`
            : "—";

    return (
        <div className="p-4 rounded-xl border flex flex-col gap-1 bg-white dark:bg-zinc-900">
            <div className="text-xs uppercase text-gray-500">Unemployment Rate (U‑3, SA)</div>
            <div className="text-3xl font-semibold">
                {latest ? `${latest.value.toFixed(1)}%` : "—"}
            </div>
            <div className="text-xs text-gray-500">
                Change: {deltaText} • As of {latest?.date}
            </div>
        </div>
    );
}
