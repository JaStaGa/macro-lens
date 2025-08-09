import { NextRequest, NextResponse } from 'next/server';
import { getCPI, getUnemployment, getEurUsdLastN, getDGS10Window, getSP500Window } from '@/app/lib/fetchers';

export async function GET(req: NextRequest) {
    // Capture env signals we rely on
    const env = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PHASE: process.env.NEXT_PHASE,
        VERCEL: process.env.VERCEL,
        VERCEL_URL: process.env.VERCEL_URL,
        NEXT_RUNTIME: process.env.NEXT_RUNTIME,
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    };

    // Try fetchers
    let cpiLen = -1, blsLen = -1, fxLen = -1, dgsLen = -1, spxLen = -1;
    let err: string | undefined;

    try { cpiLen = (await getCPI()).observations.length; } catch (e) { err = 'getCPI:' + (e as Error).message; }
    try { blsLen = (await getUnemployment()).observations.length; } catch (e) { err = (err ? err + '; ' : '') + 'getUnemployment:' + (e as Error).message; }
    try { fxLen = (await getEurUsdLastN(5)).length; } catch (e) { err = (err ? err + '; ' : '') + 'getEurUsdLastN:' + (e as Error).message; }
    try { dgsLen = (await getDGS10Window(30, 60)).observations.length; } catch (e) { err = (err ? err + '; ' : '') + 'getDGS10Window:' + (e as Error).message; }
    try { spxLen = (await getSP500Window(30, 60)).observations.length; } catch (e) { err = (err ? err + '; ' : '') + 'getSP500Window:' + (e as Error).message; }

    return NextResponse.json({
        env,
        lengths: { cpiLen, blsLen, fxLen, dgsLen, spxLen },
        note: 'If any length is 0 but /api/* works, our build-mode softening is triggering at runtime.',
        err,
    });
}
