import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { tradingApi, apiErrorMessage } from "../../services/api";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
} from "../../utils/format";
import theme from "../../styles/theme";

const TradeHistoryScreen = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await tradingApi.listTrades({ per_page: 30 });
      setTrades(res.trades || []);
    } catch (err) {
      setError(
        apiErrorMessage(err, "We couldn't load your transaction history."),
      );
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

  if (loading) return <LoadingSpinner message="Loading transactions…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={trades}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="No transactions yet"
          message="Settled trades will appear here once your orders fill."
        />
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.creditType}>{item.credit_type || "—"}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={theme.typography.caption}>{item.trade_id}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {formatNumber(item.quantity, 0)} @{" "}
              {formatCurrency(item.price, item.currency)}
            </Text>
            <Text style={styles.totalText}>
              {formatCurrency(item.total_value, item.currency)}
            </Text>
          </View>
          <Text style={theme.typography.caption}>
            {formatDateTime(item.executed_at)}
          </Text>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: theme.spacing.sm },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  creditType: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 6,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.mono,
    fontSize: 12,
  },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalText: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default TradeHistoryScreen;
