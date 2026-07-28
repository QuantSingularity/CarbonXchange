import React from "react";
import { StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";

function humanize(value) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toneFor(status) {
  const s = (status || "").toLowerCase();
  if (
    [
      "active",
      "approved",
      "filled",
      "settled",
      "completed",
      "verified",
      "confirmed",
    ].includes(s)
  ) {
    return { bg: "#E4F3EB", fg: theme.colors.gain };
  }
  if (
    [
      "pending",
      "pending_review",
      "in_progress",
      "open",
      "under_review",
      "partially_filled",
    ].includes(s)
  ) {
    return { bg: theme.colors.warningMuted, fg: theme.colors.warning };
  }
  if (
    [
      "rejected",
      "cancelled",
      "suspended",
      "expired",
      "failed",
      "closed",
      "locked",
    ].includes(s)
  ) {
    return { bg: "#F6E7DE", fg: theme.colors.loss };
  }
  return { bg: theme.colors.surfaceMuted, fg: theme.colors.textSecondary };
}

const StatusBadge = ({ status, style }) => {
  const tone = toneFor(status);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }, style]}>
      <Text style={[styles.text, { color: tone.fg }]}>{humanize(status)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { ...theme.components.badge },
  text: { fontSize: 12, fontWeight: "600" },
});

export default StatusBadge;
