import React from "react";
import { StyleSheet, View } from "react-native";
import LoadingSpinner from "../components/LoadingSpinner";
import theme from "../styles/theme";

const LoadingScreen = ({ message = "Loading CarbonXchange…" }) => (
  <View style={styles.container}>
    <LoadingSpinner message={message} size="large" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center",
  },
});

export default LoadingScreen;
