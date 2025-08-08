"use client";

import { useEffect, useState } from "react";

type Point = { date: string; value: number };
type FredResp = {
    observations: Point[];
    series: string;
    lastUpdated: string;
};

function calcYoY(points: Point[]) {
    if (points.length < 13) return null;
    const last = points[points.length - 1]!.value;
    const prev12 = points[points.length - 13]!.value;
    return (last / prev12 - 1) * 100;
}

export default function CpiCard() {
    const [data, setData] = useState<FredResp | null>(null);
    const [yoy, setYoy] = useState<number | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/fred?series=CPIAUCSL&limit=200");
                if (!res.ok) throw new Error("Failed to fetch CPI");
                const json: FredResp = await res.json();
                setData(json);
                setYoy(calcYoY(json.observations));
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Unknown error");
            }
        })();
    }, []);

    if (err) return <div className="p-4 rounded bg-red-100 text-red-800">Error: {err}</div>;
    if (!data) return <div className="p-4 rounded bg-gray-100 text-gray-700">Loading CPI…</div>;

    const latest = data.observations.at(-1);
    const yoyText = typeof yoy === "number" ? `${yoy.toFixed(1)}%` : "—";

    return (
        <div className="p-4 rounded-xl border flex flex-col gap-1 bg-white dark:bg-zinc-900">
            <div className="text-xs uppercase text-gray-500">Headline CPI (YoY)</div>
            <div className="text-3xl font-semibold">{yoyText}</div>
            <div className="text-xs text-gray-500">
                Level (index): {latest?.value?.toFixed(1)} • As of {latest?.date}
            </div>
        </div>
    );
}
