// app/components/ChatDockServer.tsx
import {
    getCPI,
    getUnemployment,
    getDGS10Window,
    getSP500Window,
    getEurUsdLastN,
    type Point,
} from '@/app/lib/fetchers';
import ChatDock from './ChatDock';

function fmtMonth(dateISO?: string) {
    if (!dateISO) return '';
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}
function fmtDay(dateISO?: string) {
    if (!dateISO) return '';
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function yoy(points: Point[]) {
    if (points.length < 13) return undefined;
    const a = points.at(-1)!.value, b = points.at(-13)!.value;
    return b ? ((a / b) - 1) * 100 : undefined;
}
type DatedVal = { date: string; value: number };
function nBack<T extends DatedVal>(arr: T[], n: number) {
    if (arr.length === 0) return { cur: undefined as T | undefined, prev: undefined as T | undefined };
    const i = arr.length - 1;
    const j = Math.max(0, i - n);
    return { cur: arr[i], prev: arr[j] };
}

export type DataFacts = {
    cpi: { yoy?: number; index?: number; date: string };
    unemployment: { level?: number; mom_pp?: number; date: string };
    y10: { level?: number; d1m_bps?: number; date: string };
    spx: { level?: number; d1m_pct?: number; date: string };
    eurusd: { level?: number; d1d?: number; date: string };
};

export default async function ChatDockServer() {
    const [cpi, u, y10, spx, fx] = await Promise.all([
        getCPI(),
        getUnemployment(),
        getDGS10Window(90, 180),
        getSP500Window(90, 180),
        getEurUsdLastN(2),
    ]);

    // CPI
    const cpiYoY = yoy(cpi.observations ?? []);
    const cpiLast = cpi.observations.at(-1);
    const cpiDate = fmtMonth(cpiLast?.date);

    // Unemployment
    const uLast = u.observations.at(-1);
    const uPrev = u.observations.at(-2);
    const uMom = uLast && uPrev ? Number((uLast.value - uPrev.value).toFixed(1)) : undefined;
    const uDate = fmtMonth(uLast?.date);

    // 10y
    const { cur: yCur, prev: yPrev } = nBack(y10.observations ?? [], 21);
    const yDate = fmtDay(yCur?.date);
    const y1mBps = yCur?.value != null && yPrev?.value != null
        ? Number(((yCur.value - yPrev.value) * 100).toFixed(1))
        : undefined;

    // SPX
    const { cur: sCur, prev: sPrev } = nBack(spx.observations ?? [], 21);
    const sDate = fmtDay(sCur?.date);
    const s1mPct = sCur?.value != null && sPrev?.value != null && sPrev.value !== 0
        ? Number((((sCur.value / sPrev.value) - 1) * 100).toFixed(2))
        : undefined;

    // FX
    const fxLatest = fx.at(-1);
    const fxPrev = fx.at(-2);
    const fxDate = fmtDay(fxLatest?.date);
    const fxChg = fxLatest?.value != null && fxPrev?.value != null
        ? Number((fxLatest.value - fxPrev.value).toFixed(4))
        : undefined;

    // Text context for the model (kept)
    const context =
        `Data snapshot: ` +
        `CPI YoY ${cpiYoY?.toFixed?.(2) ?? 'n/a'}% (${cpiDate}); ` +
        `Unemployment ${uLast?.value?.toFixed?.(1) ?? 'n/a'}% (${uDate}, m/m ${uMom ?? 0}pp); ` +
        `10y ${yCur?.value?.toFixed?.(2) ?? 'n/a'}% (${yDate}, ~1m ${y1mBps != null ? (y1mBps > 0 ? '+' : '') + y1mBps + ' bps' : 'n/a'}); ` +
        `S&P 500 ${sCur?.value?.toFixed?.(0) ?? 'n/a'} (${sDate}, ~1m ${s1mPct != null ? (s1mPct > 0 ? '+' : '') + s1mPct + '%' : 'n/a'}); ` +
        `EUR/USD ${fxLatest?.value?.toFixed?.(4) ?? 'n/a'} (${fxDate}, d/d ${fxChg != null ? (fxChg > 0 ? '+' : '') + fxChg : 'n/a'}).`;

    // Machine-usable facts for smarter fallback
    const dataFacts: DataFacts = {
        cpi: { yoy: cpiYoY, index: cpiLast?.value, date: cpiDate },
        unemployment: { level: uLast?.value, mom_pp: uMom, date: uDate },
        y10: { level: yCur?.value, d1m_bps: y1mBps, date: yDate },
        spx: { level: sCur?.value, d1m_pct: s1mPct, date: sDate },
        eurusd: { level: fxLatest?.value, d1d: fxChg, date: fxDate },
    };

    // Stronger, compact system guidance
    const system =
        `You are MacroLens Chat, a cautious, factual assistant. ` +
        `Use the "Data snapshot" and answer in 3 short parts:\n` +
        `1) Plain-English takeaway in ≤2 sentences for non-experts.\n` +
        `2) What that generally means for bonds/equities or payments/FX when relevant.\n` +
        `3) Cite the key numbers + dates you used (concise).\n` +
        `Avoid advice; say “can imply” or “generally means”. If out-of-scope, say so.`;

    return <ChatDock systemPrompt={system} dataContext={context} dataFacts={dataFacts} />;
}
