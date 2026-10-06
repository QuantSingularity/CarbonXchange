import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/StatusPieces";
import {
  apiErrorMessage,
  forecastApi,
  type ForecastStatus,
} from "@/services/api";
import { formatDateTime, formatNumber } from "@/lib/format";

type JobKey = "database" | "synthetic" | "demand";

export function AiModelsPanel() {
  const [status, setStatus] = useState<ForecastStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [running, setRunning] = useState<JobKey | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await forecastApi.status());
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load model status."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const train = async (job: JobKey) => {
    setRunning(job);
    try {
      if (job === "demand") {
        await forecastApi.train({ model: "demand" });
      } else {
        await forecastApi.train({
          model: "price",
          source: job,
          symbol:
            job === "database" && symbol.trim() ? symbol.trim() : undefined,
        });
      }
      toast.success("Training completed.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Training failed."));
    } finally {
      setRunning(null);
    }
  };

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!status) return null;

  const ensemble = status.price_model.metrics?.ensemble;
  const symbols = Object.entries(status.symbols);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price forecasting model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            label="Status"
            value={status.price_model.ready ? "Ready" : "Not trained"}
          />
          <Row
            label="Trained"
            value={formatDateTime(status.price_model.trained_at)}
          />
          <Row label="Source" value={status.price_model.source ?? "-"} />
          <Row
            label="Samples"
            value={formatNumber(status.price_model.samples ?? 0, 0)}
          />
          {ensemble && (
            <>
              <Row
                label="Directional accuracy"
                value={`${formatNumber(ensemble.directional_accuracy * 100, 1)}%`}
              />
              <Row
                label="Price MAPE"
                value={`${formatNumber(ensemble.price_mape, 2)}%`}
              />
              <Row
                label="Return R2"
                value={formatNumber(ensemble.return_r2, 3)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demand model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            label="Status"
            value={status.demand_model.ready ? "Ready" : "Not trained"}
          />
          <Row
            label="Trained"
            value={formatDateTime(status.demand_model.trained_at)}
          />
          <Row
            label="Samples"
            value={formatNumber(status.demand_model.samples ?? 0, 0)}
          />
          {status.demand_model.metrics && (
            <Row
              label="R2"
              value={formatNumber(status.demand_model.metrics.r2, 3)}
            />
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="train-symbol">
              Symbol <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="train-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Defaults to the deepest history"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={running !== null}
              onClick={() => train("database")}
            >
              {running === "database" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Train on market history
            </Button>
            <Button
              variant="outline"
              disabled={running !== null}
              onClick={() => train("synthetic")}
            >
              {running === "synthetic" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Train on synthetic data
            </Button>
            <Button
              variant="outline"
              disabled={running !== null}
              onClick={() => train("demand")}
            >
              {running === "demand" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Train demand model
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Forecasts need at least {status.min_history_points} daily
            observations per symbol. Synthetic training is for demos only.
          </p>
          {symbols.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {symbols.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSymbol(name)}
                  className="rounded-md border border-border px-2 py-1 font-mono-num hover:bg-secondary"
                >
                  {name} ({count})
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-num">{value}</span>
    </div>
  );
}

export default AiModelsPanel;
