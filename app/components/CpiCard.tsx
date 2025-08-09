"use client";
import { useEffect, useState } from "react";

type Point = { date: string; value: number };
type FREDResp = {
    observations: Point[]; // assume same normalized shape you used for BLS
    series: string;
    units?: string;
    lastUpdated?: string;
};

function calcYoY(points: Point[]) {
    if (points.length < 13) return null;
    const last = points[points.length - 1]!.value;
    const prev12 = points[points.length - 13]!.value;
    if (!isFinite(last) || !isFinite(prev12) || prev12 === 0) return null;
    return ((last / prev12) - 1) * 100;
}

export default function CpiCard() {
    const [data, setData] = useState<FREDResp | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                // CPIAUCSL: CPI All Urban Consumers, monthly index (SA)
                const res = await fetch("/api/fred?series=CPIAUCSL&limit=240");
                if (!res.ok) throw new Error(`Failed to fetch CPI (HTTP ${res.status})`);
                const json: FREDResp = await res.json();
                setData(json);
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Unknown error");
            }
        })();
    }, []);

    if (err) return <div className="p-4 rounded bg-red-100 text-red-800">Error: {err}</div>;
    if (!data) return <div className="p-4 rounded bg-gray-100 text-gray-700">Loading CPI…</div>;

    const latest = data.observations.at(-1);
    const yoy = calcYoY(data.observations);

    return (
        <div className="p-4 rounded-xl border flex flex-col gap-1 bg-white dark:bg-zinc-900">
            <h2 className="font-semibold mb-1">Headline CPI (YoY)</h2>
            <div className="text-3xl font-semibold">
                {typeof yoy === "number" ? `${yoy.toFixed(1)}%` : "—"}
            </div>
            <div className="text-xs text-gray-500">
                Level (index): {latest ? latest.value.toFixed(1) : "—"} • As of {latest?.date ?? "—"}
            </div>
        </div>
    );
}
