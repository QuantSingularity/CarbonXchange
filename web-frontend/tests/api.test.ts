import { describe, expect, it, vi } from "vitest";
import {
  getMockCarbonCredits,
  getMockHistoricalData,
  getMockMarketStats,
  getMockOrders,
  getMockPortfolio,
  isUsingMockData,
  MockSocket,
} from "../src/services/api";

describe("API Service", () => {
  describe("getMockMarketStats", () => {
    it("returns valid data structure", () => {
      const stats = getMockMarketStats();
      expect(stats).toHaveProperty("success", true);
      expect(stats.data).toHaveProperty("averagePrice");
      expect(stats.data).toHaveProperty("priceChange24h");
      expect(stats.data).toHaveProperty("volume24h");
      expect(stats.data).toHaveProperty("totalVolume");
      expect(stats.data).toHaveProperty("lastUpdated");
      expect(typeof stats.data.averagePrice).toBe("number");
      expect(stats.data.averagePrice).toBeGreaterThan(0);
    });

    it("returns prices in a realistic range", () => {
      for (let i = 0; i < 10; i++) {
        const stats = getMockMarketStats();
        expect(stats.data.averagePrice).toBeGreaterThanOrEqual(25);
        expect(stats.data.averagePrice).toBeLessThanOrEqual(30);
      }
    });

    it("returns a valid ISO date string for lastUpdated", () => {
      const stats = getMockMarketStats();
      expect(() => new Date(stats.data.lastUpdated)).not.toThrow();
    });
  });

  describe("getMockCarbonCredits", () => {
    it("returns array of credits", () => {
      const credits = getMockCarbonCredits();
      expect(credits).toHaveProperty("success", true);
      expect(Array.isArray(credits.data)).toBe(true);
      expect(credits.data.length).toBeGreaterThan(0);
    });

    it("each credit has required fields", () => {
      const credits = getMockCarbonCredits();
      for (const credit of credits.data) {
        expect(credit).toHaveProperty("id");
        expect(credit).toHaveProperty("name");
        expect(credit).toHaveProperty("type");
        expect(credit).toHaveProperty("price");
        expect(credit).toHaveProperty("available");
        expect(credit).toHaveProperty("vintage");
        expect(credit).toHaveProperty("verificationStandard");
        expect(credit).toHaveProperty("location");
        expect(credit).toHaveProperty("description");
      }
    });

    it("credits have positive prices", () => {
      const credits = getMockCarbonCredits();
      for (const credit of credits.data) {
        expect(credit.price).toBeGreaterThan(0);
        expect(credit.available).toBeGreaterThan(0);
      }
    });

    it("returns total count matching data length", () => {
      const credits = getMockCarbonCredits();
      expect(credits.total).toBe(credits.data.length);
    });
  });

  describe("getMockPortfolio", () => {
    it("returns valid portfolio structure", () => {
      const portfolio = getMockPortfolio();
      expect(portfolio).toHaveProperty("success", true);
      expect(portfolio.data).toHaveProperty("totalValue");
      expect(portfolio.data).toHaveProperty("totalCredits");
      expect(portfolio.data).toHaveProperty("holdings");
      expect(Array.isArray(portfolio.data.holdings)).toBe(true);
    });

    it("holdings have required fields", () => {
      const portfolio = getMockPortfolio();
      for (const holding of portfolio.data.holdings) {
        expect(holding).toHaveProperty("creditId");
        expect(holding).toHaveProperty("quantity");
        expect(holding).toHaveProperty("averagePrice");
        expect(holding).toHaveProperty("currentPrice");
        expect(holding).toHaveProperty("profitLoss");
        expect(holding).toHaveProperty("profitLossPercent");
        expect(holding).toHaveProperty("value");
      }
    });
  });

  describe("getMockOrders", () => {
    it("returns valid orders structure", () => {
      const orders = getMockOrders();
      expect(orders).toHaveProperty("success", true);
      expect(Array.isArray(orders.data)).toBe(true);
    });

    it("each order has required fields", () => {
      const orders = getMockOrders();
      for (const order of orders.data) {
        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("creditId");
        expect(order).toHaveProperty("creditName");
        expect(order).toHaveProperty("orderType");
        expect(order).toHaveProperty("quantity");
        expect(order).toHaveProperty("price");
        expect(order).toHaveProperty("status");
        expect(order).toHaveProperty("createdAt");
      }
    });

    it("orders have valid orderType values", () => {
      const orders = getMockOrders();
      for (const order of orders.data) {
        expect(["buy", "sell"]).toContain(order.orderType);
      }
    });
  });

  describe("getMockHistoricalData", () => {
    it("returns data for all timeframes", () => {
      for (const timeframe of ["1h", "24h", "7d", "30d"]) {
        const result = getMockHistoricalData(timeframe, "price");
        expect(result.success).toBe(true);
        expect(result.data.points.length).toBeGreaterThan(0);
        expect(result.data.timeframe).toBe(timeframe);
      }
    });

    it("each data point has timestamp, price, and volume", () => {
      const result = getMockHistoricalData("24h", "price");
      for (const point of result.data.points) {
        expect(typeof point.timestamp).toBe("number");
        expect(typeof point.price).toBe("number");
        expect(typeof point.volume).toBe("number");
        expect(point.price).toBeGreaterThan(0);
      }
    });

    it("data points are in chronological order", () => {
      const result = getMockHistoricalData("24h", "price");
      const timestamps = result.data.points.map((p) => p.timestamp);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    });
  });

  describe("isUsingMockData", () => {
    it("returns a boolean", () => {
      expect(typeof isUsingMockData()).toBe("boolean");
    });
  });

  describe("MockSocket", () => {
    it("registers and triggers event callbacks", () => {
      const socket = new MockSocket();
      const callback = vi.fn();
      socket.on("test_event", callback);
      socket.trigger("test_event", { data: "hello" });
      expect(callback).toHaveBeenCalledWith({ data: "hello" });
    });

    it("removes listeners with off()", () => {
      const socket = new MockSocket();
      const callback = vi.fn();
      socket.on("test_event", callback);
      socket.off("test_event", callback);
      socket.trigger("test_event", {});
      expect(callback).not.toHaveBeenCalled();
    });

    it("starts market data interval on subscribe emit", () => {
      vi.useFakeTimers();
      const socket = new MockSocket();
      const callback = vi.fn();
      socket.on("market_data_update", callback);
      socket.emit("subscribe_market_data");
      vi.advanceTimersByTime(5100);
      expect(callback).toHaveBeenCalled();
      socket.disconnect();
      vi.useRealTimers();
    });

    it("clears intervals on disconnect", () => {
      vi.useFakeTimers();
      const socket = new MockSocket();
      const callback = vi.fn();
      socket.on("market_data_update", callback);
      socket.emit("subscribe_market_data");
      socket.disconnect();
      vi.advanceTimersByTime(10000);
      expect(callback).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
