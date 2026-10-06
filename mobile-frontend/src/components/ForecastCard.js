import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Polygon, Polyline } from "react-native-svg";
import Card from "./Card";
import { apiErrorCode, apiErrorMessage, forecastApi } from "../services/api";
import { formatCurrency, formatNumber } from "../utils/format";
import theme from "../styles/theme";

const HORIZONS = [7, 14, 30];
const CHART_HEIGHT = 110;

const ForecastCard = ({ symbol }) => {
  const [horizon, setHorizon] = useState(7);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const target = (symbol || "").trim();
    if (!target) {
      setForecast(null);
      setMessage(null);
      return undefined;
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
        if (apiErrorCode(error) === "model_unavailable") {
          setMessage("The forecasting model has not been trained yet.");
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

  const chart = useMemo(() => {
    if (!forecast || width <= 0) return null;
    const points = forecast.predictions;
    const prices = [
      forecast.current_price,
      ...points.map((p) => p.predicted_price),
    ];
    const lower = [forecast.current_price, ...points.map((p) => p.lower)];
    const upper = [forecast.current_price, ...points.map((p) => p.upper)];
    const min = Math.min(...lower);
    const max = Math.max(...upper);
    const span = max - min || 1;
    const stepX = width / Math.max(prices.length - 1, 1);
    const toY = (value) => CHART_HEIGHT - ((value - min) / span) * CHART_HEIGHT;
    const line = prices.map((v, i) => `${i * stepX},${toY(v)}`).join(" ");
    const band = [
      ...upper.map((v, i) => `${i * stepX},${toY(v)}`),
      ...lower.map((v, i) => `${i * stepX},${toY(v)}`).reverse(),
    ].join(" ");
    return { line, band };
  }, [forecast, width]);

  if (!(symbol || "").trim()) return null;

  const last = forecast
    ? forecast.predictions[forecast.predictions.length - 1]
    : null;
  const trendColor =
    forecast?.trend === "bullish"
      ? theme.colors.gain
      : forecast?.trend === "bearish"
        ? theme.colors.loss
        : theme.colors.textSecondary;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Price forecast</Text>
        <View style={styles.chips}>
          {HORIZONS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setHorizon(value)}
              style={[styles.chip, horizon === value && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  horizon === value && styles.chipTextActive,
                ]}
              >
                {value}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && !forecast ? (
        <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
      ) : message ? (
        <Text style={styles.empty}>{message}</Text>
      ) : forecast && last ? (
        <View>
          <View style={styles.summary}>
            <View>
              <Text style={styles.label}>Projected in {forecast.horizon}d</Text>
              <Text style={styles.value}>
                {formatCurrency(last.predicted_price)}
              </Text>
            </View>
            <Text style={[styles.trend, { color: trendColor }]}>
              {forecast.expected_return_pct >= 0 ? "+" : ""}
              {formatNumber(forecast.expected_return_pct, 2)}% {forecast.trend}
            </Text>
          </View>
          <Text style={styles.label}>
            95% range {formatCurrency(last.lower)} to{" "}
            {formatCurrency(last.upper)}
          </Text>
          <View
            style={styles.chart}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          >
            {chart && (
              <Svg width={width} height={CHART_HEIGHT}>
                <Polygon
                  points={chart.band}
                  fill={theme.colors.primary}
                  fillOpacity={0.15}
                />
                <Polyline
                  points={chart.line}
                  fill="none"
                  stroke={theme.colors.primary}
                  strokeWidth={2}
                />
              </Svg>
            )}
          </View>
          <Text style={styles.footnote}>
            Statistical estimate only, not financial advice.
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>No forecast available.</Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: theme.spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: { fontSize: 12, color: theme.colors.textSecondary },
  chipTextActive: { color: "#fff" },
  loader: { paddingVertical: theme.spacing.lg },
  empty: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: "center",
    paddingVertical: theme.spacing.md,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: { fontSize: 12, color: theme.colors.textMuted },
  value: { fontSize: 20, fontWeight: "600", color: theme.colors.text },
  trend: { fontSize: 13, fontWeight: "600" },
  chart: { marginTop: theme.spacing.sm, height: CHART_HEIGHT },
  footnote: {
    marginTop: theme.spacing.sm,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
});

export default ForecastCard;
