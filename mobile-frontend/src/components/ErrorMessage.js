import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";
import Button from "./Button";

const ErrorMessage = ({
  message = "Something went wrong.",
  onRetry = null,
  icon = "alert-circle-outline",
  style,
}) => (
  <View style={[styles.container, style]}>
    <Ionicons name={icon} size={40} color={theme.colors.loss} />
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <Button
        title="Try again"
        variant="outline"
        onPress={onRetry}
        style={styles.retryButton}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: theme.spacing.xl },
  message: {
    ...theme.typography.body1,
    color: theme.colors.loss,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.md,
    maxWidth: "85%",
    textAlign: "center",
  },
  retryButton: { minWidth: 140 },
});

export default ErrorMessage;
