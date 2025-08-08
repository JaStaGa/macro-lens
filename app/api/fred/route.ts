import { NextResponse } from "next/server";

export const revalidate = 3600; // cache for 1 hour

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series"); // e.g. CPIAUCSL
    const limit = searchParams.get("limit") || "120"; // last 10 years monthly
    const start = searchParams.get("start"); // optional YYYY-MM-DD
    const apiKey = process.env.FRED_API_KEY;

    if (!series) {
        return NextResponse.json({ error: "Missing ?series" }, { status: 400 });
    }
    if (!apiKey) {
        return NextResponse.json({ error: "Server missing FRED_API_KEY" }, { status: 500 });
    }

    const base = "https://api.stlouisfed.org/fred/series/observations";
    const url = new URL(base);
    url.searchParams.set("series_id", series);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    if (start) url.searchParams.set("observation_start", start);

    // We’ll fetch a lot, then slice to `limit` locally because FRED “limit” is less flexible
    const res = await fetch(url.toString(), { next: { revalidate } });
    if (!res.ok) {
        return NextResponse.json({ error: `FRED error: ${res.status}` }, { status: 502 });
    }
    const raw = await res.json();

    // Normalize to {date,value:number} and keep last N points
    const all = (raw?.observations || [])
        .map((o: any) => ({
            date: o.date,
            value: o.value === "." ? null : Number(o.value),
        }))
        .filter((d: any) => typeof d.value === "number");

    const n = Math.max(1, Math.min(Number(limit), all.length));
    const observations = all.slice(-n);

    return NextResponse.json({
        series,
        count: observations.length,
        frequency: raw?.frequency,
        units: raw?.units,
        observations,
        lastUpdated: new Date().toISOString(),
    });
}
