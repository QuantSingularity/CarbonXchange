import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { registerUser, resetAuthError } from "../../store/slices/authSlice";
import theme from "../../styles/theme"; // Import the theme

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [walletAddress, setWalletAddress] = useState(""); // Optional
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  const handleRegister = () => {
    if (error) {
      dispatch(resetAuthError()); // Reset error before new attempt
    }
    if (!email || !password || !confirmPassword || !fullName) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }
    // Basic password strength (example: min 6 chars)
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long.");
      return;
    }

    const userData = {
      email,
      password,
      fullName,
      // Only include walletAddress if it's not empty, or adjust based on API requirements
      ...(walletAddress && { walletAddress }),
    };
    dispatch(registerUser(userData));
    // Navigation handled by App.js based on state
  };

  React.useEffect(() => {
    if (error) {
      const message =
        error.message ||
        error.response?.data?.message ||
        "Registration failed. Please try again.";
      Alert.alert("Registration Failed", message);
      dispatch(resetAuthError()); // Reset error after showing it
    }
  }, [error, dispatch]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.innerContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join CarbonXchange</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min. 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            placeholder="Wallet Address (Optional)"
            value={walletAddress}
            onChangeText={setWalletAddress}
            autoCapitalize="none"
            placeholderTextColor={theme.colors.textSecondary}
          />

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={{ marginVertical: theme.spacing.md }}
            />
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => navigation.navigate("Login")}
            disabled={isLoading}
          >
            <Text style={styles.buttonSecondaryText}>
              Already have an account? Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // Use theme background
  },
  scrollContainer: {
    flexGrow: 1, // Ensures content can scroll if needed
    justifyContent: "center", // Center content vertically
  },
  innerContainer: {
    padding: theme.spacing.lg, // Use theme spacing
  },
  title: {
    ...theme.typography.h1, // Use theme typography
    textAlign: "center",
    color: theme.colors.primary, // Use theme primary color
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing.xl, // More space after subtitle
  },
  input: {
    ...theme.components.input, // Use theme input component style
  },
  button: {
    ...theme.components.button, // Use theme button component style
  },
  buttonText: {
    ...theme.components.buttonText, // Use theme button text style
  },
  buttonSecondary: {
    ...theme.components.buttonSecondary, // Use theme secondary button style
    marginTop: theme.spacing.sm, // Add some space between buttons
  },
  buttonSecondaryText: {
    ...theme.components.buttonSecondaryText, // Use theme secondary button text style
  },
});

export default RegisterScreen;
