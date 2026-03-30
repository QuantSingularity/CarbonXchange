import { StyleSheet, View } from "react-native";
import LoadingSpinner from "../components/LoadingSpinner";

const LoadingScreen = ({ message = "Loading..." }) => {
  return (
    <View style={styles.container}>
      <LoadingSpinner message={message} size="large" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default LoadingScreen;
