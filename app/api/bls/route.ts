import { NextResponse } from "next/server";
import type { BlsResponse, BlsDatum } from "@/types/bls";

export const revalidate = 3600; // 1 hour

type Point = { date: string; value: number };
const DEFAULT_SERIES = "LNS14000000"; // U-3 unemployment rate, SA

type BlsBody = {
    seriesid: string[];
    registrationkey?: string;
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series") || DEFAULT_SERIES;
    const limitParam = Number(searchParams.get("limit") || "120");

    const body: BlsBody = { seriesid: [series] };
    if (process.env.BLS_API_KEY) body.registrationkey = process.env.BLS_API_KEY;

    const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        next: { revalidate },
    });

    if (!res.ok) {
        return NextResponse.json({ error: `BLS error: ${res.status}` }, { status: 502 });
    }

    const raw: BlsResponse = await res.json();
    const seriesArr = raw?.Results?.series?.[0]?.data ?? [];

    const all: Point[] = seriesArr
        .map<Point | null>((d: BlsDatum) => {
            const m = (d.period || "").replace("M", "");
            if (!/^\d{2}$/.test(m)) return null;
            const date = `${d.year}-${m.padStart(2, "0")}-01`;
            const value = Number(d.value);
            return Number.isFinite(value) ? { date, value } : null;
        })
        .filter((p): p is Point => p !== null)
        .reverse(); // BLS returns newest first → make ascending

    const limit = Math.max(1, Math.min(limitParam, all.length));
    const observations = all.slice(-limit);

    return NextResponse.json({
        series,
        observations,
        lastUpdated: new Date().toISOString(),
        units: "percent",
        frequency: "Monthly",
    });
}
