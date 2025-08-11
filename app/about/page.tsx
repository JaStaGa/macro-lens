// app/about/page.tsx
import Link from "next/link";

export default function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-10 text-zinc-800 dark:text-zinc-200">
            <div className="flex items-center justify-start mb-6 gap-4">
                <h1 className="text-2xl font-bold">MacroLens</h1>
                <Link
                    href="/"
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    Home
                </Link>
            </div>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-3">What MacroLens Shows You</h2>
                <p className="mb-3">
                    MacroLens is your at-a-glance dashboard for key U.S. and global macroeconomic
                    indicators — the numbers that move markets and influence economic decisions.
                    The app presents each data point in a clean, consistent card layout, showing:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Headline CPI (YoY)</strong> – Year-over-year change in the Consumer Price Index. Higher values mean inflation is rising; lower values suggest inflation is cooling.</li>
                    <li><strong>Unemployment Rate (U-3, SA)</strong> – Percentage of the labor force that is jobless and actively seeking work. Rising unemployment can signal economic weakness.</li>
                    <li><strong>US 10-Year Treasury Yield</strong> – A key benchmark interest rate watched by investors, policymakers, and economists. Changes are shown in basis points (~1/100th of a percent).</li>
                    <li><strong>S&amp;P 500 Index</strong> – A broad measure of U.S. equity market performance, tracking 500 large-cap companies.</li>
                    <li><strong>EUR/USD Exchange Rate</strong> – Daily spot rate from the European Central Bank, showing how many U.S. dollars one euro buys.</li>
                </ul>
                <p className="mt-3">
                    Each card uses color-coded changes so you can quickly tell whether the latest
                    movement is typically positive or negative for the economy or markets.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-3">Where the Data Comes From</h2>
                <p className="mb-3">
                    MacroLens pulls its data directly from trusted public sources via official APIs:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>CPI &amp; Unemployment:</strong> U.S. Bureau of Labor Statistics (BLS) via the FRED API.</li>
                    <li><strong>US 10-Year Treasury Yield:</strong> U.S. Department of the Treasury via the FRED API.</li>
                    <li><strong>S&amp;P 500 Index:</strong> Federal Reserve Economic Data (FRED).</li>
                    <li><strong>EUR/USD Exchange Rate:</strong> European Central Bank (ECB) daily reference rates.</li>
                </ul>
                <p className="mt-3">
                    Data is refreshed on page load and reflects the most recent available figures
                    from each source. Any delays or revisions are due to the publishing schedule
                    of the respective institutions.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-3">How the AI Overview Works</h2>
                <p className="mb-3">
                    At the top of the dashboard, you’ll see an AI-generated overview summarizing
                    the latest macro data. This uses the <strong>system prompt</strong> + the
                    real-time data context to create a concise, plain-English interpretation of
                    current economic conditions.
                </p>
                <p className="mb-3">
                    If WebGPU is supported in your browser, the AI runs entirely in your browser
                    using <strong>WebLLM</strong>, meaning your data never leaves your device for processing.
                    If WebGPU isn’t available, MacroLens falls back to a basic rules-based
                    interpretation of the numbers.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-3">Chat About the Data</h2>
                <p className="mb-3">
                    The chat feature lets you ask follow-up questions like:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>“Why might the 10-year yield drop even if inflation rises?”</li>
                    <li>“If EUR/USD rises, what does that mean for U.S. importers?”</li>
                </ul>
                <p className="mt-3">
                    If WebLLM is active, the AI considers your question along with the latest
                    macro data to give an informed, conversational answer. While accurate, responses
                    should be taken as general information — not financial advice.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-3">How MacroLens Was Built</h2>
                <p className="mb-3">
                    This app was built with <strong>Next.js</strong> for the frontend, styled with
                    <strong> Tailwind CSS</strong>, and deployed on <strong>Vercel</strong>. Data
                    fetching is done with server components to pull the latest statistics directly
                    from public APIs. Cards are styled for clarity, using semantic colors to help
                    interpret changes at a glance.
                </p>
                <p className="mb-3">
                    The AI functionality is powered by <strong>@mlc-ai/web-llm</strong> running
                    entirely in-browser when possible, with a fallback to a local rules-based
                    system for quick, offline-compatible answers.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-3">Disclaimer</h2>
                <p>
                    All content is for informational purposes only and should not be taken as
                    investment, financial, or economic advice. Always verify figures with the
                    original data sources before making decisions.
                </p>
            </section>
        </div>
    );
}
