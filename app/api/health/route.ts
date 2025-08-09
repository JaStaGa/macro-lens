// app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";

function originFromRequest(req: NextRequest) {
    // Vercel forwards proto/host correctly
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || process.env.VERCEL_URL || "";
    return `${proto}://${host}`.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
    const origin = originFromRequest(req);

    const checks = [
        { key: "fred", url: "/api/fred?series=CPIAUCSL&limit=1" },
        { key: "bls", url: "/api/bls?series=LNS14000000&limit=1" },
        { key: "ecb", url: "/api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=1" },
    ] as const;

    const results: Record<string, { ok: boolean; status?: number; tested?: string }> = {};

    await Promise.all(checks.map(async ({ key, url }) => {
        try {
            const abs = new URL(url, origin).toString();
            const r = await fetch(abs, { cache: "no-store", next: { revalidate: 0 } });
            results[key] = { ok: r.ok, status: r.status, tested: abs };
        } catch {
            results[key] = { ok: false };
        }
    }));

    const ok = Object.values(results).every(r => r.ok);
    return NextResponse.json({ ok, origin, results });
}
