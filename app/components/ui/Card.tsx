// app/components/ui/Card.tsx

export function Card({
    children, className = '',
}: { children: React.ReactNode; className?: string }) {
    return (
        <section
            className={
                `rounded-2x1 border bg-white/70 dark:bg-zinc-900/60
                border-zinc-200/70 dark:border-zinc-800
                shadow-sm hover:shadow-md transition-shadow
                backdrop-blur-sm ${className}`
            }
        >
            {children}
        </section>
    );
}

export function CardHeader({
    title, asOf, right,
}: {title: string; asOf?: string; right?: React.ReactNode }) {
    return (
        <header className="flex items-center justify-between px-4 pt-3 pb-2">
            <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
                {asOf && (
                    <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400"> as of {asOf}</p>
                )}
            </div>
            {right}
        </header>
    );
}

export function CardBody({ children }: {children: React.ReactNode }) {
    return <div className="px-4 pb-4 pt-2">{children}</div>;
}