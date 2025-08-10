// app/api/summary/route.ts
import { NextResponse } from 'next/server'
import {
    getCPI,
    getUnemployment,
    getDGS10Window,
    getSP500Window,
    getEurUsdLastN,
} from '@/app/lib/fetchers';

const ENABLE_LOCAL_SUMMARY = process.env.ENABLE_LOCAL_SUMMARY === '1';
const MODEL_TIMEOUT_MS = Number(process.env.SUMMARY_MODEL_TIMEOUT_MS || '1500');

function withTimeout<T>(p: Promise<T>, ms: number, label = 'timeout'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(label)), ms);
        p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
}

export const runtime = 'nodejs'
export const revalidate = 3600

type Point = { date: string; value: number }
type FredOut = { series: string; observations: Point[] }
type BlsOut = { series: string; observations: Point[] }
type EcbSdmx = {
    dataSets: Array<{ series: Record<string, { observations: Record<string, [number]> }> }>
    structure: { dimensions: { observation: Array<{ values: Array<{ name: string }> }> } }
}

type T2TOutput = Array<{ generated_text?: string }>;
type SummarizerFn = (input: string, options?: Record<string, unknown>) => Promise<T2TOutput>;

let _summarizer: SummarizerFn | null = null;
async function getSummarizer(): Promise<SummarizerFn> {
    if (_summarizer) return _summarizer;
    const { pipeline } = await import('@xenova/transformers');
    _summarizer = await pipeline('text2text-generation', 'Xenova/t5-small') as SummarizerFn;
    return _summarizer;
}

function baseUrlFromEnv(headers: Headers) {
    const host = headers.get('host')
    const vercel = process.env.VERCEL_URL
    if (vercel) return `https://${vercel}`
    if (host) return `http${host.includes('localhost') ? '' : 's'}://${host}`
    return 'http://localhost:3000'
}

