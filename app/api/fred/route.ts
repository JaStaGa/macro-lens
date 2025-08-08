import { NextResponse } from "next/server";
import type { FredSeriesResponse } from "@/types/fred";

export const revalidate = 3600; // 1 hour

type Point = { date: string; value: number };

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series"); // e.g., CPIAUCSL
    const limitParam = searchParams.get("limit") || "120";
    const start = searchParams.get("start"); // optional YYYY-MM-DD
    const apiKey = process.env.FRED_API_KEY;

    if (!series) {
        return NextResponse.json({ error: "Missing ?series" }, { status: 400 });
    }
    if (!apiKey) {
        return NextResponse.json({ error: "Server missing FRED_API_KEY" }, { status: 500 });
    }

    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", series);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    if (start) url.searchParams.set("observation_start", start);

    const res = await fetch(url.toString(), { next: { revalidate } });
    if (!res.ok) {
        return NextResponse.json({ error: `FRED error: ${res.status}` }, { status: 502 });
    }

    const raw: FredSeriesResponse = await res.json();

    const all: Point[] = (raw.observations ?? [])
        .map<Point | null>((o) => {
            if (o.value === ".") return null;
            const num = Number(o.value);
            return Number.isFinite(num) ? { date: o.date, value: num } : null;
        })
        .filter((p): p is Point => p !== null);

    const limit = Math.max(1, Math.min(Number(limitParam), all.length));
    const observations = all.slice(-limit);

    return NextResponse.json({
        series,
        count: observations.length,
        frequency: raw.frequency,
        units: raw.units,
        observations,
        lastUpdated: new Date().toISOString(),
    });
}
