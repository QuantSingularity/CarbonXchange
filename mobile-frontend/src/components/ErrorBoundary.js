import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle" size={80} color="#DC3545" />
          <Text style={styles.title}>Oops! Something went wrong</Text>
          <Text style={styles.message}>
            We apologize for the inconvenience.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F8F9FA",
  },
  title: { fontSize: 24, fontWeight: "bold", marginTop: 20, marginBottom: 8 },
  message: {
    fontSize: 16,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#28A745",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});

export default ErrorBoundary;
