export const metadata = { title: "Methodology • MacroLens" };

export default function Methodology() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Methodology</h1>
      <section className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <div>
          <h2 className="font-semibold">Headline CPI (YoY)</h2>
          <p>
            Source: FRED series <code>CPIAUCSL</code> (seasonally adjusted). We compute
            year-over-year change as the percentage change of the latest index value versus the
            value 12 months prior. Unit: percent.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Unemployment Rate</h2>
          <p>
            Source: BLS series <code>LNS14000000</code> (U‑3, seasonally adjusted). We display the
            latest percent value and the month-over-month change in percentage points.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">EUR/USD</h2>
          <p>
            Source: ECB SDMX dataset <code>EXR</code>, key <code>D.USD.EUR.SP00.A</code> (daily USD
            per EUR, spot). We show the latest rate, day-over-day change, and a 30‑day sparkline.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Refresh & Caching</h2>
          <p>
            The homepage uses Incremental Static Regeneration (ISR) with a 1‑hour revalidation
            window. API routes apply cache headers to limit upstream calls.
          </p>
        </div>
      </section>
    </main>
  );
}
