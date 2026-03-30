import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, resetAuthError } from "../../store/slices/authSlice";
import theme from "../../styles/theme"; // Import the theme

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  const handleLogin = () => {
    if (error) {
      dispatch(resetAuthError()); // Reset error before new attempt
    }
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    dispatch(loginUser({ email, password }));
    // Navigation to AppNavigator will be handled in App.js based on isLoggedIn state
  };

  React.useEffect(() => {
    if (error) {
      // Use a more user-friendly error message if possible
      const message =
        error.message ||
        error.response?.data?.message ||
        "Login failed. Please check your credentials.";
      Alert.alert("Login Failed", message);
      dispatch(resetAuthError()); // Reset error after showing it
    }
  }, [error, dispatch]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Login to CarbonXchange</Text>

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
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => navigation.navigate("Register")}
          disabled={isLoading}
        >
          <Text style={styles.buttonSecondaryText}>
            Don't have an account? Register
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // Use theme background
  },
  innerContainer: {
    flex: 1,
    justifyContent: "center",
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

export default LoginScreen;
