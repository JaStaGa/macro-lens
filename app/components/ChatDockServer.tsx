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
function nBack<T>(arr: T[], n: number) {
    const i = Math.max(0, arr.length - 1), j = Math.max(0, i - n);
    return { cur: (arr as any)[i], prev: (arr as any)[j] } as { cur?: any; prev?: any };
}

export default async function ChatDockServer() {
    // Pull compact facts for the bot’s system prompt
    const [cpi, u, y10, spx, fx] = await Promise.all([
        getCPI(),
        getUnemployment(),
        getDGS10Window(90, 180),
        getSP500Window(90, 180),
        getEurUsdLastN(2),
    ]);

    const cpiYoY = yoy(cpi.observations ?? []);
    const cpiDate = fmtMonth(cpi.observations.at(-1)?.date);

    const uLast = u.observations.at(-1);
    const uPrev = u.observations.at(-2);
    const uMom = uLast && uPrev ? Number((uLast.value - uPrev.value).toFixed(1)) : undefined;
    const uDate = fmtMonth(uLast?.date);

    const { cur: yCur, prev: yPrev } = nBack(y10.observations ?? [], 21);
    const yDate = fmtDay(yCur?.date);
    const y1mBps = yCur?.value != null && yPrev?.value != null
        ? Number(((yCur.value - yPrev.value) * 100).toFixed(1)) : undefined;

    const { cur: sCur, prev: sPrev } = nBack(spx.observations ?? [], 21);
    const sDate = fmtDay(sCur?.date);
    const s1mPct = sCur?.value && sPrev?.value ? Number((((sCur.value / sPrev.value) - 1) * 100).toFixed(2)) : undefined;

    const fxLatest = fx.at(-1);
    const fxPrev = fx.at(-2);
    const fxDate = fmtDay(fxLatest?.date);
    const fxChg = fxLatest?.value != null && fxPrev?.value != null
        ? Number((fxLatest.value - fxPrev.value).toFixed(4)) : undefined;

    // A tight, factual context the bot can use verbatim
    const context =
        `Data snapshot:` +
        ` CPI YoY ${cpiYoY?.toFixed?.(2) ?? 'n/a'}% (${cpiDate});` +
        ` Unemployment ${uLast?.value?.toFixed?.(1) ?? 'n/a'}% (${uDate}, m/m ${uMom ?? 0}pp);` +
        ` 10y ${yCur?.value?.toFixed?.(2) ?? 'n/a'}% (${yDate}, ~1m ${y1mBps != null ? (y1mBps > 0 ? '+' : '') + y1mBps + ' bps' : 'n/a'});` +
        ` S&P 500 ${sCur?.value?.toFixed?.(0) ?? 'n/a'} (${sDate}, ~1m ${s1mPct != null ? (s1mPct > 0 ? '+' : '') + s1mPct + '%' : 'n/a'});` +
        ` EUR/USD ${fxLatest?.value?.toFixed?.(4) ?? 'n/a'} (${fxDate}, d/d ${fxChg != null ? (fxChg > 0 ? '+' : '') + fxChg : 'n/a'}).`;

    // Lightweight guardrails for the assistant
    const system =
        `You are MacroLens Chat, a factual assistant.` +
        ` You answer questions about CPI, unemployment, 10y yields, S&P 500, and EUR/USD.` +
        ` Use the provided "Data snapshot" as your primary source.` +
        ` Explain clearly and avoid advice; instead say "generally means" or "can imply".` +
        ` If asked about the future, be cautious and tie reasoning to the data.` +
        ` If the user asks anything outside that scope, say it's out of scope.`;

    return <ChatDock systemPrompt={system} dataContext={context} />;
}
