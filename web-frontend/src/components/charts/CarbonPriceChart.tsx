import { Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface DataPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

const CarbonPriceChart: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<"1h" | "24h" | "7d" | "30d">(
    "24h",
  );
  const [isLive, setIsLive] = useState<boolean>(true);

  // Function to generate realistic carbon price data
  const generateHistoricalData = useCallback(
    (timeframe: string): DataPoint[] => {
      const now = Date.now();
      const points: DataPoint[] = [];
      let interval: number;
      let count: number;

      // Set interval and count based on timeframe
      switch (timeframe) {
        case "1h":
          interval = 60 * 1000; // 1 minute
          count = 60;
          break;
        case "24h":
          interval = 15 * 60 * 1000; // 15 minutes
          count = 96;
          break;
        case "7d":
          interval = 2 * 60 * 60 * 1000; // 2 hours
          count = 84;
          break;
        case "30d":
          interval = 8 * 60 * 60 * 1000; // 8 hours
          count = 90;
          break;
        default:
          interval = 15 * 60 * 1000;
          count = 96;
      }

      // Base price with some randomness
      let basePrice = 25;

      // Generate data points
      for (let i = count - 1; i >= 0; i--) {
        const timestamp = now - i * interval;

        // Add some realistic price movements
        // More volatility for shorter timeframes
        const volatility =
          timeframe === "1h" ? 0.2 : timeframe === "24h" ? 0.5 : 1;
        const change = (Math.random() - 0.48) * volatility; // Slight upward bias
        basePrice = Math.max(basePrice + change, 10); // Ensure price doesn't go below 10

        points.push({
          timestamp,
          price: parseFloat(basePrice.toFixed(2)),
          volume: Math.floor(1000 + Math.random() * 5000),
        });
      }

      return points;
    },
    [],
  );

  // Function to fetch data based on timeframe
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate with generated data
      const newData = generateHistoricalData(timeframe);
      setData(newData);
    } catch (error) {
      console.error("Error fetching price data:", error);
    } finally {
      setLoading(false);
    }
  }, [timeframe, generateHistoricalData]);

  // Function to add a new data point (for live updates)
  const addDataPoint = useCallback(() => {
    if (!isLive) return;

    setData((prevData) => {
      if (!prevData.length) return prevData;

      const lastPoint = prevData[prevData.length - 1];
      const lastPrice = lastPoint.price;

      // Calculate new price with realistic movement
      const change = (Math.random() - 0.48) * 0.2; // Slight upward bias
      const newPrice = Math.max(lastPrice + change, 10);

      // Add new point and remove oldest if needed
      const newData = [
        ...prevData,
        {
          timestamp: Date.now(),
          price: parseFloat(newPrice.toFixed(2)),
          volume: Math.floor(1000 + Math.random() * 5000),
        },
      ];

      // Keep the array at a reasonable size
      if (newData.length > 100) {
        return newData.slice(1);
      }

      return newData;
    });
  }, [isLive]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up live updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      addDataPoint();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, [addDataPoint]);

  // Format timestamp for display
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);

    switch (timeframe) {
      case "1h":
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "24h":
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "7d":
        return (
          date.toLocaleDateString([], { month: "short", day: "numeric" }) +
          " " +
          date.toLocaleTimeString([], { hour: "2-digit" })
        );
      case "30d":
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      default:
        return date.toLocaleTimeString();
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <Card className="bg-background border shadow-md">
          <CardContent className="p-3">
            <p className="text-sm font-medium">
              {new Date(label).toLocaleString()}
            </p>
            <p className="text-sm text-primary">Price: ${payload[0].value}</p>
            {payload[1] && (
              <p className="text-sm text-secondary">
                Volume: {payload[1].value} tCO2e
              </p>
            )}
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <Button
            variant={timeframe === "1h" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeframe("1h")}
          >
            1H
          </Button>
          <Button
            variant={timeframe === "24h" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeframe("24h")}
          >
            24H
          </Button>
          <Button
            variant={timeframe === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeframe("7d")}
          >
            7D
          </Button>
          <Button
            variant={timeframe === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeframe("30d")}
          >
            30D
          </Button>
        </div>
        <Button
          variant={isLive ? "default" : "outline"}
          size="sm"
          onClick={() => setIsLive(!isLive)}
          className={isLive ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {isLive ? "Live" : "Paused"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#444"
                opacity={0.1}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                stroke="#888"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 12 }}
                stroke="#888"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                name="Carbon Credit Price"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                isAnimationActive={!isLive}
              />
              <Brush
                dataKey="timestamp"
                height={30}
                stroke="#888"
                tickFormatter={formatXAxis}
                startIndex={Math.max(0, data.length - 30)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">Price Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/20 p-3 rounded-md">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-bold">
              ${data.length ? data[data.length - 1].price.toFixed(2) : "0.00"}
            </p>
          </div>
          <div className="bg-muted/20 p-3 rounded-md">
            <p className="text-xs text-muted-foreground">24h High</p>
            <p className="text-lg font-bold">
              $
              {data.length
                ? Math.max(...data.slice(-96).map((d) => d.price)).toFixed(2)
                : "0.00"}
            </p>
          </div>
          <div className="bg-muted/20 p-3 rounded-md">
            <p className="text-xs text-muted-foreground">24h Low</p>
            <p className="text-lg font-bold">
              $
              {data.length
                ? Math.min(...data.slice(-96).map((d) => d.price)).toFixed(2)
                : "0.00"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarbonPriceChart;
