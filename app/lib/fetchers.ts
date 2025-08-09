// app/lib/fetchers.ts
// Server-side data fetchers for RSC that call upstream providers directly (no /api/* indirection)

export const REVALIDATE = 3600; // seconds

// ---------- Types ----------
export type Point = { date: string; value: number };
export type FredOut = { series: string; observations: Point[]; units?: string; frequency?: string };
export type BlsOut = { series: string; observations: Point[]; units: string; frequency: string };

// Minimal SDMX types (ECB)
type SdmxTimeValue = { id?: string; name?: string };
type SdmxObservationDim = { id?: string; values?: SdmxTimeValue[] };
type SdmxJson = {
    dataSets?: Array<{ series?: Record<string, { observations?: Record<string, number[] | number> }> }>;
    structure?: { dimensions?: { observation?: SdmxObservationDim[] } };
};
export type Obs = { date: string; value: number };

// ---------- Helpers ----------
function inBuildPrerender() {
    // During `next build` / ISR prerender there is no live request context.
    // We cannot rely on headers(); keep this stable and simple.
    return process.env.NEXT_PHASE === 'phase-production-build';
}
async function safeJson<T>(res: Response): Promise<T | null> {
    try { return (await res.json()) as T; } catch { return null; }
}

// ---------- FRED (direct) ----------
async function fetchFredSeries(series: string, startISO?: string) {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) throw new Error('Server missing FRED_API_KEY');

    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', series);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    if (startISO) url.searchParams.set('observation_start', startISO);

    const res = await fetch(url.toString(), { next: { revalidate: REVALIDATE } });
    if (!res.ok) throw new Error(`FRED ${series} error: ${res.status}`);

    const raw = await safeJson<{ observations?: Array<{ date: string; value: string }>; units?: string; frequency?: string }>(res);
    if (!raw || !Array.isArray(raw.observations)) throw new Error(`FRED ${series} bad payload`);

    const observations: Point[] = raw.observations
        .map(o => (o.value === '.' ? null : { date: o.date, value: Number(o.value) }))
        .filter((p): p is Point => !!p && Number.isFinite(p.value));

    return { series, observations, units: raw.units, frequency: raw.frequency } as FredOut;
}

export async function getCPI(): Promise<FredOut> {
    try {
        // ~20y window to keep payload bounded
        const start = new Date(); start.setMonth(start.getMonth() - 240);
        return await fetchFredSeries('CPIAUCSL', start.toISOString().slice(0, 10));
    } catch (e) {
        if (inBuildPrerender()) {
            return { series: 'CPIAUCSL', observations: [], units: undefined, frequency: undefined };
        }
        throw e;
    }
}

export async function getFredSeriesWindow(series: string, limit = 90, startDaysBack = 180): Promise<FredOut> {
    try {
        const start = new Date(); start.setDate(start.getDate() - startDaysBack);
        const out = await fetchFredSeries(series, start.toISOString().slice(0, 10));
        // respect limit from the tail
        const obs = out.observations.slice(-Math.max(1, limit));
        return { ...out, observations: obs };
    } catch (e) {
        if (inBuildPrerender()) {
            return { series, observations: [], units: undefined, frequency: undefined };
        }
        throw e;
    }
}

export async function getDGS10Window(limit = 90, startDaysBack = 180) {
    return getFredSeriesWindow('DGS10', limit, startDaysBack);
}

export async function getSP500Window(limit = 90, startDaysBack = 180) {
    return getFredSeriesWindow('SP500', limit, startDaysBack);
}

// ---------- BLS (direct) ----------
export async function getUnemployment(): Promise<BlsOut> {
    try {
        const body: { seriesid: string[]; registrationkey?: string } = { seriesid: ['LNS14000000'] };
        if (process.env.BLS_API_KEY) body.registrationkey = process.env.BLS_API_KEY;

        const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            next: { revalidate: REVALIDATE },
        });
        if (!res.ok) throw new Error(`BLS error: ${res.status}`);

        const raw = await safeJson<{ Results?: { series?: Array<{ data: Array<{ year: string; period: string; value: string }> }> } }>(res);
        const arr = raw?.Results?.series?.[0]?.data ?? [];

        const all: Point[] = arr
            .map(d => {
                const m = (d.period || '').replace('M', '');
                if (!/^\d{2}$/.test(m)) return null;
                const date = `${d.year}-${m.padStart(2, '0')}-01`;
                const value = Number(d.value);
                return Number.isFinite(value) ? { date, value } : null;
            })
            .filter((p): p is Point => p !== null)
            .reverse();

        return { series: 'LNS14000000', observations: all, lastUpdated: new Date().toISOString(), units: 'percent', frequency: 'Monthly' } as unknown as BlsOut;
    } catch (e) {
        if (inBuildPrerender()) {
            return { series: 'LNS14000000', observations: [], units: 'percent', frequency: 'Monthly' };
        }
        throw e;
    }
}

// ---------- ECB (direct) ----------
export async function getEurUsdLastN(n = 30): Promise<Obs[]> {
    try {
        const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=sdmx-json&lastNObservations=${n}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: REVALIDATE } });
        if (!res.ok) throw new Error(`ECB error: ${res.status}`);
        const j = await safeJson<SdmxJson>(res);
        if (!j) throw new Error('ECB bad payload');
        return parseSdmxToSeries(j);
    } catch (e) {
        if (inBuildPrerender()) return [];
        throw e;
    }
}

function parseSdmxToSeries(j: SdmxJson | undefined): Obs[] {
    const ds = j?.dataSets?.[0];
    const seriesMap = ds?.series;
    if (!seriesMap) return [];
    const firstKey = Object.keys(seriesMap)[0];
    const observations = seriesMap[firstKey]?.observations;
    if (!observations) return [];
    const obsDims = j?.structure?.dimensions?.observation ?? [];
    const timeDim = obsDims.find((d) => d?.id === 'TIME_PERIOD') ?? obsDims[0] ?? { values: [] };
    const timeValues = timeDim.values ?? [];

    const out: Obs[] = [];
    for (const [idxStr, arr] of Object.entries(observations as Record<string, number[] | number>)) {
        const i = Number(idxStr);
        const label = timeValues[i]?.id || timeValues[i]?.name;
        const v = Array.isArray(arr) ? arr[0] : arr;
        const num = Number(v);
        if (label && Number.isFinite(num)) out.push({ date: label, value: num });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
