export type Point = { date: string; value: number };

export function yoy(points: Point[]) {
    if (points.length < 13) return undefined;
    const a = points.at(-1)!.value;
    const b = points.at(-13)!.value;
    if (!isFinite(a) || !isFinite(b) || b === 0) return undefined;
    return ((a / b) - 1) * 100;
}

export function nBackIdx(len: number, n: number) {
    if (len <= 0) return { i: -1, j: -1 };
    const i = len - 1;
    const j = Math.max(0, i - n);
    return { i, j };
}
