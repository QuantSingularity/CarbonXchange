import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";

const EmptyState = ({
  icon = "folder-open-outline",
  title = "Nothing here yet",
  message = "There's nothing to show right now.",
  action = null,
  style,
}) => (
  <View style={[styles.container, style]}>
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={28} color={theme.colors.primary} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {action}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: theme.spacing.xl },
  iconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    width: 56,
  },
  message: { ...theme.typography.body2, maxWidth: "85%", textAlign: "center" },
  title: { ...theme.typography.h3, marginBottom: 4, textAlign: "center" },
});

export default EmptyState;
