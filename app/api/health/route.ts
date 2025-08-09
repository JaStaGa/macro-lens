import { NextResponse } from "next/server";

export async function GET() {
    const results: Record<string, { ok: boolean; status?: number }> = {};
    const checks = [
        { key: "fred", url: "/api/fred?series=CPIAUCSL&limit=1" },
        { key: "bls", url: "/api/bls?series=LNS14000000&limit=1" },
        { key: "ecb", url: "/api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=1" },
    ];

    await Promise.all(checks.map(async ({ key, url }) => {
        try {
            const r = await fetch(new URL(url, process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").toString(), { cache: "no-store" });
            results[key] = { ok: r.ok, status: r.status };
        } catch {
            results[key] = { ok: false };
        }
    }));

    const ok = Object.values(results).every(r => r.ok);
    return NextResponse.json({ ok, results });
}
