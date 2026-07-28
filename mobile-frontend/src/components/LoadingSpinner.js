import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";

const LoadingSpinner = ({
  message = "Loading…",
  size = "large",
  style,
  fullScreen = true,
}) => (
  <View style={[fullScreen ? styles.container : styles.inline, style]}>
    <ActivityIndicator size={size} color={theme.colors.primary} />
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  inline: { alignItems: "center", padding: theme.spacing.lg },
  message: { marginTop: theme.spacing.md, ...theme.typography.body2 },
});

export default LoadingSpinner;
