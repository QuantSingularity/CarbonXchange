import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  getMarketStats,
  getMockMarketStats,
  isUsingMockData,
  subscribeToMarketData,
} from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface MarketStatsProps {
  className?: string;
}

interface MarketStatsData {
  averagePrice: number;
  priceChange24h: number;
  volume24h: number;
  totalVolume: number;
  lastUpdated: string;
}

const MarketStats: React.FC<MarketStatsProps> = ({ className }) => {
  const [stats, setStats] = useState<MarketStatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial data fetch
    fetchMarketStats();

    // Set up real-time updates
    const unsubscribe = subscribeToMarketData((data) => {
      if (data?.price) {
        setStats((prevStats) => {
          if (!prevStats) return null;

          // Calculate new average based on incoming data
          const newAvgPrice = prevStats.averagePrice * 0.95 + data.price * 0.05;

          return {
            ...prevStats,
            averagePrice: newAvgPrice,
            priceChange24h:
              data.change !== undefined
                ? data.change
                : prevStats.priceChange24h,
            lastUpdated: new Date().toISOString(),
          };
        });
      }
    });

    // Set up interval for periodic full refreshes
    const intervalId = setInterval(() => {
      fetchMarketStats();
    }, 60000); // Full refresh every minute

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [fetchMarketStats]);

  const fetchMarketStats = async () => {
    setLoading(true);
    try {
      let response;

      if (isUsingMockData()) {
        response = getMockMarketStats();
      } else {
        response = await getMarketStats();
      }

      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching market stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Average Price</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-10">
              <div className="animate-pulse h-6 w-20 bg-muted rounded"></div>
            </div>
          ) : (
            <div className="text-2xl font-bold">
              ${stats?.averagePrice.toFixed(2)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">24h Change</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-10">
              <div className="animate-pulse h-6 w-20 bg-muted rounded"></div>
            </div>
          ) : (
            <div className="flex items-center">
              <span
                className={`text-2xl font-bold ${stats?.priceChange24h && stats.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {stats?.priceChange24h.toFixed(2)}%
              </span>
              {stats?.priceChange24h && stats.priceChange24h >= 0 ? (
                <ArrowUpIcon className="ml-2 h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownIcon className="ml-2 h-4 w-4 text-red-500" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-10">
              <div className="animate-pulse h-6 w-20 bg-muted rounded"></div>
            </div>
          ) : (
            <div className="text-2xl font-bold">
              {stats?.volume24h.toLocaleString()} tCO2e
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default MarketStats;
