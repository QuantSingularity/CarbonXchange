import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// Import the chart component
import { LineChart } from "react-native-chart-kit";
import { getMarketForecast, getMarketStats } from "../../services/api";
import theme from "../../styles/theme"; // Import the theme

const screenWidth = Dimensions.get("window").width;

const MarketDataScreen = () => {
  const [stats, setStats] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [errorStats, setErrorStats] = useState(null);
  const [errorForecast, setErrorForecast] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");

  const fetchMarketStats = useCallback(async () => {
    setIsLoadingStats(true);
    setErrorStats(null);
    try {
      const response = await getMarketStats();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setErrorStats(
          response.error?.message || "Failed to fetch market stats",
        );
      }
    } catch (err) {
      setErrorStats(
        err.response?.data?.message ||
          err.message ||
          "An error occurred while fetching stats",
      );
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const fetchMarketForecast = useCallback(async (timeframe = "24h") => {
    setIsLoadingForecast(true);
    setErrorForecast(null);
    setForecast(null); // Clear previous forecast
    try {
      // Assuming forecast API returns data suitable for charting, e.g., { labels: [...], datasets: [{ data: [...] }] }
      const response = await getMarketForecast({ timeframe, type: "price" });
      if (response.success && response.data) {
        // Basic validation for chart data structure
        if (
          response.data.labels &&
          response.data.labels.length > 0 &&
          response.data.datasets &&
          response.data.datasets.length > 0 &&
          response.data.datasets[0]?.data &&
          response.data.datasets[0].data.length > 0 &&
          response.data.labels.length === response.data.datasets[0].data.length
        ) {
          setForecast({ timeframe, type: "price", data: response.data });
        } else {
          console.warn(
            "Forecast API response format might not be suitable for chart or contains no data:",
            response.data,
          );
          // Set a default structure to avoid crashes, but show error
          setForecast({
            timeframe,
            type: "price",
            data: { labels: ["N/A"], datasets: [{ data: [0] }] },
          });
          setErrorForecast(
            "Received forecast data in unexpected format or it was empty.",
          );
        }
      } else {
        setErrorForecast(
          response.error?.message || "Failed to fetch market forecast",
        );
      }
    } catch (err) {
      setErrorForecast(
        err.response?.data?.message ||
          err.message ||
          "An error occurred while fetching forecast",
      );
    } finally {
      setIsLoadingForecast(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketStats();
    fetchMarketForecast(selectedTimeframe);
  }, [fetchMarketStats, fetchMarketForecast, selectedTimeframe]);

  const handleTimeframeChange = (timeframe) => {
    setSelectedTimeframe(timeframe);
    // fetchMarketForecast(timeframe); // Handled by useEffect
  };

  // Chart configuration
  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 2, // optional, defaults to 2dp
    color: (opacity = 1) =>
      `rgba(${parseInt(theme.colors.primary.slice(1, 3), 16)}, ${parseInt(theme.colors.primary.slice(3, 5), 16)}, ${parseInt(theme.colors.primary.slice(5, 7), 16)}, ${opacity})`, // Use theme primary color
    labelColor: (_opacity = 1) => theme.colors.textSecondary, // Use secondary text color for labels
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: theme.colors.secondary, // Use theme secondary for dots
    },
    propsForBackgroundLines: {
      stroke: theme.colors.border, // Lighter lines
      strokeDasharray: "", // Solid lines
    },
  };

  // Default chart data for initial render or error states
  const _defaultChartData = {
    labels: ["N/A"],
    datasets: [
      {
        data: [0],
        // Optional: Define color and strokeWidth directly in dataset if needed
        // color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
        // strokeWidth: 2
      },
    ],
    legend: ["Price Trend"], // Optional legend
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <Text style={styles.title}>Market Overview</Text>

      {/* Market Statistics Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Statistics</Text>
        {isLoadingStats ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : errorStats ? (
          <View style={styles.centeredMessageContainerSmall}>
            <Text style={styles.errorText}>{errorStats}</Text>
            <TouchableOpacity
              style={[theme.components.button, styles.retryButtonSmall]}
              onPress={fetchMarketStats}
            >
              <Text style={theme.components.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : stats ? (
          <View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Avg. Price:</Text>
              <Text style={styles.statValue}>
                ${stats.averagePrice?.toFixed(2) || "N/A"}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>24h Change:</Text>
              <Text
                style={[
                  styles.statValue,
                  stats.priceChange24h >= 0
                    ? styles.positiveChange
                    : styles.negativeChange,
                ]}
              >
                {stats.priceChange24h?.toFixed(2) || "N/A"}%
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>24h Volume:</Text>
              <Text style={styles.statValue}>
                {stats.volume24h?.toLocaleString() || "N/A"} tCO2e
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Volume:</Text>
              <Text style={styles.statValue}>
                {stats.totalVolume?.toLocaleString() || "N/A"} tCO2e
              </Text>
            </View>
          </View>
        ) : (
          <Text style={theme.typography.body1}>No statistics available.</Text>
        )}
      </View>

      {/* Market Forecast Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Price Forecast ({selectedTimeframe})
        </Text>

        {/* Timeframe Selector */}
        <View style={styles.timeframeSelector}>
          {["24h", "7d", "30d"].map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[
                styles.timeframeButton,
                selectedTimeframe === tf && styles.timeframeActive,
              ]}
              onPress={() => handleTimeframeChange(tf)}
              disabled={isLoadingForecast} // Disable while loading
            >
              <Text
                style={[
                  styles.timeframeText,
                  selectedTimeframe === tf && styles.timeframeActiveText,
                ]}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoadingForecast ? (
          <ActivityIndicator
            style={{ marginVertical: theme.spacing.xl }}
            color={theme.colors.primary}
            size="large"
          />
        ) : errorForecast ? (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.errorText}>{errorForecast}</Text>
            <TouchableOpacity
              style={[theme.components.button, styles.retryButton]}
              onPress={() => fetchMarketForecast(selectedTimeframe)}
            >
              <Text style={theme.components.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : forecast?.data?.labels?.length > 1 ? ( // Ensure there's more than one data point for a line
          <View style={styles.chartContainer}>
            <LineChart
              data={forecast.data} // Use data from state
              width={screenWidth - theme.spacing.lg * 2 - theme.spacing.md * 2} // Adjust width based on padding
              height={220}
              chartConfig={chartConfig}
              bezier // Makes the line smooth
              style={styles.chartStyle}
              // Optional: Hide points if too cluttered
              // withDots={forecast.data.labels.length < 15}
              // Optional: Hide labels if too cluttered
              // withHorizontalLabels={forecast.data.labels.length < 10}
              // withVerticalLabels={forecast.data.labels.length < 10}
            />
          </View>
        ) : (
          // Show message if data is valid but not enough points, or if initial state
          <Text
            style={[
              theme.typography.body1,
              { textAlign: "center", marginVertical: theme.spacing.lg },
            ]}
          >
            {forecast?.data?.labels?.length <= 1 && !errorForecast
              ? "Not enough data to display chart."
              : "No forecast data available."}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

// Use theme variables for styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
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
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  statLabel: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
  },
  statValue: {
    ...theme.typography.body1,
    fontWeight: "600",
  },
  positiveChange: {
    color: theme.colors.success,
  },
  negativeChange: {
    color: theme.colors.error,
  },
  timeframeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  timeframeActive: {
    backgroundColor: theme.colors.primary,
  },
  timeframeText: {
    ...theme.typography.button,
    fontSize: 14,
    color: theme.colors.primary,
  },
  timeframeActiveText: {
    color: theme.colors.surface,
  },
  chartContainer: {
    alignItems: "center",
    marginTop: theme.spacing.md,
    // Ensure chart doesn't overflow card padding
    marginHorizontal: -theme.spacing.md, // Counteract card padding if needed
  },
  chartStyle: {
    marginVertical: theme.spacing.sm,
    borderRadius: 16,
  },
  centeredMessageContainer: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
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

export default MarketDataScreen;
