import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getCreditById } from "../../services/api";
import theme from "../../styles/theme"; // Import the theme

const CreditDetailScreen = ({ route, navigation }) => {
  const { creditId } = route.params;
  const [creditDetails, setCreditDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCreditDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCreditById(creditId);
      if (response.success && response.data) {
        setCreditDetails(response.data);
      } else {
        const errorMessage =
          response.error?.message || "Failed to fetch credit details";
        setError(errorMessage);
        // Alert.alert('Error', errorMessage); // Avoid redundant alerts if error is displayed on screen
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while fetching details";
      setError(errorMessage);
      // Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [creditId]);

  useEffect(() => {
    fetchCreditDetails();
  }, [fetchCreditDetails]);

  // Function to handle opening verification document links (example)
  const handleOpenLink = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(`Don't know how to open this URL: ${url}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
          style={[theme.components.button, styles.retryButton]}
          onPress={fetchCreditDetails}
        >
          <Text style={theme.components.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!creditDetails) {
    return (
      <View style={styles.centered}>
        <Text style={theme.typography.body1}>No credit details found.</Text>
      </View>
    );
  }

  // Format data for display
  const creditType = creditDetails.type
    ? creditDetails.type.replace(/_/g, " ").toUpperCase()
    : "Credit Details";
  const amount =
    creditDetails.amount !== undefined
      ? `${creditDetails.amount} tCO2e`
      : "N/A";
  const price =
    creditDetails.price !== undefined
      ? `$${parseFloat(creditDetails.price).toFixed(2)}`
      : "N/A"; // Format price
  const status = creditDetails.status || "N/A";
  const verificationStatus = creditDetails.verificationStatus || "N/A";
  const description = creditDetails.description || "No description available.";
  const sellerName = creditDetails.seller?.name || "Unknown Seller";
  const sellerRating =
    creditDetails.seller?.rating !== undefined
      ? `${creditDetails.seller.rating}/5`
      : "N/A";
  const isAvailable = status === "available";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{creditType}</Text>
        <Text
          style={[
            styles.statusBadge,
            isAvailable ? styles.statusAvailable : styles.statusOther,
          ]}
        >
          {status}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Project Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Amount:</Text>
          <Text style={styles.value}>{amount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Price per Tonne:</Text>
          <Text style={styles.value}>{price}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Verification:</Text>
          <Text style={styles.value}>{verificationStatus}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Description</Text>
        <Text style={styles.descriptionText}>{description}</Text>
      </View>

      {creditDetails.seller && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seller Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{sellerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Rating:</Text>
            <Text style={styles.value}>{sellerRating}</Text>
          </View>
        </View>
      )}

      {/* Example: Displaying Verification Documents */}
      {creditDetails.verificationDocuments &&
        creditDetails.verificationDocuments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verification Documents</Text>
            {creditDetails.verificationDocuments.map((docUrl, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleOpenLink(docUrl)}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>View Document {index + 1}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

      <TouchableOpacity
        style={[styles.tradeButton, !isAvailable && styles.disabledButton]} // Use specific style for trade button
        onPress={() =>
          navigation.navigate("Trading", {
            creditId: creditDetails.id,
            price: creditDetails.price,
            availableAmount: creditDetails.amount,
          })
        }
        disabled={!isAvailable} // Disable if not available
      >
        <Text style={styles.tradeButtonText}>Initiate Trade</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  centered: {
    ...theme.layout.centered, // Use theme centered layout
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl, // Extra padding at bottom
  },
  headerContainer: {
    marginBottom: theme.spacing.lg,
    alignItems: "center",
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  statusBadge: {
    ...theme.typography.caption,
    fontWeight: "bold",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 12, // Pill shape
    overflow: "hidden",
    textTransform: "capitalize",
  },
  statusAvailable: {
    backgroundColor: `${theme.colors.success}30`,
    color: theme.colors.success,
  },
  statusOther: {
    backgroundColor: `${theme.colors.disabled}50`,
    color: theme.colors.textSecondary,
  },
  card: {
    ...theme.components.card, // Use theme card style
    marginBottom: theme.spacing.lg, // More space between cards
  },
  cardTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  label: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
  value: {
    ...theme.typography.body1,
    fontWeight: "500",
    color: theme.colors.text,
    flexShrink: 1,
    textAlign: "right",
  },
  descriptionText: {
    ...theme.typography.body1,
    lineHeight: 22,
  },
  linkButton: {
    paddingVertical: theme.spacing.sm,
  },
  linkText: {
    ...theme.typography.body1,
    color: theme.colors.primary,
    textDecorationLine: "underline",
  },
  tradeButton: {
    ...theme.components.button,
    marginTop: theme.spacing.md,
  },
  tradeButtonText: {
    ...theme.components.buttonText,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
  },
  errorText: {
    ...theme.typography.body1,
    color: theme.colors.error,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 40,
  },
});

export default CreditDetailScreen;
