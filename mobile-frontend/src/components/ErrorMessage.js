import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import theme from "../styles/theme";

const ErrorMessage = ({
  message = "An error occurred",
  onRetry = null,
  style,
  icon = "alert-circle-outline",
}) => {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={48} color={theme.colors.error} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: "#DC3545",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
    maxWidth: "80%",
  },
  retryButton: {
    backgroundColor: "#28A745",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});

export default ErrorMessage;
