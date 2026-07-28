import React from "react";
import { StyleSheet, View } from "react-native";
import theme from "../styles/theme";

const Card = ({ children, style, noPadding = false }) => (
  <View style={[styles.card, noPadding && { padding: 0 }, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: { ...theme.layout.card },
});

export default Card;
