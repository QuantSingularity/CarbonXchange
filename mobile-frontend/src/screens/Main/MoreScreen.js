import React from "react";
import { useNavigation } from "@react-navigation/native";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { initials } from "../../utils/format";
import theme from "../../styles/theme";

const staffRoles = new Set(["admin", "compliance_officer", "auditor"]);

const items = [
  { key: "Orders", label: "Order history", icon: "list-outline" },
  { key: "Transactions", label: "Transactions", icon: "receipt-outline" },
  { key: "Compliance", label: "Compliance", icon: "shield-checkmark-outline" },
  {
    key: "Profile",
    label: "Profile & settings",
    icon: "person-circle-outline",
  },
];

const MoreScreen = () => {
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);
  const isStaff = user ? staffRoles.has(user.role) : false;

  const rows = isStaff
    ? [
        ...items,
        { key: "Admin", label: "Admin console", icon: "shield-outline" },
      ]
    : items;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initials(user?.first_name, user?.last_name)}
          </Text>
        </View>
        <View style={{ marginLeft: 12 }}>
          <Text style={theme.typography.h3}>{user?.full_name}</Text>
          <Text style={theme.typography.caption}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        {rows.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.row, i !== rows.length - 1 && styles.rowBorder]}
            onPress={() => navigation.navigate(item.key)}
          >
            <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.footerText}>
        CarbonXchange · Atmospheric CO₂ 428 ppm
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  avatarText: {
    color: theme.colors.primaryForeground,
    fontFamily: theme.fontFamily.mono,
    fontWeight: "700",
  },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  footerText: {
    ...theme.typography.caption,
    fontFamily: theme.fontFamily.mono,
    marginTop: theme.spacing.xl,
    textAlign: "center",
  },
  menu: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  profileRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: theme.spacing.xl,
  },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomColor: theme.colors.divider, borderBottomWidth: 1 },
  rowLabel: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MoreScreen;
