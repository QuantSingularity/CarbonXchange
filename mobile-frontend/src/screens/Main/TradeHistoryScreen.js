import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserTrades } from "../../services/api"; // Import the API function
import theme from "../../styles/theme"; // Import the theme

const TradeHistoryScreen = ({ navigation }) => {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUserTrades = useCallback(
    async (pageNum = 1, refreshing = false) => {
      if (!refreshing && pageNum === 1) {
        setIsLoading(true); // Show loader only on initial load
      } else if (refreshing) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const response = await getUserTrades({ page: pageNum, limit: 15 }); // Use pagination
        if (response.success && response.data?.trades) {
          setTrades(
            pageNum === 1
              ? response.data.trades
              : [...trades, ...response.data.trades],
          );
          setTotalPages(response.data.pages || 1);
          setPage(pageNum);
        } else {
          if (pageNum === 1) {
            setTrades([]);
            setError(
              response.error?.message || "Failed to fetch trade history",
            );
          }
          console.error("API Error fetching trades:", response.error?.message);
        }
      } catch (err) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "An error occurred while fetching trade history";
        if (pageNum === 1) {
          setTrades([]);
          setError(errorMessage);
        }
        console.error("Network/Fetch Error:", errorMessage);
      } finally {
        if (!refreshing && pageNum === 1) {
          setIsLoading(false);
        } else if (refreshing) {
          setIsRefreshing(false);
        }
      }
    },
    [trades],
  ); // Include trades for appending logic

  useEffect(() => {
    // Fetch trades when the screen focuses (useful for tab navigation)
    const unsubscribe = navigation.addListener("focus", () => {
      fetchUserTrades(1); // Fetch first page on focus
    });

    // Initial fetch
    fetchUserTrades(1);

    return unsubscribe; // Cleanup listener on unmount
  }, [fetchUserTrades, navigation]);

  const handleLoadMore = () => {
    if (!isLoading && !isRefreshing && page < totalPages) {
      fetchUserTrades(page + 1);
    }
  };

  const onRefresh = () => {
    fetchUserTrades(1, true);
  };

  const renderTradeItem = ({ item }) => (
    <View style={styles.tradeItemContainer}>
      <View style={styles.tradeItemHeader}>
        <Text
          style={[
            styles.tradeItemType,
            item.type === "buy" ? styles.buyType : styles.sellType,
          ]}
        >
          {item.type?.toUpperCase() || "N/A"}
        </Text>
        <Text style={styles.tradeItemDate}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      <Text
        style={styles.tradeItemDetail}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        Credit: {item.creditId || "N/A"}
      </Text>
      <View style={styles.tradeItemRow}>
        <Text style={styles.tradeItemDetail}>Amount: {item.amount} tCO2e</Text>
        <Text style={styles.tradeItemDetail}>
          Price: ${item.price?.toFixed(2)}
        </Text>
      </View>
      <Text style={styles.tradeItemStatus}>Status: {item.status || "N/A"}</Text>
    </View>
  );

  const renderFooter = () => {
    // Show footer loader only when loading more pages
    if (!isLoading && !isRefreshing && page < totalPages) {
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
    if (isLoading || isRefreshing) return null;
    const message = error ? error : "No trade history found.";
    const isError = !!error;

    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={isError ? styles.errorText : styles.emptyText}>
          {message}
        </Text>
        <TouchableOpacity
          style={[theme.components.button, styles.retryButton]}
          onPress={onRefresh} // Use onRefresh to retry
        >
          <Text style={theme.components.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade History</Text>

      {isLoading && trades.length === 0 && (
        <ActivityIndicator
          style={{ marginTop: theme.spacing.xl }}
          size="large"
          color={theme.colors.primary}
        />
      )}

      <FlatList
        data={trades}
        renderItem={renderTradeItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContentContainer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        style={isLoading && trades.length === 0 ? { display: "none" } : {}}
      />
    </View>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  listContentContainer: {
    paddingBottom: theme.spacing.xl, // Space at the bottom of the list
  },
  tradeItemContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.components.card.borderRadius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.layout.shadow,
  },
  tradeItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  tradeItemType: {
    ...theme.typography.body1,
    fontWeight: "bold",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 4,
    overflow: "hidden",
  },
  buyType: {
    backgroundColor: `${theme.colors.success}30`,
    color: theme.colors.success,
  },
  sellType: {
    backgroundColor: `${theme.colors.error}30`,
    color: theme.colors.error,
  },
  tradeItemDate: {
    ...theme.typography.caption,
  },
  tradeItemDetail: {
    ...theme.typography.body2,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  tradeItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tradeItemStatus: {
    ...theme.typography.caption,
    marginTop: theme.spacing.xs,
    fontStyle: "italic",
    color: theme.colors.textSecondary,
    textTransform: "capitalize",
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    marginTop: theme.height * 0.15,
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

export default TradeHistoryScreen;
