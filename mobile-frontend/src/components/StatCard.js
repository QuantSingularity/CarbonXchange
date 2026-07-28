import React from "react";
import { StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";
import Card from "./Card";

const StatCard = ({ label, value, hint, tone = "neutral", style }) => {
  const toneColor =
    tone === "gain"
      ? theme.colors.gain
      : tone === "loss"
        ? theme.colors.loss
        : theme.colors.textSecondary;

  return (
    <Card style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? (
        <Text style={[styles.hint, { color: toneColor }]}>{hint}</Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: "45%" },
  hint: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  label: { ...theme.typography.body2, marginBottom: 6 },
  value: {
    ...theme.typography.mono,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
});

export default StatCard;
