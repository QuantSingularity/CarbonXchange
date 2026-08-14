import React, { useCallback, useEffect, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Card from "../../components/Card";
import Button from "../../components/Button";
import StatusBadge from "../../components/StatusBadge";
import OnChainBadge from "../../components/OnChainBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";
import EmptyState from "../../components/EmptyState";
import { creditsApi, projectsApi, apiErrorMessage } from "../../services/api";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  humanize,
} from "../../utils/format";
import theme from "../../styles/theme";

const ProjectDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { projectId } = route.params;

  const [project, setProject] = useState(null);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retiringId, setRetiringId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await projectsApi.credits(projectId);
      setProject(res.project);
      setCredits(res.credits || []);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load this project."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetire = (creditId) => {
    Alert.alert(
      "Retire credit",
      "This permanently removes the credit from circulation. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retire",
          style: "destructive",
          onPress: async () => {
            setRetiringId(creditId);
            try {
              await creditsApi.retire(creditId);
              Alert.alert("Retired", "The credit was retired permanently.");
              load();
            } catch (err) {
              Alert.alert("Couldn't retire", apiErrorMessage(err));
            } finally {
              setRetiringId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingSpinner message="Loading project…" />;
  if (error || !project)
    return (
      <ErrorMessage message={error || "Project not found."} onRetry={load} />
    );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={theme.typography.eyebrow}>
          {humanize(project.project_type)}
        </Text>
        <StatusBadge status={project.verification_status} />
      </View>
      <Text style={theme.typography.display2}>{project.name}</Text>
      <Text
        style={[
          theme.typography.body2,
          { marginTop: 6, marginBottom: theme.spacing.lg },
        ]}
      >
        {project.description}
      </Text>

      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <Text style={theme.typography.caption}>Location</Text>
          <Text style={styles.statValue}>{project.country}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={theme.typography.caption}>Standard</Text>
          <Text style={styles.statValue}>{project.standard || "Unlisted"}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={theme.typography.caption}>Available</Text>
          <Text style={styles.statValue}>
            {formatNumber(project.available_credits, 0)}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={theme.typography.caption}>Est. price</Text>
          <Text style={styles.statValue}>
            {project.estimated_credit_price
              ? formatCurrency(project.estimated_credit_price)
              : "—"}
          </Text>
        </Card>
      </View>

      <Button
        title="Trade this credit type"
        onPress={() =>
          navigation.navigate("TradeTab", {
            screen: "TradeHome",
            params: { creditType: project.project_type },
          })
        }
        style={{ marginBottom: theme.spacing.lg }}
      />

      <Text style={theme.typography.h3}>Verification &amp; issuance</Text>
      <Card
        style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg }}
      >
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Validation</Text>
          <StatusBadge status={project.validation_status} />
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Methodology</Text>
          <Text style={styles.detailValue}>{project.methodology || "—"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Developer</Text>
          <Text style={styles.detailValue}>
            {project.developer_name || "—"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>On-chain project</Text>
          <Text style={styles.detailValue}>
            {project.onchain_project_id ?? "Not yet registered"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Start date</Text>
          <Text style={styles.detailValue}>
            {formatDate(project.project_start_date)}
          </Text>
        </View>
        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>Progress</Text>
          <Text style={styles.detailValue}>
            {Math.round(project.completion_percentage || 0)}%
          </Text>
        </View>
      </Card>

      <Text style={theme.typography.h3}>Credit batches</Text>
      <View style={{ marginTop: theme.spacing.sm }}>
        {credits.length === 0 ? (
          <EmptyState
            icon="leaf-outline"
            title="No credit batches listed yet"
          />
        ) : (
          credits.map((c) => (
            <Card key={c.id} style={styles.creditCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.creditSerial}>{c.serial_number}</Text>
                <Text style={theme.typography.caption}>
                  Vintage {c.vintage_year} · {formatNumber(c.quantity, 0)}{" "}
                  credits
                </Text>
                <OnChainBadge
                  isTokenized={c.is_tokenized}
                  txHash={c.blockchain_tx_hash}
                  style={{ marginTop: 6 }}
                />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.creditPrice}>
                  {c.market_price ? formatCurrency(c.market_price) : "—"}
                </Text>
                {c.is_available && (
                  <Button
                    title="Retire"
                    variant="outline"
                    onPress={() => handleRetire(c.id)}
                    loading={retiringId === c.id}
                    style={styles.retireBtn}
                    textStyle={{ fontSize: 12 }}
                  />
                )}
              </View>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  creditCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  creditPrice: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    fontWeight: "700",
  },
  creditSerial: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    fontSize: 12,
  },
  detailLabel: { color: theme.colors.textSecondary, fontSize: 13 },
  detailRow: {
    alignItems: "center",
    borderBottomColor: theme.colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  detailValue: { color: theme.colors.text, fontSize: 13, fontWeight: "600" },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  retireBtn: { marginTop: 6, minHeight: 32, paddingHorizontal: 12 },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  statCard: { flexBasis: "47%", flexGrow: 1 },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
});

export default ProjectDetailScreen;
