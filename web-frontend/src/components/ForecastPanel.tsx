import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiErrorCode,
  apiErrorMessage,
  forecastApi,
  type PriceForecast,
} from "@/services/api";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

const HORIZONS = [7, 14, 30];

interface ChartPoint {
  label: string;
  price: number;
  band: [number, number];
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ForecastPanel({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState(7);
  const [forecast, setForecast] = useState<PriceForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const target = symbol.trim();
    if (!target) {
      setForecast(null);
      setMessage(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    forecastApi
      .price(target, { horizon })
      .then((result) => {
        if (!cancelled) setForecast(result);
      })
      .catch((error) => {
        if (cancelled) return;
        setForecast(null);
        const code = apiErrorCode(error);
        if (code === "model_unavailable") {
          setMessage("The forecasting model has not been trained yet.");
        } else if (code === "insufficient_data") {
          setMessage(apiErrorMessage(error));
        } else {
          setMessage(apiErrorMessage(error, "We couldn't load a forecast."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, horizon]);

  const data = useMemo<ChartPoint[]>(() => {
    if (!forecast) return [];
    const start: ChartPoint = {
      label: "Now",
      price: forecast.current_price,
      band: [forecast.current_price, forecast.current_price],
    };
    return [
      start,
      ...forecast.predictions.map((point) => ({
        label: shortDate(point.timestamp),
        price: point.predicted_price,
        band: [point.lower, point.upper] as [number, number],
      })),
    ];
  }, [forecast]);

  const trend = forecast?.trend ?? "neutral";
  const TrendIcon =
    trend === "bullish"
      ? TrendingUp
      : trend === "bearish"
        ? TrendingDown
        : Minus;
  const last = forecast?.predictions[forecast.predictions.length - 1];
  const accuracy = forecast?.model_info.directional_accuracy;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Price forecast
        </CardTitle>
        <div className="flex gap-1">
          {HORIZONS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={horizon === value ? "default" : "outline"}
              onClick={() => setHorizon(value)}
            >
              {value}d
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading && !forecast ? (
          <Skeleton className="h-56 w-full" />
        ) : message ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {message}
          </p>
        ) : forecast && last ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  Projected in {forecast.horizon}d
                </p>
                <p className="font-mono-num text-xl font-semibold">
                  {formatCurrency(last.predicted_price)}
                </p>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 font-mono-num text-sm font-medium",
                  trend === "bullish" && "text-gain",
                  trend === "bearish" && "text-loss",
                  trend === "neutral" && "text-muted-foreground",
                )}
              >
                <TrendIcon className="h-4 w-4" />
                {forecast.expected_return_pct >= 0 ? "+" : ""}
                {formatNumber(forecast.expected_return_pct, 2)}% {trend}
              </div>
              <div className="text-xs text-muted-foreground">
                95% range {formatCurrency(last.lower)} to{" "}
                {formatCurrency(last.upper)}
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) => formatNumber(v, 2)}
                  />
                  <Tooltip
                    formatter={(value: number | number[], name: string) =>
                      Array.isArray(value)
                        ? [
                            `${formatCurrency(value[0])} to ${formatCurrency(value[1])}`,
                            "95% range",
                          ]
                        : [
                            formatCurrency(value),
                            name === "price" ? "Forecast" : name,
                          ]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="band"
                    stroke="none"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.15}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs text-muted-foreground">
              {forecast.engine === "ai_ensemble"
                ? "AI ensemble"
                : forecast.model}{" "}
              trained {formatDateTime(forecast.model_info.trained_at)} on{" "}
              {formatNumber(forecast.model_info.training_samples ?? 0, 0)}{" "}
              observations.
              {typeof accuracy === "number" &&
                ` Holdout directional accuracy ${formatNumber(accuracy * 100, 1)}%.`}{" "}
              Statistical estimate only, not financial advice.
            </p>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No forecast available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ForecastPanel;
