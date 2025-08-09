// app/api/summary/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 3600

type Point = { date: string; value: number }
type FredOut = { series: string; observations: Point[] }
type BlsOut = { series: string; observations: Point[] }
type EcbSdmx = {
    dataSets: Array<{ series: Record<string, { observations: Record<string, [number]> }> }>
    structure: { dimensions: { observation: Array<{ values: Array<{ name: string }> }> } }
}

let _summarizer: any | null = null
async function getSummarizer() {
    if (_summarizer) return _summarizer
    const { pipeline } = await import('@xenova/transformers')
    _summarizer = await pipeline('text2text-generation', 'Xenova/t5-small');
    return _summarizer
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
    if (!arr.length) return { i: -1, j: -1 }
    const i = arr.length - 1
    const j = Math.max(0, i - n)
    return { cur: (arr as any)[i], prev: (arr as any)[j], i, j }
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
        const base = baseUrlFromEnv(req.headers)

        // Keep FRED payloads small
        const now = new Date()
        const startMonthly = new Date(now); startMonthly.setMonth(startMonthly.getMonth() - 240) // ~20y CPI
        const startDaily = new Date(now); startDaily.setDate(startDaily.getDate() - 180) // ~6m DGS10/SP500
        const fmt = (d: Date) => d.toISOString().slice(0, 10)

        // URLs
        const fredCpiUrl = `${base}/api/fred?series=CPIAUCSL&limit=240&start=${fmt(startMonthly)}`
        const blsUrl = `${base}/api/bls?series=LNS14000000&limit=24`
        const fredDgs10Url = `${base}/api/fred?series=DGS10&limit=90&start=${fmt(startDaily)}`
        const fredSp500Url = `${base}/api/fred?series=SP500&limit=90&start=${fmt(startDaily)}`
        const ecbUrl = `${base}/api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=2`

        const [cpiRes, blsRes, dgsRes, spxRes, ecbRes] = await Promise.all([
            fetch(fredCpiUrl, { next: { revalidate } }),
            fetch(blsUrl, { next: { revalidate } }),
            fetch(fredDgs10Url, { next: { revalidate } }),
            fetch(fredSp500Url, { next: { revalidate } }),
            fetch(ecbUrl, { next: { revalidate } }),
        ])
        if (![cpiRes, blsRes, dgsRes, spxRes, ecbRes].every(r => r.ok)) {
            throw new Error(`Upstream KPI routes failed (cpi:${cpiRes.status} bls:${blsRes.status} dgs10:${dgsRes.status} sp500:${spxRes.status} ecb:${ecbRes.status})`)
        }

        const cpi: FredOut = await cpiRes.json()
        const bls: BlsOut = await blsRes.json()
        const dgs10: FredOut = await dgsRes.json()
        const sp500: FredOut = await spxRes.json()
        const ecbRaw: EcbSdmx = await ecbRes.json()

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
        const fx = parseEcbEurUsd(ecbRaw)
        const eurusd = fx.value
        const fxPrev = fx.prev
        const fxChange = (eurusd != null && fxPrev != null) ? Number((eurusd - fxPrev).toFixed(4)) : undefined
        const fxDateFmt = fmtDay(fx.date)

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
        try {
            const summarizer = await getSummarizer()
            const out = await summarizer('summarize: ' + factLine, { max_new_tokens: 60, min_length: 20 })
            const text = Array.isArray(out) ? out[0]?.summary_text : out?.summary_text
            const factSentence = (typeof text === 'string' ? text : '').replace(/\s+/g, ' ').trim()
            // Guardrails: ensure it's one sentence ending with punctuation
            const one = factSentence.split(/(?<=[.!?])\s+/)[0]?.trim()
            const finalFact = one ? (/[.!?]$/.test(one) ? one : one + '.') : ''
            if (finalFact && finalFact.length > 30) {
                summary = `${finalFact} ${analysisSentence}`.trim()
                source = 'model+deterministic'
            } else {
                summary = fallback
                source = 'deterministic'
            }
        } catch {
            // Model not available or failed — use deterministic text
            summary = fallback
            source = 'deterministic'
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
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Failed to build summary', details: err?.message ?? String(err) },
            { status: 500 },
        )
    }
}
