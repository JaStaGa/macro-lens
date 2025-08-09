import { describe, it, expect } from 'vitest';
import { yoy, nBackIdx } from '../app/lib/math';

describe('math helpers', () => {
    it('yoy computes percent change vs 12 months prior', () => {
        const arr = Array.from({ length: 13 }, (_, k) => ({ date: `2024-${k + 1}`, value: 100 + k }));
        const y = yoy(arr)!;
        expect(Math.round(y * 100) / 100).toBeCloseTo(((112 / 100) - 1) * 100, 5);
    });

    it('nBackIdx returns last and 21-back indices', () => {
        const { i, j } = nBackIdx(100, 21);
        expect(i).toBe(99);
        expect(j).toBe(78);
    });
});
