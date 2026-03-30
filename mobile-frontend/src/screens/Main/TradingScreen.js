import { useState } from "react";
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
import { createTrade } from "../../services/api";
import theme from "../../styles/theme"; // Import the theme

const TradingScreen = ({ route, navigation }) => {
  const { creditId, price, availableAmount } = route.params;
  const [amount, setAmount] = useState("");
  const [tradeType, setTradeType] = useState("buy"); // Default to 'buy'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateTrade = async () => {
    setError(null);
    const tradeAmount = parseFloat(amount); // Use parseFloat for potentially fractional amounts

    if (Number.isNaN(tradeAmount) || tradeAmount <= 0) {
      Alert.alert("Error", "Please enter a valid positive amount.");
      return;
    }

    // Add check for available amount if selling
    if (
      tradeType === "sell" &&
      availableAmount !== undefined &&
      tradeAmount > availableAmount
    ) {
      Alert.alert(
        "Error",
        `You cannot sell more than the available amount (${availableAmount} tCO2e).`,
      );
      return;
    }
    // TODO: Add check for user's buying power/balance if implementing 'buy'

    setIsLoading(true);
    try {
      const tradeData = {
        creditId,
        amount: tradeAmount,
        price: parseFloat(price), // Ensure price is a number
        type: tradeType,
      };
      const response = await createTrade(tradeData);
      if (response.success) {
        Alert.alert("Success", `Trade order created successfully!`);
        // Optionally, pass back data or refresh previous screen
        navigation.goBack();
      } else {
        const errorMessage =
          response.error?.message || "Failed to create trade order";
        setError(errorMessage);
        Alert.alert("Error", errorMessage);
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while creating the trade";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatedTotal = () => {
    const tradeAmount = parseFloat(amount);
    const currentPrice = parseFloat(price);
    if (
      !Number.isNaN(tradeAmount) &&
      !Number.isNaN(currentPrice) &&
      tradeAmount > 0
    ) {
      return (tradeAmount * currentPrice).toFixed(2);
    }
    return "0.00";
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.innerContainer}>
          <Text style={styles.title}>Initiate Trade</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Credit Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Credit ID:</Text>
              <Text
                style={styles.infoValue}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {creditId || "N/A"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Price:</Text>
              <Text style={styles.infoValue}>
                ${parseFloat(price).toFixed(2) || "N/A"} / tCO2e
              </Text>
            </View>
            {availableAmount !== undefined && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Available:</Text>
                <Text style={styles.infoValue}>{availableAmount} tCO2e</Text>
              </View>
            )}
          </View>

          <View style={styles.tradeTypeContainer}>
            <TouchableOpacity
              style={[
                styles.tradeTypeButton,
                tradeType === "buy" && styles.tradeTypeActive,
              ]}
              onPress={() => setTradeType("buy")}
            >
              <Text
                style={[
                  styles.tradeTypeText,
                  tradeType === "buy" && styles.tradeTypeActiveText,
                ]}
              >
                Buy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tradeTypeButton,
                tradeType === "sell" && styles.tradeTypeActive,
              ]}
              onPress={() => setTradeType("sell")}
            >
              <Text
                style={[
                  styles.tradeTypeText,
                  tradeType === "sell" && styles.tradeTypeActiveText,
                ]}
              >
                Sell
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Amount (tCO2e)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount to trade"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholderTextColor={theme.colors.textSecondary}
          />

          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>Estimated Total:</Text>
            <Text style={styles.summaryValue}>${calculatedTotal()}</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.loader}
            />
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreateTrade}
            >
              <Text
                style={styles.submitButtonText}
              >{`Confirm ${tradeType === "buy" ? "Buy" : "Sell"} Order`}</Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  innerContainer: {
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    textAlign: "center",
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
  },
  infoCard: {
    ...theme.components.card,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  infoTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  infoLabel: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    ...theme.typography.body1,
    fontWeight: "500",
    flexShrink: 1,
    marginLeft: theme.spacing.sm,
    textAlign: "right",
  },
  tradeTypeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  tradeTypeButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  tradeTypeActive: {
    backgroundColor: theme.colors.primary,
  },
  tradeTypeText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  tradeTypeActiveText: {
    color: theme.colors.surface,
  },
  inputLabel: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.components.input,
    marginBottom: theme.spacing.md,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  summaryLabel: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    ...theme.typography.h3,
    color: theme.colors.primary,
  },
  submitButton: {
    ...theme.components.button,
  },
  submitButtonText: {
    ...theme.components.buttonText,
  },
  loader: {
    marginVertical: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.body1,
    color: theme.colors.error,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
});

export default TradingScreen;
