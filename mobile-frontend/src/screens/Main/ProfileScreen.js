import React, { useState } from "react";
import {
  Alert,
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
import Card from "../../components/Card";
import Button from "../../components/Button";
import { authApi, userApi, apiErrorMessage } from "../../services/api";
import { logoutUser, refreshCurrentUser } from "../../store/slices/authSlice";
import { humanize, initials } from "../../utils/format";
import theme from "../../styles/theme";

const ProfileScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const profile = user?.profile;

  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone_number: user?.phone_number || "",
    occupation: profile?.occupation || "",
    employer: profile?.employer || "",
    country_of_residence: profile?.country_of_residence || "",
    city: profile?.address?.city || "",
  });
  const [saving, setSaving] = useState(false);

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await userApi.updateMyProfile(form);
      await dispatch(refreshCurrentUser());
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      Alert.alert("Couldn't save", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.next !== passwords.confirm) {
      Alert.alert("Passwords don't match", "Double-check your new password.");
      return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      Alert.alert("Password updated");
    } catch (err) {
      Alert.alert("Couldn't update password", apiErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => dispatch(logoutUser()),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials(user?.first_name, user?.last_name)}
            </Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={theme.typography.h2}>{user?.full_name}</Text>
            <Text style={theme.typography.caption}>
              {humanize(user?.role)} · {user?.email}
            </Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {["profile", "security"].map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {humanize(t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "profile" ? (
          <>
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
              <Text style={theme.components.label}>Phone number</Text>
              <TextInput
                style={theme.components.input}
                value={form.phone_number}
                onChangeText={update("phone_number")}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.field}>
              <Text style={theme.components.label}>Occupation</Text>
              <TextInput
                style={theme.components.input}
                value={form.occupation}
                onChangeText={update("occupation")}
              />
            </View>
            <View style={styles.field}>
              <Text style={theme.components.label}>Employer</Text>
              <TextInput
                style={theme.components.input}
                value={form.employer}
                onChangeText={update("employer")}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <Text style={theme.components.label}>City</Text>
                <TextInput
                  style={theme.components.input}
                  value={form.city}
                  onChangeText={update("city")}
                />
              </View>
              <View style={[styles.field, styles.half]}>
                <Text style={theme.components.label}>Country</Text>
                <TextInput
                  style={theme.components.input}
                  value={form.country_of_residence}
                  onChangeText={update("country_of_residence")}
                />
              </View>
            </View>
            <Button
              title="Save changes"
              onPress={handleSaveProfile}
              loading={saving}
              style={{ marginTop: theme.spacing.sm }}
            />
          </>
        ) : (
          <>
            <Card style={{ marginBottom: theme.spacing.md }}>
              <View style={theme.layout.row}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={theme.colors.textSecondary}
                />
                <Text
                  style={[theme.typography.body2, { marginLeft: 8, flex: 1 }]}
                >
                  {user?.email}
                </Text>
                {user?.is_email_verified ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.colors.gain}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => authApi.verifyEmail().catch(() => {})}
                  >
                    <Text
                      style={{
                        color: theme.colors.primary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Verify
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>

            <Text style={theme.components.label}>Current password</Text>
            <TextInput
              style={theme.components.input}
              secureTextEntry
              value={passwords.current}
              onChangeText={(v) => setPasswords((p) => ({ ...p, current: v }))}
            />
            <Text
              style={[theme.components.label, { marginTop: theme.spacing.md }]}
            >
              New password
            </Text>
            <TextInput
              style={theme.components.input}
              secureTextEntry
              value={passwords.next}
              onChangeText={(v) => setPasswords((p) => ({ ...p, next: v }))}
            />
            <Text
              style={[theme.components.label, { marginTop: theme.spacing.md }]}
            >
              Confirm new password
            </Text>
            <TextInput
              style={theme.components.input}
              secureTextEntry
              value={passwords.confirm}
              onChangeText={(v) => setPasswords((p) => ({ ...p, confirm: v }))}
            />
            <Button
              title="Update password"
              onPress={handleChangePassword}
              loading={savingPassword}
              style={{ marginTop: theme.spacing.lg }}
            />
          </>
        )}

        <Button
          title="Sign out"
          variant="outline"
          onPress={handleLogout}
          style={styles.logoutBtn}
          textStyle={{ color: theme.colors.loss }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  avatarText: {
    color: theme.colors.primaryForeground,
    fontFamily: theme.fontFamily.mono,
    fontSize: 18,
    fontWeight: "700",
  },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  field: { marginBottom: theme.spacing.md },
  half: { flex: 1 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
  },
  logoutBtn: { borderColor: theme.colors.loss, marginTop: theme.spacing.xl },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  tabBtn: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flex: 1,
    paddingVertical: 8,
  },
  tabBtnActive: { backgroundColor: theme.colors.surface, ...theme.shadow },
  tabRow: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
    padding: 4,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: { color: theme.colors.text },
});

export default ProfileScreen;
