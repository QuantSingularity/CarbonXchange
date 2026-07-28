import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/Button";
import { registerUser, resetAuthError } from "../../store/slices/authSlice";
import theme from "../../styles/theme";

const passwordRules = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One number", test: (v) => /\d/.test(v) },
  {
    label: "One special character",
    test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v),
  },
];

const RegisterScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  const [accountType, setAccountType] = useState("individual");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    company_name: "",
    password: "",
    confirm_password: "",
  });
  const [localError, setLocalError] = useState(null);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    setLocalError(null);
    dispatch(resetAuthError());

    if (form.password !== form.confirm_password) {
      setLocalError("Passwords don't match.");
      return;
    }
    if (passwordRules.some((r) => !r.test(form.password))) {
      setLocalError("Your password doesn't meet the requirements below.");
      return;
    }

    dispatch(
      registerUser({
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone_number: form.phone_number || undefined,
        company_name:
          accountType === "corporate"
            ? form.company_name || undefined
            : undefined,
      }),
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>

        <Text style={theme.typography.display2}>Open an account</Text>
        <Text style={[theme.typography.body2, styles.subtitle]}>
          Takes about two minutes. You&apos;ll complete KYC verification after
          signing up.
        </Text>

        <View style={styles.toggleRow}>
          {["individual", "corporate"].map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setAccountType(t)}
              style={[
                styles.toggleBtn,
                accountType === t && styles.toggleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  accountType === t && styles.toggleTextActive,
                ]}
              >
                {t === "individual" ? "Individual" : "Corporate"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.half]}>
            <Text style={theme.components.label}>First name</Text>
            <TextInput
              style={theme.components.input}
              value={form.first_name}
              onChangeText={update("first_name")}
            />
          </View>
          <View style={[styles.field, styles.half]}>
            <Text style={theme.components.label}>Last name</Text>
            <TextInput
              style={theme.components.input}
              value={form.last_name}
              onChangeText={update("last_name")}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={theme.components.label}>Email</Text>
          <TextInput
            style={theme.components.input}
            value={form.email}
            onChangeText={update("email")}
            placeholder="you@company.com"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={theme.components.label}>Phone number (optional)</Text>
          <TextInput
            style={theme.components.input}
            value={form.phone_number}
            onChangeText={update("phone_number")}
            placeholder="+1 555 000 0000"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        {accountType === "corporate" && (
          <View style={styles.field}>
            <Text style={theme.components.label}>Company name</Text>
            <TextInput
              style={theme.components.input}
              value={form.company_name}
              onChangeText={update("company_name")}
              placeholder="Acme Industries, Inc."
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={theme.components.label}>Password</Text>
          <TextInput
            style={theme.components.input}
            value={form.password}
            onChangeText={update("password")}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
        <View style={styles.field}>
          <Text style={theme.components.label}>Confirm password</Text>
          <TextInput
            style={theme.components.input}
            value={form.confirm_password}
            onChangeText={update("confirm_password")}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <View style={styles.rulesBox}>
          {passwordRules.map((r) => {
            const met = r.test(form.password);
            return (
              <View key={r.label} style={styles.ruleRow}>
                <Ionicons
                  name={met ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={met ? theme.colors.gain : theme.colors.textMuted}
                />
                <Text
                  style={[styles.ruleText, met && { color: theme.colors.text }]}
                >
                  {r.label}
                </Text>
              </View>
            );
          })}
        </View>

        {localError || error ? (
          <Text style={styles.error}>{localError || error}</Text>
        ) : null}

        <Button
          title="Create account"
          onPress={handleSubmit}
          loading={isLoading}
          style={styles.submit}
        />

        <Text style={styles.disclaimer}>
          By continuing you agree to complete identity verification before
          trading.
        </Text>

        <View style={styles.footerRow}>
          <Text style={theme.typography.body2}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  back: { marginBottom: theme.spacing.md },
  disclaimer: {
    ...theme.typography.caption,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
  error: {
    backgroundColor: "#F6E7DE",
    borderRadius: theme.radius.md,
    color: theme.colors.loss,
    fontSize: 13,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  field: { marginBottom: theme.spacing.md },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
  },
  half: { flex: 1 },
  link: { color: theme.colors.primary, fontSize: 13, fontWeight: "700" },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  ruleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  ruleText: { color: theme.colors.textMuted, fontSize: 12 },
  rulesBox: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    gap: 6,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: 56,
  },
  submit: { marginTop: theme.spacing.xs },
  subtitle: { marginBottom: theme.spacing.lg, marginTop: 6 },
  toggleBtn: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flex: 1,
    paddingVertical: 8,
  },
  toggleBtnActive: { backgroundColor: theme.colors.surface, ...theme.shadow },
  toggleRow: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
    padding: 4,
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  toggleTextActive: { color: theme.colors.text },
});

export default RegisterScreen;
