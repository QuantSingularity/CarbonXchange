import React from "react";
import { StyleSheet, Text, View } from "react-native";
import theme from "../styles/theme";

const ScreenHeader = ({ eyebrow, title, description, right }) => (
  <View style={styles.container}>
    <View style={{ flex: 1 }}>
      {eyebrow ? <Text style={theme.typography.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[theme.typography.display2, styles.title]}>{title}</Text>
      {description ? (
        <Text style={[theme.typography.body2, styles.description]}>
          {description}
        </Text>
      ) : null}
    </View>
    {right ? <View>{right}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    marginBottom: theme.spacing.lg,
  },
  description: { marginTop: 4 },
  title: { marginTop: 2 },
});

export default ScreenHeader;
