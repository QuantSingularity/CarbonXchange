import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import theme from "../styles/theme";

/**
 * Primary reusable button. variant: "primary" | "secondary" | "outline" | "danger" | "ghost"
 */
const Button = ({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon = null,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: { backgroundColor: theme.colors.primary },
    danger: { backgroundColor: theme.colors.loss },
    secondary: { backgroundColor: theme.colors.surfaceMuted },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
    },
    ghost: { backgroundColor: "transparent" },
  };

  const textColor = {
    primary: theme.colors.primaryForeground,
    danger: theme.colors.primaryForeground,
    secondary: theme.colors.text,
    outline: theme.colors.primary,
    ghost: theme.colors.primary,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: textColor[variant] }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg,
  },
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: "700" },
});

export default Button;
