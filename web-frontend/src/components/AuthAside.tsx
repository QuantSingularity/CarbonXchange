export function AuthAside({
  quote,
  caption,
}: {
  quote: string;
  caption: string;
}) {
  return (
    <div className="relative hidden overflow-hidden bg-rail lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.15]" />
      <div className="relative">
        <p className="font-mono-num text-xs uppercase tracking-wider text-rail-muted">
          CarbonXchange
        </p>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 400 220"
          className="w-full max-w-md"
          aria-hidden="true"
        >
          {[40, 90, 140, 190].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="400"
              y2={y}
              stroke="hsl(var(--rail-border))"
              strokeWidth="1"
            />
          ))}
          <path
            d="M0 190 C 60 180, 90 170, 130 150 S 190 110, 230 85 S 300 40, 340 20 S 390 5, 400 0"
            fill="none"
            stroke="hsl(var(--rail-accent))"
            strokeWidth="2.5"
            className="keeling-line"
            pathLength={1000}
          />
        </svg>
      </div>

      <div className="relative max-w-md">
        <p className="font-display text-2xl font-medium leading-snug text-rail-foreground">
          &ldquo;{quote}&rdquo;
        </p>
        <p className="mt-3 font-mono-num text-xs text-rail-muted">{caption}</p>
      </div>
    </div>
  );
}
