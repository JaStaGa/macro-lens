import { NextResponse } from "next/server";

export const revalidate = 3600; // 1 hour

type Point = { date: string; value: number };

// BLS series: Unemployment Rate (U-3, seasonally adjusted)
const DEFAULT_SERIES = "LNS14000000"; // Labor Force Statistics, Unemployment Rate

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series") || DEFAULT_SERIES;
    const limitParam = Number(searchParams.get("limit") || "120"); // ~10 years monthly

    // BLS v2 timeseries endpoint supports POST with JSON body
    const url = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
    const body: any = {
        seriesid: [series],
        // You can also use startyear/endyear; we'll just trim locally
        // 'registrationkey' is optional—only include if present
    };
    if (process.env.BLS_API_KEY) {
        (body as any).registrationkey = process.env.BLS_API_KEY;
    }

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ISR cache hint
        next: { revalidate },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        return NextResponse.json({ error: `BLS error: ${res.status}` }, { status: 502 });
    }

    const raw = await res.json();
    // Expect shape: { Results: { series: [{ data: [{ year, period, periodName, value, ... }] }] } }
    const seriesArr = raw?.Results?.series?.[0]?.data ?? [];
    // Convert to {date,value} with YYYY-MM-01 (BLS monthly uses periods "M01".."M12")
    const all: Point[] = seriesArr
        .map((d: any) => {
            const m = (d.period || "").replace("M", "");
            if (!/^\d{2}$/.test(m)) return null;
            const month = m.padStart(2, "0");
            const date = `${d.year}-${month}-01`;
            const value = Number(d.value);
            return Number.isFinite(value) ? { date, value } : null;
        })
        .filter((p: Point | null): p is Point => p !== null)
        // BLS returns newest first; flip to ascending
        .reverse();

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
