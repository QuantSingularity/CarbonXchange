import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";

const LoadingSpinner = ({ message = "Loading...", size = "large", style }) => {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
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
  message: { marginTop: 16, fontSize: 16, color: "#6C757D" },
});

export default LoadingSpinner;
