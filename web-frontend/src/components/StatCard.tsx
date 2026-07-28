import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: string;
  tone?: "neutral" | "gain" | "loss";
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <p className="mt-2 font-mono-num text-2xl font-semibold tracking-tight">
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              tone === "gain" && "text-gain",
              tone === "loss" && "text-loss",
              tone === "neutral" && "text-muted-foreground",
            )}
          >
            {trend}
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
