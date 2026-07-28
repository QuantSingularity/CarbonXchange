import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Card from "../../components/Card";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { adminApi, complianceApi, apiErrorMessage } from "../../services/api";
import { formatNumber, formatPercent, humanize } from "../../utils/format";
import theme from "../../styles/theme";

const AdminScreen = () => {
  const [users, setUsers] = useState([]);
  const [system, setSystem] = useState(null);
  const [aml, setAml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [u, s, a] = await Promise.allSettled([
        adminApi.users({ per_page: 25 }),
        adminApi.system(),
        complianceApi.amlSummary(),
      ]);
      if (u.status === "fulfilled") setUsers(u.value.users || []);
      else setError(apiErrorMessage(u.reason, "We couldn't load users."));
      if (s.status === "fulfilled") setSystem(s.value);
      if (a.status === "fulfilled") setAml(a.value);
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

  const handleUserAction = (targetUser) => {
    const options = [
      {
        text: "Activate",
        onPress: () => updateStatus(targetUser.id, "active"),
      },
      {
        text: "Suspend",
        onPress: () => updateStatus(targetUser.id, "suspended"),
      },
    ];
    if (targetUser.status === "locked") {
      options.push({ text: "Unlock", onPress: () => unlock(targetUser.id) });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert(targetUser.full_name, "Choose an action", options);
  };

  const updateStatus = async (userId, status) => {
    try {
      await adminApi.updateUserStatus(userId, status);
      load();
    } catch (err) {
      Alert.alert("Couldn't update user", apiErrorMessage(err));
    }
  };

  const unlock = async (userId) => {
    try {
      await adminApi.unlockUser(userId);
      load();
    } catch (err) {
      Alert.alert("Couldn't unlock user", apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingSpinner message="Loading admin console…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

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
        <StatCard
          label="Total users"
          value={system ? formatNumber(system.users.total, 0) : "—"}
          hint={
            system
              ? `${formatNumber(system.users.active, 0)} active`
              : undefined
          }
        />
        <StatCard
          label="Orders"
          value={system ? formatNumber(system.trading.orders, 0) : "—"}
        />
        <StatCard
          label="Trades"
          value={system ? formatNumber(system.trading.trades, 0) : "—"}
        />
        <StatCard
          label="KYC approval"
          value={aml ? formatPercent(aml.kyc_approval_rate) : "—"}
        />
      </View>

      <Text style={[theme.typography.h3, { marginBottom: theme.spacing.sm }]}>
        Users
      </Text>
      <FlatList
        data={users}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleUserAction(item)}>
            <Card style={styles.userCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.full_name}</Text>
                <Text style={theme.typography.caption}>{item.email}</Text>
                <Text style={theme.typography.caption}>
                  {humanize(item.role)}
                </Text>
              </View>
              <StatusBadge status={item.status} />
            </Card>
          </TouchableOpacity>
        )}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  userCard: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: theme.spacing.sm,
  },
  userName: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
});

export default AdminScreen;
