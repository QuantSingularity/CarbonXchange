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
import { loginUser, resetAuthError } from "../../store/slices/authSlice";
import theme from "../../styles/theme";

const LoginScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    dispatch(resetAuthError());
    dispatch(loginUser({ email: email.trim(), password }));
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

        <Text style={theme.typography.display2}>Welcome back</Text>
        <Text style={[theme.typography.body2, styles.subtitle]}>
          Sign in to trade, track holdings, and manage retirements.
        </Text>

        <View style={styles.field}>
          <Text style={theme.components.label}>Email</Text>
          <TextInput
            style={theme.components.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={theme.components.label}>Password</Text>
          <TextInput
            style={theme.components.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Sign in"
          onPress={handleSubmit}
          loading={isLoading}
          style={styles.submit}
        />

        <View style={styles.footerRow}>
          <Text style={theme.typography.body2}>
            Don&apos;t have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.link}>Open one now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  back: { marginBottom: theme.spacing.lg },
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
    marginTop: theme.spacing.xl,
  },
  link: { color: theme.colors.primary, fontSize: 13, fontWeight: "700" },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  scroll: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: 64,
  },
  submit: { marginTop: theme.spacing.sm },
  subtitle: { marginBottom: theme.spacing.xl, marginTop: 6 },
});

export default LoginScreen;
