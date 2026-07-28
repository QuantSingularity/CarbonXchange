import { Dimensions, Platform } from "react-native";

const { width, height } = Dimensions.get("window");

/**
 * CarbonXchange design tokens — mirrors the web app's "atmospheric ledger"
 * palette (deep spruce green, warm ember accent, mist paper background)
 * so the mobile and web apps read as one product.
 */
const colors = {
  primary: "#1E5B48", // Spruce — brand
  primaryLight: "#3E8368",
  primaryMuted: "#E3EDE7",
  primaryForeground: "#F5FAF7",

  background: "#F3F5EF", // Mist paper
  surface: "#FFFFFF",
  surfaceMuted: "#EAEDE6",

  text: "#13221B", // Deep pine ink
  textSecondary: "#5C6B63",
  textMuted: "#8B9A92",

  border: "#DEE3D9",
  divider: "#E7EAE2",

  accent: "#C4622D", // Ember — emphasis / sell
  gain: "#1F7A52",
  loss: "#C4622D",
  warning: "#B8862E",
  warningMuted: "#F5EAD6",

  disabled: "#C6CCC1",

  // The trading rail — always dark, an instrument panel independent of theme
  rail: "#0D1512",
  railSurface: "#142019",
  railForeground: "#EAF0EA",
  railMuted: "#8FA79B",
  railBorder: "#1C2A22",
  railAccent: "#3E8368",
};

const fontFamily = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  }),
  sans: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
};

const typography = {
  display1: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    fontWeight: "600",
    color: colors.text,
  },
  display2: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    fontWeight: "600",
    color: colors.text,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  body1: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  body2: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  mono: { fontFamily: fontFamily.mono, fontSize: 15, color: colors.text },
  monoLg: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: "600",
    color: colors.text,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  button: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
};

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 999 };

const shadow = {
  shadowColor: "#0D1512",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const layout = {
  container: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center" },
  spaceBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
};

const components = {
  input: {
    height: 48,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body1.fontSize,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    flexDirection: "row",
    gap: spacing.xs,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  buttonSecondaryText: { ...typography.button, color: colors.primary },
  buttonDanger: { backgroundColor: colors.loss },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
};

const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  layout,
  components,
  fontFamily,
  width,
  height,
};

export default theme;
