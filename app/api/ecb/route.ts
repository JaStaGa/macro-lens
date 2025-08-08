// app/api/ecb/route.ts
import { NextRequest, NextResponse } from "next/server";

const ECB_BASE = "https://data-api.ecb.europa.eu/service/data";

/**
 * Passthrough for ECB SDMX-JSON.
 * Example: /api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=30
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const flowRef = searchParams.get("flowRef") ?? "EXR";
    const key = searchParams.get("key") ?? "D.USD.EUR.SP00.A";
    const format = searchParams.get("format") ?? "sdmx-json";

    // Forward any extra query params
    const forward = new URLSearchParams();
    searchParams.forEach((v, k) => {
        if (!["flowRef", "key", "format"].includes(k)) forward.append(k, v);
    });

    const url =
        `${ECB_BASE}/${encodeURIComponent(flowRef)}/${encodeURIComponent(key)}` +
        `?format=${encodeURIComponent(format)}${forward.toString() ? `&${forward.toString()}` : ""}`;

    try {
        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            // light caching to avoid hammering ECB while in dev
            next: { revalidate: 1800 },
        });
        if (!res.ok) {
            return NextResponse.json(
                { error: "ECB fetch failed", status: res.status, url },
                { status: res.status }
            );
        }
        const data = await res.json();
        return NextResponse.json(data, {
            headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=86400" },
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: "ECB request error", message: err?.message ?? String(err), url },
            { status: 500 }
        );
    }
}
