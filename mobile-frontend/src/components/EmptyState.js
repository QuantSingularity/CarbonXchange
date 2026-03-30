import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";

const EmptyState = ({
  icon = "folder-open-outline",
  title = "No Data",
  message = "There are no items to display",
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={64} color={theme.colors.textSecondary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
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
  title: { fontSize: 20, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  message: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    maxWidth: "80%",
  },
});

export default EmptyState;
