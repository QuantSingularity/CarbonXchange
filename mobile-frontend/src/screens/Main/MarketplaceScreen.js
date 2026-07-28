import React, { useCallback, useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { projectsApi, apiErrorMessage } from "../../services/api";
import { formatCurrency, formatNumber, humanize } from "../../utils/format";
import theme from "../../styles/theme";

const TYPES = [
  "all",
  "reforestation",
  "renewable_energy",
  "methane_capture",
  "blue_carbon",
  "soil_carbon",
];

const MarketplaceScreen = () => {
  const navigation = useNavigation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await projectsApi.list({
        per_page: 30,
        type: type !== "all" ? type : undefined,
      });
      setProjects(res.projects || []);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load the marketplace."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = projects.filter((p) =>
    search.trim() === ""
      ? true
      : p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.country?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Ionicons
          name="search"
          size={16}
          color={theme.colors.textMuted}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects or countries…"
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={TYPES}
        keyExtractor={(t) => t}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setType(item)}
            style={[styles.chip, type === item && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, type === item && styles.chipTextActive]}
            >
              {item === "all" ? "All types" : humanize(item)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <LoadingSpinner message="Loading projects…" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="leaf-outline"
              title="No projects found"
              message="Try a different search term or project type."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("ProjectDetail", { projectId: item.id })
              }
            >
              <Card style={styles.projectCard}>
                <View style={styles.projectHeader}>
                  <View style={styles.leafIcon}>
                    <Ionicons
                      name="leaf"
                      size={16}
                      color={theme.colors.primary}
                    />
                  </View>
                  <StatusBadge status={item.verification_status} />
                </View>
                <Text style={styles.projectName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.metaText}>{item.country}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>
                    {humanize(item.project_type)}
                  </Text>
                </View>
                <View style={styles.footerRow}>
                  <View>
                    <Text style={theme.typography.caption}>Est. price</Text>
                    <Text style={styles.priceText}>
                      {item.estimated_credit_price
                        ? formatCurrency(item.estimated_credit_price)
                        : "—"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={theme.typography.caption}>Available</Text>
                    <Text style={styles.priceText}>
                      {formatNumber(item.available_credits, 0)}
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.full,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: theme.colors.primary },
  chipRow: {
    gap: 8,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: { color: theme.colors.primaryForeground },
  footerRow: {
    borderTopColor: theme.colors.divider,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  leafIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  listContent: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.sm,
  },
  metaDot: { color: theme.colors.textMuted, marginHorizontal: 2 },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  metaText: { color: theme.colors.textMuted, fontSize: 12 },
  priceText: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    fontWeight: "700",
    marginTop: 2,
  },
  projectCard: { marginBottom: theme.spacing.md },
  projectHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  projectName: { ...theme.typography.h3, marginBottom: 4 },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  searchInput: { color: theme.colors.text, flex: 1, fontSize: 14 },
  searchRow: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    height: 44,
    margin: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
});

export default MarketplaceScreen;
