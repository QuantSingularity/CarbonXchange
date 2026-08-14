import type { LucideIcon } from "lucide-react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { explorerTxUrl, shortenHex } from "@/lib/blockchain";
import { humanize, statusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", statusTone(status), className)}
    >
      {humanize(status)}
    </Badge>
  );
}

/**
 * Shows whether a credit has been tokenized on-chain. When a tx hash is
 * available, the badge links out to the configured block explorer (see
 * src/lib/blockchain.ts) so anyone can independently verify the issuance
 * transaction - the platform's operator wallet is the sole on-chain actor
 * (custodial model), so this is a transparency/audit link, not a
 * wallet-connect action.
 */
export function OnChainBadge({
  isTokenized,
  txHash,
  className,
}: {
  isTokenized?: boolean;
  txHash?: string | null;
  className?: string;
}) {
  if (!isTokenized) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 font-normal text-muted-foreground bg-muted border-border",
          className,
        )}
      >
        Not yet on-chain
      </Badge>
    );
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal text-gain bg-gain/10 border-gain/20",
        className,
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      Verified on-chain
    </Badge>
  );

  if (!txHash) return badge;

  return (
    <a
      href={explorerTxUrl(txHash)}
      target="_blank"
      rel="noreferrer noopener"
      title={`View transaction ${shortenHex(txHash)} on the block explorer`}
      className="inline-flex items-center gap-1 hover:opacity-80"
    >
      {badge}
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </a>
  );
}

export function ErrorState({
  title = "Couldn't load this data",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <p className="font-medium text-destructive">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
