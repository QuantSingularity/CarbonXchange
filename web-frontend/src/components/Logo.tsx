import { cn } from "@/lib/utils";

export function Logo({
  className,
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M9 21C9 13 15 8 24 8C24 17 19 23 11 23C10 23 9.4 22.4 9 21Z"
          className="fill-primary-foreground"
        />
        <path
          d="M9.5 22.5L18 14"
          className="stroke-primary"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      {!markOnly && (
        <span className="font-display text-lg font-semibold tracking-tight">
          CarbonXchange
        </span>
      )}
    </span>
  );
}
