import React from "react";
import { useNavigation } from "@react-navigation/native";
import { ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import Button from "../components/Button";
import theme from "../styles/theme";

const steps = [
  {
    icon: "search-outline",
    title: "Discover verified projects",
    body: "Screen reforestation, renewable energy, and blue-carbon projects by standard and vintage.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Trade transparently",
    body: "Place market or limit orders against a live order book, fees disclosed upfront.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Retire & report",
    body: "Retire credits permanently on an auditable ledger built for compliance teams.",
  },
];

const HeroChart = () => (
  <Svg viewBox="0 0 400 160" width="100%" height={140}>
    <Defs>
      <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
        <Stop
          offset="0%"
          stopColor={theme.colors.railAccent}
          stopOpacity={0.35}
        />
        <Stop
          offset="100%"
          stopColor={theme.colors.railAccent}
          stopOpacity={0}
        />
      </LinearGradient>
    </Defs>
    {[30, 70, 110].map((y) => (
      <Line
        key={y}
        x1="0"
        y1={y}
        x2="400"
        y2={y}
        stroke={theme.colors.railBorder}
        strokeWidth={1}
      />
    ))}
    <Path
      d="M0 140 C 60 130, 90 120, 130 105 S 190 70, 230 48 S 300 12, 340 -2 S 390 -14, 400 -18 L400 160 L0 160 Z"
      fill="url(#fill)"
    />
    <Path
      d="M0 140 C 60 130, 90 120, 130 105 S 190 70, 230 48 S 300 12, 340 -2 S 390 -14, 400 -18"
      fill="none"
      stroke={theme.colors.railAccent}
      strokeWidth={2.5}
    />
  </Svg>
);

/** The app's true landing screen — shown before any sign-in. */
const WelcomeScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.rail} />
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Ionicons name="leaf" size={18} color={theme.colors.rail} />
          </View>
          <Text style={styles.brandName}>CarbonXchange</Text>
        </View>

        <Text style={styles.eyebrow}>Atmospheric CO₂ · 428 ppm and rising</Text>
        <Text style={styles.headline}>
          A regulated exchange for the credits that offset it.
        </Text>
        <Text style={styles.subhead}>
          Discover verified projects, trade with transparent pricing, and retire
          credits on an audit-ready ledger.
        </Text>

        <HeroChart />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {steps.map((s) => (
          <View key={s.title} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Ionicons name={s.icon} size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.actions}>
          <Button
            title="Open an account"
            onPress={() => navigation.navigate("Register")}
          />
          <Button
            title="Sign in"
            variant="outline"
            onPress={() => navigation.navigate("Login")}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.md },
  body: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  brandName: {
    color: theme.colors.railForeground,
    fontSize: 17,
    fontWeight: "700",
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
  },
  eyebrow: {
    ...theme.typography.eyebrow,
    color: theme.colors.railMuted,
    marginBottom: 10,
  },
  headline: {
    color: theme.colors.railForeground,
    fontFamily: theme.fontFamily.display,
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 36,
  },
  hero: {
    backgroundColor: theme.colors.rail,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 64,
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: theme.colors.railAccent,
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    marginRight: 8,
    width: 28,
  },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  stepBody: { ...theme.typography.body2 },
  stepIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  stepTitle: { ...theme.typography.h3, marginBottom: 2 },
  subhead: {
    color: theme.colors.railMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    marginTop: 10,
  },
});

export default WelcomeScreen;
