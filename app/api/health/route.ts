import { NextResponse } from "next/server";

function baseOrigin() {
    // Prefer explicit base (set in Vercel + .env.local)
    const base = process.env.NEXT_PUBLIC_BASE_URL;
    if (base) return base.replace(/\/$/, "");
    // Fallback to Vercel’s env (no protocol)
    const vercel = process.env.VERCEL_URL;
    if (vercel) return `https://${vercel}`;
    // Local dev default
    const port = process.env.PORT || "3000";
    return `http://localhost:${port}`;
}

export async function GET() {
    const results: Record<string, { ok: boolean; status?: number }> = {};
    const checks = [
        { key: "fred", url: "/api/fred?series=CPIAUCSL&limit=1" },
        { key: "bls", url: "/api/bls?series=LNS14000000&limit=1" },
        { key: "ecb", url: "/api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=1" },
    ];

    const origin = baseOrigin();

    await Promise.all(
        checks.map(async ({ key, url }) => {
            try {
                const abs = new URL(url, origin).toString();
                const r = await fetch(abs, { cache: "no-store" });
                results[key] = { ok: r.ok, status: r.status };
            } catch {
                results[key] = { ok: false };
            }
        })
    );

    const ok = Object.values(results).every((r) => r.ok);
    return NextResponse.json({ ok, results });
}
