import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserTrades, getWalletBalance } from "../../services/api";
import { logout } from "../../store/slices/authSlice";
import theme from "../../styles/theme"; // Import the theme

const WalletScreen = ({ navigation }) => {
  const [balance, setBalance] = useState(null);
  const [trades, setTrades] = useState([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorBalance, setErrorBalance] = useState(null);
  const [errorTrades, setErrorTrades] = useState(null);
  const [tradePage, setTradePage] = useState(1);
  const [totalTradePages, setTotalTradePages] = useState(1);

  // const { user } = useSelector((state) => state.auth); // User info if needed

  const fetchWalletBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    setErrorBalance(null);
    try {
      const response = await getWalletBalance();
      if (response.success && response.data) {
        setBalance(response.data);
      } else {
        setErrorBalance(
          response.error?.message || "Failed to fetch wallet balance",
        );
      }
    } catch (err) {
      setErrorBalance(
        err.response?.data?.message ||
          err.message ||
          "An error occurred while fetching balance",
      );
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const fetchUserTrades = useCallback(
    async (pageNum = 1, refreshing = false) => {
      if (!refreshing) {
        setIsLoadingTrades(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorTrades(null);
      try {
        const response = await getUserTrades({ page: pageNum, limit: 15 }); // Increased limit
        if (response.success && response.data?.trades) {
          setTrades(
            pageNum === 1
              ? response.data.trades
              : [...trades, ...response.data.trades],
          );
          setTotalTradePages(response.data.pages || 1);
          setTradePage(pageNum);
        } else {
          setErrorTrades(response.error?.message || "Failed to fetch trades");
        }
      } catch (err) {
        setErrorTrades(
          err.response?.data?.message ||
            err.message ||
            "An error occurred while fetching trades",
        );
      } finally {
        if (!refreshing) {
          setIsLoadingTrades(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [trades],
  ); // Include trades for correct appending

  const loadData = useCallback(
    (refreshing = false) => {
      fetchWalletBalance();
      fetchUserTrades(1, refreshing);
    },
    [fetchWalletBalance, fetchUserTrades],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    loadData(true);
  };

  const handleLoadMoreTrades = () => {
    if (!isLoadingTrades && !isRefreshing && tradePage < totalTradePages) {
      fetchUserTrades(tradePage + 1);
    }
  };

  const renderTradeItem = ({ item }) => (
    <View style={styles.tradeItemContainer}>
      <View style={styles.tradeItemHeader}>
        <Text style={styles.tradeItemType}>
          {item.type?.toUpperCase() || "N/A"}
        </Text>
        <Text style={styles.tradeItemDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.tradeItemDetail}>
        Credit ID: {item.creditId || "N/A"}
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

  const renderTradeFooter = () => {
    if (!isLoadingTrades || isRefreshing) return null;
    return (
      <ActivityIndicator
        style={{ marginVertical: theme.spacing.lg }}
        size="large"
        color={theme.colors.primary}
      />
    );
  };

  const renderEmptyTrades = () => {
    if (isLoadingTrades || isRefreshing) return null;
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={styles.emptyText}>No trade history found.</Text>
        {errorTrades && <Text style={styles.errorText}>{errorTrades}</Text>}
        <TouchableOpacity
          style={[theme.components.button, styles.retryButton]}
          onPress={() => fetchUserTrades(1)}
        >
          <Text style={theme.components.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch(logout());
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Wallet</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons
            name="log-out-outline"
            size={24}
            color={theme.colors.error}
          />
        </TouchableOpacity>
      </View>

      {/* Balance Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Balance</Text>
        {isLoadingBalance ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : errorBalance ? (
          <View style={styles.centeredMessageContainerSmall}>
            <Text style={styles.errorText}>{errorBalance}</Text>
            <TouchableOpacity
              style={[theme.components.button, styles.retryButtonSmall]}
              onPress={fetchWalletBalance}
            >
              <Text style={theme.components.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : balance ? (
          <View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Token Balance:</Text>
              {/* Assuming token balance needs formatting */}
              <Text style={styles.balanceValue}>
                {balance.tokenBalance?.toLocaleString() || "0"} TOK
              </Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Credit Holdings:</Text>
              <Text style={styles.balanceValue}>
                {balance.creditBalance || "0"} tCO2e
              </Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Pending Trades:</Text>
              <Text style={styles.balanceValue}>
                {balance.pendingTrades || "0"}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={theme.typography.body1}>
            No balance information available.
          </Text>
        )}
      </View>

      {/* Trade History Section - Using FlatList */}
      <Text style={styles.sectionTitle}>Recent Trade History</Text>
      <FlatList
        data={trades}
        renderItem={renderTradeItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        style={styles.tradeList}
        contentContainerStyle={styles.tradeListContent}
        onEndReached={handleLoadMoreTrades}
        onEndReachedThreshold={0.6}
        ListFooterComponent={renderTradeFooter}
        ListEmptyComponent={renderEmptyTrades}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  logoutButton: {
    padding: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
  },
  card: {
    ...theme.components.card,
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  balanceLabel: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
  },
  balanceValue: {
    ...theme.typography.body1,
    fontWeight: "600",
  },
  sectionTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm, // Add some space above if needed
  },
  tradeList: {
    flex: 1, // Make list take remaining space
  },
  tradeListContent: {
    paddingBottom: theme.spacing.lg, // Space at the bottom of the list
  },
  tradeItemContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.components.card.borderRadius,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tradeItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  tradeItemType: {
    ...theme.typography.body1,
    fontWeight: "bold",
    color: theme.colors.primary,
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
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xl, // Push message down a bit
  },
  centeredMessageContainerSmall: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
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
  retryButtonSmall: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    minHeight: 35,
  },
});

export default WalletScreen;
