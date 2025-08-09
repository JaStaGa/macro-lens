export const revalidate = 3600; // revalidate the page every hour

import CpiCard from "./components/CpiCard";
import UnemploymentCard from "./components/UnemploymentCard";
import EcbFxCard from "./components/EcbFxCard";
import SummaryCard from "./components/SummaryCard";
import Yield10yCard from "./components/Yield10yCard";
import Sp500Card from "./components/Sp500Card";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">MacroLens</h1>
      <p className="text-gray-600 dark:text-gray-300">
        Key macro indicators, updated automatically.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CpiCard />
        <UnemploymentCard />
        <EcbFxCard />
        <Yield10yCard />
        <Sp500Card />
      </div>
      <SummaryCard />
    </main>
  );
}