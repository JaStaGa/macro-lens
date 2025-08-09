// app/lib/fetchers.ts
// Centralized server fetch helpers for RSC (server components)

export const REVALIDATE = 3600; // seconds

// ---------- Types ----------
export type Point = { date: string; value: number };
export type FredOut = { series: string; observations: Point[]; units?: string; frequency?: string };
export type BlsOut = { series: string; observations: Point[]; units: string; frequency: string };

// Minimal SDMX types (ECB)
export type SdmxTimeValue = { id?: string; name?: string };
export type SdmxObservationDim = { id?: string; values?: SdmxTimeValue[] };
export type SdmxJson = {
    dataSets?: Array<{ series?: Record<string, { observations?: Record<string, number[] | number> }> }>;
    structure?: { dimensions?: { observation?: SdmxObservationDim[] } };
};
export type Obs = { date: string; value: number };

// ---------- Helpers ----------
function isProdBuild() {
    // Next sets this during `next build`
    return process.env.NEXT_PHASE === 'phase-production-build';
}

async function safeJson<T>(res: Response): Promise<T | null> {
    try {
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

function origin() {
    // Prefer explicit base (set in .env.local and Vercel)
    const base = process.env.NEXT_PUBLIC_BASE_URL;
    if (base) return base.replace(/\/$/, '');

    // Fallback: Vercel env (no protocol)
    const vercel = process.env.VERCEL_URL;
    if (vercel) return `https://${vercel}`;

    // Local dev default
    const port = process.env.PORT || '3000';
    return `http://localhost:${port}`;
}

function makeUrl(path: string) {
    // Supports both '/api/...' and full URLs; ensures absolute
    return new URL(path, origin()).toString();
}

// ---------- Public fetchers ----------
export async function getCPI() {
    const res = await fetch(makeUrl('/api/fred?series=CPIAUCSL&limit=240'), {
        next: { revalidate: REVALIDATE },
    });

    if (!res.ok) {
        if (isProdBuild()) {
            return { series: 'CPIAUCSL', observations: [], units: undefined, frequency: undefined } as FredOut;
        }
        throw new Error(`CPI fetch failed: ${res.status}`);
    }

    const data = await safeJson<FredOut>(res);
    if (!data || !Array.isArray(data.observations)) {
        if (isProdBuild()) {
            return { series: 'CPIAUCSL', observations: [], units: undefined, frequency: undefined } as FredOut;
        }
        throw new Error('CPI bad payload');
    }
    return data;
}

export async function getUnemployment() {
    const res = await fetch(makeUrl('/api/bls?series=LNS14000000&limit=200'), {
        next: { revalidate: REVALIDATE },
    });

    if (!res.ok) {
        if (isProdBuild()) {
            return { series: 'LNS14000000', observations: [], units: 'percent', frequency: 'Monthly' } as BlsOut;
        }
        throw new Error(`BLS fetch failed: ${res.status}`);
    }

    const data = await safeJson<BlsOut>(res);
    if (!data || !Array.isArray(data.observations)) {
        if (isProdBuild()) {
            return { series: 'LNS14000000', observations: [], units: 'percent', frequency: 'Monthly' } as BlsOut;
        }
        throw new Error('BLS bad payload');
    }
    return data;
}

export async function getEurUsdLastN(n = 30) {
    const res = await fetch(
        makeUrl(`/api/ecb?flowRef=EXR&key=D.USD.EUR.SP00.A&lastNObservations=${n}`),
        { next: { revalidate: REVALIDATE } }
    );

    if (!res.ok) {
        // During build, don't throw — return empty so prerender succeeds.
        if (isProdBuild()) return [] as Obs[];
        throw new Error(`ECB fetch failed: ${res.status}`);
    }

    const j = await safeJson<SdmxJson>(res);
    if (!j) {
        if (isProdBuild()) return [] as Obs[];
        throw new Error('ECB bad payload');
    }

    return parseSdmxToSeries(j);
}

export async function getFredSeriesWindow(series: string, limit = 90, startDaysBack = 180) {
    const start = new Date();
    start.setDate(start.getDate() - startDaysBack);
    const startStr = start.toISOString().slice(0, 10);

    const res = await fetch(
        makeUrl(`/api/fred?series=${encodeURIComponent(series)}&limit=${limit}&start=${startStr}`),
        { next: { revalidate: REVALIDATE } }
    );

    if (!res.ok) {
        // During `next build`, do NOT throw — return an empty dataset so the page prerenders.
        if (isProdBuild()) {
            return { series, observations: [] as Point[], units: undefined, frequency: undefined } as FredOut;
        }
        throw new Error(`FRED ${series} fetch failed: ${res.status}`);
    }

    const data = await safeJson<FredOut>(res);
    if (!data || !Array.isArray(data.observations)) {
        if (isProdBuild()) {
            return { series, observations: [] as Point[], units: undefined, frequency: undefined } as FredOut;
        }
        throw new Error(`FRED ${series} bad payload`);
    }

    return data;
}

export async function getDGS10Window(limit = 90, startDaysBack = 180) {
    return getFredSeriesWindow('DGS10', limit, startDaysBack);
}

export async function getSP500Window(limit = 90, startDaysBack = 180) {
    return getFredSeriesWindow('SP500', limit, startDaysBack);
}

// ---------- SDMX parser (ECB) ----------
export function parseSdmxToSeries(j: SdmxJson | undefined): Obs[] {
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
        const label = timeValues[i]?.id || timeValues[i]?.name; // "2025-08-08" etc.
        const v = Array.isArray(arr) ? arr[0] : arr;
        const num = Number(v);
        if (label && Number.isFinite(num)) out.push({ date: label, value: num });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
