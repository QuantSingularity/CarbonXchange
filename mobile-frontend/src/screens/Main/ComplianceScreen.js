import React, { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { complianceApi, apiErrorMessage } from "../../services/api";
import { formatDate, humanize } from "../../utils/format";
import theme from "../../styles/theme";

const staffRoles = new Set(["admin", "compliance_officer", "auditor"]);

const ComplianceScreen = () => {
  const user = useSelector((state) => state.auth.user);
  const isStaff = user ? staffRoles.has(user.role) : false;

  const [status, setStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, r] = await Promise.all([
        complianceApi.myStatus(),
        complianceApi.records({ per_page: 20 }),
      ]);
      setStatus(s);
      setRecords(r.records || []);
    } catch (err) {
      setError(
        apiErrorMessage(err, "We couldn't load your compliance status."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner message="Loading compliance status…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Card
        style={[
          styles.statusCard,
          {
            backgroundColor: status?.is_kyc_approved
              ? "#E4F3EB"
              : theme.colors.warningMuted,
          },
        ]}
      >
        <View style={theme.layout.row}>
          <Ionicons
            name={status?.is_kyc_approved ? "shield-checkmark" : "shield-half"}
            size={24}
            color={
              status?.is_kyc_approved ? theme.colors.gain : theme.colors.warning
            }
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.statusTitle}>
              {status?.is_kyc_approved
                ? "Identity verified"
                : "Verification pending"}
            </Text>
            <Text style={theme.typography.caption}>
              KYC: {humanize(status?.kyc_status)} · Risk tier:{" "}
              {humanize(status?.risk_level)}
            </Text>
          </View>
        </View>
      </Card>

      <Text
        style={[
          theme.typography.h3,
          { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
        ]}
      >
        Compliance records
      </Text>
      {records.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No compliance records"
          message="Nothing has been flagged on your account."
        />
      ) : (
        <FlatList
          data={records}
          scrollEnabled={false}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Card style={styles.recordCard}>
              <View style={styles.topRow}>
                <Text style={styles.recordFramework}>
                  {humanize(item.framework)}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={theme.typography.body2}>
                {item.rule_description}
              </Text>
              {item.due_date && (
                <Text style={theme.typography.caption}>
                  Due {formatDate(item.due_date)}
                </Text>
              )}
            </Card>
          )}
        />
      )}

      {isStaff && (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <Text style={theme.typography.body2}>
            Full report review and approval tools are available on the web
            console for compliance officers and admins.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  recordCard: { marginBottom: theme.spacing.sm },
  recordFramework: { fontSize: 13, fontWeight: "700" },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  statusCard: { borderColor: "transparent" },
  statusTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
});

export default ComplianceScreen;
