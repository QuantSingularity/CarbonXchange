import { describe, expect, it } from "vitest";
import {
  getMockCarbonCredits,
  getMockMarketStats,
  getMockPortfolio,
} from "../src/services/api";

describe("API Service", () => {
  describe("Mock Data Functions", () => {
    it("getMockMarketStats returns valid data structure", () => {
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

    it("getMockCarbonCredits returns array of credits", () => {
      const credits = getMockCarbonCredits();

      expect(credits).toHaveProperty("success", true);
      expect(Array.isArray(credits.data)).toBe(true);
      expect(credits.data.length).toBeGreaterThan(0);

      const credit = credits.data[0];
      expect(credit).toHaveProperty("id");
      expect(credit).toHaveProperty("name");
      expect(credit).toHaveProperty("type");
      expect(credit).toHaveProperty("price");
      expect(credit).toHaveProperty("available");
      expect(credit).toHaveProperty("vintage");
    });

    it("getMockPortfolio returns valid portfolio structure", () => {
      const portfolio = getMockPortfolio();

      expect(portfolio).toHaveProperty("success", true);
      expect(portfolio.data).toHaveProperty("totalValue");
      expect(portfolio.data).toHaveProperty("totalCredits");
      expect(portfolio.data).toHaveProperty("holdings");
      expect(Array.isArray(portfolio.data.holdings)).toBe(true);

      if (portfolio.data.holdings.length > 0) {
        const holding = portfolio.data.holdings[0];
        expect(holding).toHaveProperty("creditId");
        expect(holding).toHaveProperty("quantity");
        expect(holding).toHaveProperty("averagePrice");
        expect(holding).toHaveProperty("currentPrice");
        expect(holding).toHaveProperty("profitLoss");
      }
    });
  });
});
