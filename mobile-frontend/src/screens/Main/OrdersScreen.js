import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

// Mirrors the backend's Order.is_active property exactly — "pending"
// orders haven't reached the book yet and the API rejects cancelling them.
const cancellable = new Set(["open", "partially_filled"]);

const OrdersScreen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await tradingApi.listOrders({ per_page: 30 });
      setOrders(res.orders || []);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load your orders."));
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

  const handleCancel = (orderId) => {
    Alert.alert("Cancel order", `Cancel order ${orderId}?`, [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: async () => {
          setCancellingId(orderId);
          try {
            await tradingApi.cancelOrder(orderId);
            load();
          } catch (err) {
            Alert.alert("Couldn't cancel", apiErrorMessage(err));
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading orders…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={orders}
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
          icon="list-outline"
          title="No orders yet"
          message="Orders you place from the trade desk will show up here."
        />
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.creditType}>{item.credit_type}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={theme.typography.caption}>{item.order_id}</Text>
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.side,
                {
                  color:
                    item.side === "buy" ? theme.colors.gain : theme.colors.loss,
                },
              ]}
            >
              {item.side.toUpperCase()}
            </Text>
            <Text style={styles.metaText}>
              {formatNumber(item.filled_quantity, 0)} /{" "}
              {formatNumber(item.quantity, 0)} filled
            </Text>
            <Text style={styles.metaText}>
              {item.price ? formatCurrency(item.price) : "Market"}
            </Text>
          </View>
          <Text style={theme.typography.caption}>
            {formatDateTime(item.created_at)}
          </Text>
          {cancellable.has(item.status) && (
            <TouchableOpacity
              onPress={() => handleCancel(item.order_id)}
              style={styles.cancelBtn}
              disabled={cancellingId === item.order_id}
            >
              <Text style={styles.cancelText}>
                {cancellingId === item.order_id
                  ? "Cancelling…"
                  : "Cancel order"}
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  cancelBtn: { alignSelf: "flex-start", marginTop: theme.spacing.sm },
  cancelText: { color: theme.colors.loss, fontSize: 12, fontWeight: "700" },
  card: { marginBottom: theme.spacing.sm },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  creditType: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  metaRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: 4,
    marginTop: 6,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.mono,
    fontSize: 12,
  },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  side: { fontSize: 12, fontWeight: "700" },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
});

export default OrdersScreen;
