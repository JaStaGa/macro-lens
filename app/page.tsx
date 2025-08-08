import CpiCard from "./components/CpiCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">MacroLens</h1>
      <p className="text-gray-600 dark:text-gray-300">
        Key macro indicators, updated automatically.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CpiCard />
      </div>
    </main>
  );
}
