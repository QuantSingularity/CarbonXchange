import React, { useCallback, useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import Card from "../../components/Card";
import StatCard from "../../components/StatCard";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { tradingApi, apiErrorMessage } from "../../services/api";
import { formatCurrency, formatNumber } from "../../utils/format";
import theme from "../../styles/theme";

const CHART_COLORS = ["#1E5B48", "#C4622D", "#B8862E", "#3E8368", "#5C6B63"];

const PortfolioScreen = () => {
  const navigation = useNavigation();
  const [portfolios, setPortfolios] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, h] = await Promise.all([
        tradingApi.portfolios(),
        tradingApi.holdings(),
      ]);
      setPortfolios(p.portfolios || []);
      setHoldings(h.holdings || []);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load your portfolio."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <LoadingSpinner message="Loading your portfolio…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const totalValue = portfolios.reduce((s, p) => s + (p.total_value || 0), 0);
  const totalPnl = portfolios.reduce((s, p) => s + (p.total_pnl || 0), 0);
  const totalCredits = portfolios.reduce(
    (s, p) => s + (p.total_credits || 0),
    0,
  );

  const chartData = holdings
    .filter((h) => (h.current_value ?? 0) > 0)
    .slice(0, 5)
    .map((h, i) => ({
      name: h.vintage_year ? `Vintage ${h.vintage_year}` : `Holding ${i + 1}`,
      population: h.current_value,
      color: CHART_COLORS[i % CHART_COLORS.length],
      legendFontColor: theme.colors.textSecondary,
      legendFontSize: 12,
    }));

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.statsGrid}>
        <StatCard label="Total value" value={formatCurrency(totalValue)} />
        <StatCard
          label="Unrealized P&L"
          value={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`}
          tone={totalPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Credits held"
          value={formatNumber(totalCredits, 0)}
          hint="tCO₂e"
        />
        <StatCard label="Holdings" value={String(holdings.length)} />
      </View>

      {holdings.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No holdings yet"
          message="Buy your first credits from the trade desk to see them here."
          action={
            <Button
              title="Go to trade desk"
              onPress={() => navigation.navigate("TradeTab")}
              style={{ marginTop: 8 }}
            />
          }
        />
      ) : (
        <>
          {chartData.length > 0 && (
            <Card
              style={{ marginBottom: theme.spacing.md, alignItems: "center" }}
            >
              <Text
                style={[
                  theme.typography.h3,
                  { alignSelf: "flex-start", marginBottom: 8 },
                ]}
              >
                Allocation by vintage
              </Text>
              <PieChart
                data={chartData}
                width={theme.width - theme.spacing.lg * 2 - 32}
                height={180}
                chartConfig={{ color: () => theme.colors.text }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                hasLegend
              />
            </Card>
          )}

          <Text
            style={[theme.typography.h3, { marginBottom: theme.spacing.sm }]}
          >
            Holdings
          </Text>
          <FlatList
            data={holdings}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Card style={styles.holdingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.holdingTitle}>
                    {item.vintage_year
                      ? `Vintage ${item.vintage_year}`
                      : "Holding"}{" "}
                    · {formatNumber(item.quantity, 0)} credits
                  </Text>
                  <Text style={theme.typography.caption}>
                    Avg. cost {formatCurrency(item.average_cost, item.currency)}
                  </Text>
                </View>
                <Text
                  style={{
                    color:
                      item.total_pnl >= 0
                        ? theme.colors.gain
                        : theme.colors.loss,
                    fontWeight: "700",
                  }}
                >
                  {item.total_pnl >= 0 ? "+" : ""}
                  {formatCurrency(item.total_pnl, item.currency)}
                </Text>
              </Card>
            )}
          />
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  holdingCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  holdingTitle: {
    color: theme.colors.text,
    fontWeight: "600",
    marginBottom: 2,
  },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
});

export default PortfolioScreen;
