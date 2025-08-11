export const revalidate = 3600; // revalidate the page every hour

import CpiCard from "./components/CpiCard";
import UnemploymentCard from "./components/UnemploymentCard";
import EcbFxCard from "./components/EcbFxCard";
import SummaryCard from "./components/SummaryCard";
import Yield10yCard from "./components/Yield10yCard";
import Sp500Card from "./components/Sp500Card";
import ChatDockServer from './components/ChatDockServer';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-start mb-6 gap-4">
        <h1 className="text-2xl font-bold">MacroLens</h1>
        <Link
          href="/about"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          About
        </Link>
      </div>
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
      <ChatDockServer />
    </main>
  );
}