// ---- formatting helpers
const pct = (n: number | undefined) =>
    (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%'
const signWord = (n: number | undefined) =>
    n == null ? '' : n > 0 ? 'rose' : n < 0 ? 'fell' : 'was unchanged'

function fmtMonth(dateISO?: string) {
    if (!dateISO) return ''
    const d = new Date(dateISO)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}
function fmtDay(dateISO?: string) {
    if (!dateISO) return ''
    const d = new Date(dateISO)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// --- helpers
function last<T>(arr: T[]): T | undefined { return arr[arr.length - 1] }
function yoyFromMonthly(observations: Point[]): { yoy: number | undefined; idx: number } {
    if (!observations?.length) return { yoy: undefined, idx: -1 }
    const i = observations.length - 1
    const j = i - 12
    if (j < 0) return { yoy: undefined, idx: i }
    const a = observations[i]?.value, b = observations[j]?.value
    if (a == null || b == null || b === 0) return { yoy: undefined, idx: i }
    return { yoy: ((a / b) - 1) * 100, idx: i }
}
function nBack<T>(arr: T[], n: number): { cur?: T; prev?: T; i: number; j: number } {
    if (!arr.length) return { i: -1, j: -1 };
    const i = arr.length - 1;
    const j = Math.max(0, i - n);
    return { cur: arr[i], prev: arr[j], i, j };
}
function parseEcbEurUsd(sdmx: EcbSdmx): { value?: number; prev?: number; date?: string; prevDate?: string } {
    try {
        const seriesKey = Object.keys(sdmx.dataSets?.[0]?.series ?? {})[0]
        const obs = sdmx.dataSets[0].series[seriesKey].observations
        const timeVals = sdmx.structure.dimensions.observation[0].values
        const idxs = Object.keys(obs).map(Number).sort((a, b) => a - b)
        if (!idxs.length) return {}
        const lastIdx = idxs[idxs.length - 1]
        const prevIdx = idxs.length > 1 ? idxs[idxs.length - 2] : undefined
        const value = obs[String(lastIdx)]?.[0]
        const prev = prevIdx != null ? obs[String(prevIdx)]?.[0] : undefined
        const date = timeVals?.[lastIdx]?.name
        const prevDate = prevIdx != null ? timeVals?.[prevIdx]?.name : undefined
        return { value, prev, date, prevDate }
    } catch { return {} }
}

export async function GET(req: Request) {
    try {
        // Pull data via server helpers to avoid /api/* 401s on Vercel
        const [cpiR, blsR, dgsR, spxR, fxR] = await Promise.allSettled([
            getCPI(),                // FredOut (CPIAUCSL ~20y)
            getUnemployment(),       // BlsOut
            getDGS10Window(90, 180), // FredOut DGS10 (~6m, cap 90)
            getSP500Window(90, 180), // FredOut SP500
            getEurUsdLastN(2),       // Obs[]: last two EUR/USD prints
        ]);

        if (
            ![cpiR, blsR, dgsR, spxR, fxR].every(r => r.status === 'fulfilled')
        ) {
            // Be resilient: if you’d rather degrade than 500, you can skip throwing here.
            throw new Error(
                `Upstream helpers failed ` +
                `(cpi:${cpiR.status} bls:${blsR.status} dgs10:${dgsR.status} sp500:${spxR.status} ecb:${fxR.status})`
            );
        }

        const cpi = (cpiR as PromiseFulfilledResult<FredOut>).value;
        const bls = (blsR as PromiseFulfilledResult<BlsOut>).value;
        const dgs10 = (dgsR as PromiseFulfilledResult<FredOut>).value;
        const sp500 = (spxR as PromiseFulfilledResult<FredOut>).value;
        const fxArr = (fxR as PromiseFulfilledResult<Array<{ date: string; value: number }>>).value;

        // CPI
        const cpiObs = cpi.observations ?? []
        const { yoy: cpiYoY, idx: cpiIdx } = yoyFromMonthly(cpiObs)
        const cpiIndex = cpiObs[cpiIdx]?.value
        const cpiDate = cpiObs[cpiIdx]?.date
        const cpiDateFmt = fmtMonth(cpiDate)

        // Unemployment
        const uObs = bls.observations ?? []
        const uLast = last(uObs)
        const uPrev = uObs.length >= 2 ? uObs[uObs.length - 2] : undefined
        const unemp = uLast?.value
        const unempDate = uLast?.date
        const unempDateFmt = fmtMonth(unempDate)
        const unempMoM = (unemp != null && uPrev?.value != null) ? Number((unemp - uPrev.value).toFixed(1)) : undefined

        // 10y yield (≈21 trading days lookback)
        const yObs = dgs10.observations ?? []
        const { cur: yCur, prev: yPrev } = nBack(yObs, 21)
        const yld = yCur?.value
        const yldDateFmt = fmtDay(yCur?.date)
        const yld1mChg = (yCur?.value != null && yPrev?.value != null) ? Number(((yCur.value - yPrev.value) * 100).toFixed(1)) : undefined // bps

        // S&P 500 (~1m % change)
        const sObs = sp500.observations ?? []
        const { cur: sCur, prev: sPrev } = nBack(sObs, 21)
        const spx = sCur?.value
        const spxDateFmt = fmtDay(sCur?.date)
        const spx1mPct = (sCur?.value != null && sPrev?.value != null && sPrev.value !== 0)
            ? Number((((sCur.value / sPrev.value) - 1) * 100).toFixed(2))
            : undefined

        // EUR/USD
        const latestFx = fxArr?.[fxArr.length - 1];
        const prevFx = fxArr?.[fxArr.length - 2];
        const eurusd = latestFx?.value;
        const fxChange = (eurusd != null && prevFx?.value != null)
            ? Number((eurusd - prevFx.value).toFixed(4))
            : undefined;
        const fxDateFmt = fmtDay(latestFx?.date);

        // ===== 1) FACTS: single compact line sent to the model (no instructions) =====
        const factLine =
            `CPI YoY ${pct(cpiYoY)} (${cpiDateFmt}); unemployment ${uLast?.value?.toFixed?.(1)}% (${unempDateFmt}, m/m ${unempMoM ?? 0}pp); ` +
            `10y ${yld?.toFixed?.(2)}% on ${yldDateFmt} (${yld1mChg != null ? (yld1mChg > 0 ? '+' : '') + yld1mChg + ' bps ~1m' : '1m n/a'}); ` +
            `S&P 500 ${spx?.toFixed?.(0)} on ${spxDateFmt} (${spx1mPct != null ? (spx1mPct > 0 ? '+' : '') + spx1mPct + '%' : '1m n/a'}); ` +
            `EUR/USD ${eurusd?.toFixed?.(4)} (${fxDateFmt}${fxChange != null ? `, d/d ${(fxChange > 0 ? '+' : '') + fxChange}` : ''}).`

        // ===== 2) ANALYSIS: deterministic sentence we control =====
        const bondsTone = (yld1mChg == null) ? 'mixed for bonds'
            : yld1mChg < 0 ? 'supportive for bond prices as yields fell'
                : 'a headwind for bond prices as yields rose'
        const equitiesTone = (spx1mPct == null) ? 'mixed for equities'
            : spx1mPct >= 0 ? 'constructive for equities'
                : 'soft for equities'
        const fxTone = (fxChange == null) ? ''
            : fxChange > 0 ? 'and a slightly weaker USD vs EUR'
                : 'and a slightly stronger USD vs EUR'

        const analysisSentence =
            `This mix suggests ${bondsTone} and ${equitiesTone}; for payments/FX, conditions point to ${fxTone || 'stable USD/EUR rates'} in the near term.`

        // Deterministic 2-sentence fallback (if model unavailable)
        const fallback =
            `In ${cpiDateFmt}, CPI inflation was ${pct(cpiYoY)} (index ${cpiIndex}); unemployment was ${unemp?.toFixed?.(1)}% in ${unempDateFmt} (${signWord(unempMoM)} ${Math.abs(unempMoM ?? 0)}pp m/m). ` +
            `The 10‑year Treasury yield was ${yld?.toFixed?.(2)}% on ${yldDateFmt} (${yld1mChg != null ? (yld1mChg > 0 ? '+' : '') + yld1mChg + ' bps over ~1m' : '1m change n/a'}), and the S&P 500 was ${spx?.toFixed?.(0)} on ${spxDateFmt} (${spx1mPct != null ? (spx1mPct > 0 ? '+' : '') + spx1mPct + '%' : '1m change n/a'}), which is ${bondsTone}, ${equitiesTone} ${fxTone}.`

        let summary = `${factLine} ${analysisSentence}`
        let source: 'model+deterministic' | 'deterministic' = 'deterministic'

        // Try to have the model compress the fact line into one clean sentence.
        // Try ML only if explicitly enabled; keep a strict timeout so the route never times out.
        if (ENABLE_LOCAL_SUMMARY) {
            try {
                const summarizer = await withTimeout(getSummarizer(), MODEL_TIMEOUT_MS, 'model-init-timeout');
                const out = await withTimeout(
                    summarizer('summarize: ' + factLine, { max_new_tokens: 60, min_length: 20 }),
                    MODEL_TIMEOUT_MS,
                    'model-run-timeout'
                );

                const text = Array.isArray(out) ? out[0]?.generated_text : undefined;
                const factSentence = (typeof text === 'string' ? text : '').replace(/\s+/g, ' ').trim();
                const one = factSentence.split(/(?<=[.!?])\s+/)[0]?.trim();
                const finalFact = one ? (/[.!?]$/.test(one) ? one : one + '.') : '';
                if (finalFact && finalFact.length > 30) {
                    summary = `${finalFact} ${analysisSentence}`.trim();
                    source = 'model+deterministic';
                } else {
                    summary = fallback;
                    source = 'deterministic';
                }
            } catch {
                // Any model issue: fall back without failing the route
                summary = fallback;
                source = 'deterministic';
            }
        } else {
            // Disabled in prod: just keep deterministic summary
            summary = `${factLine} ${analysisSentence}`.trim();
            source = 'deterministic';
        }

        return new NextResponse(
            JSON.stringify({
                summary,
                source,
                inputs: {
                    cpiYoY, cpiIndex, cpiDate: cpiDateFmt,
                    unemp: uLast?.value, unempDate: unempDateFmt, unempMoM,
                    yld, yld1mChg, yldDate: yldDateFmt,
                    spx, spx1mPct, spxDate: spxDateFmt,
                    eurusd, fxDate: fxDateFmt, fxChange,
                },
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400',
                    'X-Summary-Source': source,
                },
            },
        )
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: 'Failed to build summary', details: msg },
            { status: 500 },
        );
    }
}
