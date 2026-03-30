import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getCredits } from "../../services/api";
import theme from "../../styles/theme"; // Import the theme

// Debounce hook (simple implementation)
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const CreditsListScreen = ({ navigation }) => {
  const [credits, setCredits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // 500ms debounce delay

  const fetchCredits = useCallback(
    async (pageNum = 1, refreshing = false, search = "") => {
      // Determine loading state based on refresh or initial load
      if (!refreshing && pageNum === 1) {
        setIsLoading(true); // Show main loader only on initial load/search
      } else if (refreshing) {
        setIsRefreshing(true);
      }
      // Don't show main loader when loading more pages

      setError(null);
      try {
        const params = { page: pageNum, limit: 15 };
        if (search) {
          params.search = search; // Add search query to API params if present
        }
        const response = await getCredits(params);

        if (response.success && response.data?.credits) {
          // If it's page 1 (new search or refresh), replace data. Otherwise, append.
          setCredits(
            pageNum === 1
              ? response.data.credits
              : [...credits, ...response.data.credits],
          );
          setTotalPages(response.data.pages || 1);
          setPage(pageNum);
        } else {
          // If page 1 fails, show error. If loading more fails, maybe just log it?
          if (pageNum === 1) {
            setCredits([]); // Clear credits on error for page 1
            setError(response.error?.message || "Failed to fetch credits");
          }
          console.error("API Error fetching credits:", response.error?.message);
        }
      } catch (err) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "An error occurred while fetching credits";
        if (pageNum === 1) {
          setCredits([]); // Clear credits on error for page 1
          setError(errorMessage);
        }
        console.error("Network/Fetch Error:", errorMessage);
      } finally {
        // Reset loading states
        if (!refreshing && pageNum === 1) {
          setIsLoading(false);
        } else if (refreshing) {
          setIsRefreshing(false);
        }
      }
    },
    [credits],
  ); // Include credits for appending logic

  // Effect for handling debounced search query changes
  useEffect(() => {
    // Fetch page 1 whenever the debounced search query changes
    fetchCredits(1, false, debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchCredits]);

  // Initial fetch (now handled by the search effect)
  // useEffect(() => {
  //   fetchCredits(1, false, debouncedSearchQuery);
  // }, [fetchCredits]);

  const handleLoadMore = () => {
    // Load more only if not already loading/refreshing and there are more pages
    if (!isLoading && !isRefreshing && page < totalPages) {
      fetchCredits(page + 1, false, debouncedSearchQuery);
    }
  };

  const onRefresh = () => {
    // Refresh fetches page 1 with the current debounced search query
    fetchCredits(1, true, debouncedSearchQuery);
  };

  const renderCreditItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => navigation.navigate("CreditDetail", { creditId: item.id })}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemType}>
          {item.type
            ? item.type.replace(/_/g, " ").toUpperCase()
            : "Unknown Type"}
        </Text>
        <Text
          style={[
            styles.itemStatus,
            item.status === "available"
              ? styles.statusAvailable
              : styles.statusOther,
          ]}
        >
          {item.status || "N/A"}
        </Text>
      </View>
      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Amount:</Text>
        <Text style={styles.itemValue}>
          {item.amount !== undefined ? `${item.amount} tCO2e` : "N/A"}
        </Text>
      </View>
      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Price:</Text>
        {/* Ensure price is formatted correctly */}
        <Text style={styles.itemValue}>
          {item.price !== undefined
            ? `$${parseFloat(item.price).toFixed(2)}`
            : "N/A"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    // Show footer loader only when loading more pages (isLoading is false, isRefreshing is false, page < totalPages)
    if (!isLoading && !isRefreshing && page < totalPages) {
      // Check if we are actually in the process of loading more
      // This requires a separate state, or inferring from isLoading state changes
      // For simplicity, let's assume if page < totalPages, a fetch might be in progress
      // A better approach might involve a specific isLoadingMore state
      return (
        <ActivityIndicator
          style={{ marginVertical: theme.spacing.lg }}
          size="large"
          color={theme.colors.primary}
        />
      );
    }
    return null;
  };

  const renderEmpty = () => {
    // Don't show empty/error message while initial loading or refreshing
    if (isLoading || isRefreshing) return null;

    const message = error
      ? error
      : debouncedSearchQuery
        ? `No credits found matching "${debouncedSearchQuery}".`
        : "No carbon credits available.";

    const isError = !!error;

    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={isError ? styles.errorText : styles.emptyText}>
          {message}
        </Text>
        <TouchableOpacity
          style={[theme.components.button, styles.retryButton]}
          onPress={onRefresh} // Use onRefresh to retry (fetches page 1 with current search)
        >
          <Text style={theme.components.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search credits (e.g., type, location)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textSecondary}
          clearButtonMode="while-editing" // iOS clear button
        />
        {/* Add filter button if needed */}
        {/* <TouchableOpacity style={styles.filterButton}><Text>Filter</Text></TouchableOpacity> */}
      </View>

      {/* Show main loader only during initial load */}
      {isLoading && credits.length === 0 && (
        <ActivityIndicator
          style={{ marginTop: theme.spacing.xl }}
          size="large"
          color={theme.colors.primary}
        />
      )}

      <FlatList
        data={credits}
        renderItem={renderCreditItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContentContainer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty} // Handles both empty and error states
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        // Hide list while initial loading to prevent showing 'empty' briefly
        style={isLoading && credits.length === 0 ? { display: "none" } : {}}
      />
    </View>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    ...theme.components.input,
    marginBottom: 0, // Remove default margin if inside search container
  },
  listContentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl, // Ensure space at the bottom
  },
  itemContainer: {
    ...theme.components.card,
    marginBottom: theme.spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  itemType: {
    ...theme.typography.h3,
    fontSize: 18,
    color: theme.colors.primary,
    flexShrink: 1,
  },
  itemStatus: {
    ...theme.typography.caption,
    fontWeight: "bold",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 4,
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
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  itemLabel: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
  },
  itemValue: {
    ...theme.typography.body1,
    fontWeight: "500",
  },
  centeredMessageContainer: {
    flex: 1, // Ensure it takes space if list is empty
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    marginTop: theme.height * 0.15, // Adjust vertical position
  },
  errorText: {
    ...theme.typography.body1,
    color: theme.colors.error,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
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

export default CreditsListScreen;
