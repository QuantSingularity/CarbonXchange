import React, { useCallback, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/Card";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";
import Button from "../../components/Button";
import {
  tradingApi,
  complianceApi,
  marketApi,
  apiErrorMessage,
} from "../../services/api";
import { formatCurrency, formatNumber } from "../../utils/format";
import theme from "../../styles/theme";

const DashboardScreen = () => {
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portfolios, setPortfolios] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [marketStats, setMarketStats] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, h, o, c, m] = await Promise.allSettled([
        tradingApi.portfolios(),
        tradingApi.holdings(),
        tradingApi.listOrders({ per_page: 5 }),
        complianceApi.myStatus(),
        marketApi.statistics({ days: 7 }),
      ]);
      if (p.status === "fulfilled") setPortfolios(p.value.portfolios || []);
      if (h.status === "fulfilled") setHoldings(h.value.holdings || []);
      if (o.status === "fulfilled") setOrders(o.value.orders || []);
      if (c.status === "fulfilled") setCompliance(c.value);
      if (m.status === "fulfilled" && !m.value.error) setMarketStats(m.value);
    } catch (err) {
      console.warn(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <LoadingSpinner message="Loading your dashboard…" />;

  const totalValue = portfolios.reduce((s, p) => s + (p.total_value || 0), 0);
  const totalPnl = portfolios.reduce((s, p) => s + (p.total_pnl || 0), 0);
  const totalCredits = portfolios.reduce(
    (s, p) => s + (p.total_credits || 0),
    0,
  );

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
      <ScreenHeader
        eyebrow="Overview"
        title={`Welcome back, ${user?.first_name ?? ""}`}
      />

      {compliance && !compliance.is_kyc_approved && (
        <TouchableOpacity
          onPress={() => navigation.navigate("MoreTab", { screen: "Profile" })}
        >
          <Card style={styles.kycCard}>
            <View style={theme.layout.row}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.colors.warning}
              />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.kycTitle}>
                  Identity verification pending
                </Text>
                <Text style={theme.typography.caption}>
                  Tap to complete your profile.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.textMuted}
              />
            </View>
          </Card>
        </TouchableOpacity>
      )}

      <View style={styles.statsGrid}>
        <StatCard
          label="Portfolio value"
          value={formatCurrency(totalValue)}
          tone={totalPnl >= 0 ? "gain" : "loss"}
          hint={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)} all-time`}
        />
        <StatCard
          label="Credits held"
          value={formatNumber(totalCredits, 0)}
          hint="tCO₂e"
        />
        <StatCard
          label="7-day avg. price"
          value={marketStats ? formatCurrency(marketStats.average_price) : "—"}
          hint={
            marketStats
              ? `${formatNumber(marketStats.trade_count, 0)} trades`
              : "No data yet"
          }
        />
        <StatCard
          label="Account"
          value={compliance?.is_kyc_approved ? "Verified" : "Pending"}
          tone={compliance?.is_kyc_approved ? "gain" : "neutral"}
        />
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={theme.typography.h3}>Recent orders</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("MoreTab", { screen: "Orders" })}
        >
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>

      <Card noPadding style={styles.listCard}>
        {orders.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="No orders yet"
            message="Place your first order to start building a position."
            action={
              <Button
                title="Place an order"
                onPress={() => navigation.navigate("TradeTab")}
                style={{ marginTop: 8 }}
              />
            }
            style={{ padding: theme.spacing.lg }}
          />
        ) : (
          <FlatList
            data={orders}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => (
              <View style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCredit}>{item.credit_type}</Text>
                  <Text style={theme.typography.caption}>
                    {formatNumber(item.quantity, 0)} credits
                  </Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
            )}
          />
        )}
      </Card>

      <Text style={[theme.typography.h3, { marginTop: theme.spacing.lg }]}>
        Top holdings
      </Text>
      <Card noPadding style={styles.listCard}>
        {holdings.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No holdings yet"
            message="Credits you acquire will show up here."
            style={{ padding: theme.spacing.lg }}
          />
        ) : (
          <FlatList
            data={holdings.slice(0, 5)}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => (
              <View style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCredit}>
                    {formatNumber(item.quantity, 0)} credits
                  </Text>
                  <Text style={theme.typography.caption}>
                    Avg. cost {formatCurrency(item.average_cost)}
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
                  {formatCurrency(item.total_pnl)}
                </Text>
              </View>
            )}
          />
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  divider: {
    backgroundColor: theme.colors.divider,
    height: 1,
    marginLeft: theme.spacing.md,
  },
  kycCard: {
    backgroundColor: theme.colors.warningMuted,
    borderColor: "transparent",
    marginBottom: theme.spacing.md,
  },
  kycTitle: { color: theme.colors.text, fontSize: 13, fontWeight: "700" },
  listCard: { marginBottom: theme.spacing.md },
  orderCredit: { color: theme.colors.text, fontWeight: "600", marginBottom: 2 },
  orderRow: {
    alignItems: "center",
    flexDirection: "row",
    padding: theme.spacing.md,
  },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  viewAll: { color: theme.colors.primary, fontSize: 13, fontWeight: "600" },
});

export default DashboardScreen;
