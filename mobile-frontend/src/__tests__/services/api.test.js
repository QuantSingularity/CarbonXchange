// Mock SecureStore first - this needs to be at the top
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// __mocks__/axios.js will be used automatically by Jest since we are importing "axios"
// and there is no explicit jest.mock("axios", ...) in this file anymore.

// Import the mocked axios to get references to the mock functions from __mocks__/axios.js
import axios from "axios";

// Import the mocked SecureStore to allow clearing/resetting its functions
import * as SecureStore from "expo-secure-store";
// Import the SUT (System Under Test).
// IMPORTANT: This must come AFTER jest.mock for SecureStore and implicitly after __mocks__/axios.js is set to be used.
import {
  createCredit,
  createTrade,
  getCreditById,
  getCredits,
  getMarketForecast,
  getMarketStats,
  getUserTrades,
  getWalletBalance,
  login,
  logoutUser,
  register,
} from "../../services/api";

describe("Mobile API Service", () => {
  // Get references to the mock functions from the auto-mocked axios instance.
  // axios.create() is a jest.fn() from __mocks__/axios.js which returns the predefined mockAxiosInstance.
  // So, every call to axios.create() in the SUT (api.js) will get this same instance.
  const mockedAxiosInstance = axios.create(); // This retrieves the mockAxiosInstance from __mocks__/axios.js
  const mockPost = mockedAxiosInstance.post;
  const mockGet = mockedAxiosInstance.get;
  const mockRequestUse = mockedAxiosInstance.interceptors.request.use;
  const mockResponseUse = mockedAxiosInstance.interceptors.response.use; // If needed

  beforeEach(() => {
    // Clear/reset all mock functions before each test
    mockPost.mockClear().mockReset();
    mockGet.mockClear().mockReset();

    // Reset mockRequestUse to its default successful behavior from __mocks__/axios.js
    // The implementation in __mocks__/axios.js is: (successCb, errorCb) => { if (successCb) return Promise.resolve(successCb({ headers: {} })); return Promise.resolve({ headers: {} }); }
    mockRequestUse.mockClear().mockImplementation((successCb, _errorCb) => {
      if (successCb) return Promise.resolve(successCb({ headers: {} }));
      return Promise.resolve({ headers: {} });
    });
    mockResponseUse.mockClear(); // If you start using response interceptors

    // Clear and reset SecureStore mocks
    SecureStore.getItemAsync.mockClear().mockReset();
    SecureStore.setItemAsync.mockClear().mockReset();
    SecureStore.deleteItemAsync.mockClear().mockReset();
  });

  describe("Authentication", () => {
    it("login should call API, save token on success, and return data", async () => {
      const mockEmail = "test@example.com";
      const mockPassword = "password123";
      const mockToken = "fake-jwt-token";
      const mockResponse = {
        data: {
          success: true,
          token: mockToken,
          user: { id: 1, email: mockEmail },
        },
      };
      mockPost.mockResolvedValue(mockResponse);
      SecureStore.setItemAsync.mockResolvedValue(null);
      SecureStore.getItemAsync.mockResolvedValue(mockToken); // For interceptor if it runs

      const result = await login(mockEmail, mockPassword);

      expect(mockPost).toHaveBeenCalledWith("/auth/login", {
        email: mockEmail,
        password: mockPassword,
      });
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "userToken",
        mockToken,
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("login should throw error and not save token on API failure", async () => {
      const mockEmail = "test@example.com";
      const mockPassword = "password123";
      const mockError = {
        response: { data: { success: false, message: "Invalid credentials" } },
      };
      mockPost.mockRejectedValue(mockError);

      await expect(login(mockEmail, mockPassword)).rejects.toEqual(mockError);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it("register should call API, save token on success, and return data", async () => {
      const userData = {
        username: "newuser",
        email: "new@example.com",
        password: "newpassword",
      };
      const mockToken = "new-fake-jwt-token";
      const mockResponse = {
        data: { success: true, token: mockToken, userId: "newUser123" },
      };
      mockPost.mockResolvedValue(mockResponse);
      SecureStore.setItemAsync.mockResolvedValue(null);
      SecureStore.getItemAsync.mockResolvedValue(mockToken);

      const result = await register(userData);

      expect(mockPost).toHaveBeenCalledWith("/auth/register", userData);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "userToken",
        mockToken,
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("logoutUser should remove token", async () => {
      SecureStore.deleteItemAsync.mockResolvedValue(null);
      await logoutUser();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("userToken");
    });
  });

  describe("Carbon Credits API", () => {
    it("getCredits should call API and return data", async () => {
      const mockCreditsData = [{ id: "1", name: "Credit A" }];
      const mockResponse = {
        data: { success: true, credits: mockCreditsData },
      };
      mockGet.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await getCredits();
      // Check if the request interceptor was set up (called by api.js)
      // The mockRequestUse is the .use function itself.
      // expect(mockRequestUse).toHaveBeenCalled(); // Interceptor is setup once, not per call necessarily
      expect(mockGet).toHaveBeenCalledWith("/credits", { params: {} });
      expect(result).toEqual(mockResponse.data);
    });

    it("getCreditById should call API with ID and return data", async () => {
      const creditId = "123";
      const mockCreditData = { id: creditId, name: "Specific Credit" };
      const mockResponse = { data: { success: true, credit: mockCreditData } };
      mockGet.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await getCreditById(creditId);

      expect(mockGet).toHaveBeenCalledWith(`/credits/${creditId}`);
      expect(result).toEqual(mockResponse.data);
    });

    it("createCredit should call API with credit data and return response", async () => {
      const creditData = { name: "New Credit", tons: 100 };
      const mockResponseData = { ...creditData, id: "newId" };
      const mockResponse = {
        data: { success: true, credit: mockResponseData },
      };
      mockPost.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await createCredit(creditData);

      expect(mockPost).toHaveBeenCalledWith("/credits", creditData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("Trading API", () => {
    it("createTrade should call API with trade data and return response", async () => {
      const tradeData = { creditId: "1", quantity: 10, type: "buy" };
      const mockResponseData = { ...tradeData, id: "trade123" };
      const mockResponse = { data: { success: true, trade: mockResponseData } };
      mockPost.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await createTrade(tradeData);

      expect(mockPost).toHaveBeenCalledWith("/trades", tradeData);
      expect(result).toEqual(mockResponse.data);
    });

    it("getUserTrades should call API and return user trades", async () => {
      const mockTradesData = [{ id: "trade1", creditId: "1", quantity: 5 }];
      const mockResponse = { data: { success: true, trades: mockTradesData } };
      mockGet.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await getUserTrades();

      expect(mockGet).toHaveBeenCalledWith("/trades/user", { params: {} });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("Market Data API", () => {
    it("getMarketStats should call API and return market statistics", async () => {
      const mockStatsData = { totalVolume: 1000, averagePrice: 25 };
      const mockResponse = {
        data: { success: true, statistics: mockStatsData },
      };
      mockGet.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await getMarketStats();

      expect(mockGet).toHaveBeenCalledWith("/market/statistics");
      expect(result).toEqual(mockResponse.data);
    });

    it("getMarketForecast should call API and return market forecast", async () => {
      const mockForecastData = { trend: "up", prediction: 30 };
      const mockResponse = {
        data: { success: true, forecast: mockForecastData },
      };
      mockGet.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await getMarketForecast();

      expect(mockGet).toHaveBeenCalledWith("/market/forecast", { params: {} });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("Wallet API", () => {
    it("getWalletBalance should call API and return wallet balance", async () => {
      const mockBalanceData = { currency: "USD", amount: 5000 };
      const mockResponse = {
        data: { success: true, balance: mockBalanceData },
      };
      mockGet.mockResolvedValue(mockResponse);
      SecureStore.getItemAsync.mockResolvedValue("some-token");

      const result = await getWalletBalance();

      expect(mockGet).toHaveBeenCalledWith("/wallet/balance");
      expect(result).toEqual(mockResponse.data);
    });
  });

  const testApiFunctionError = async (
    apiFunction,
    functionName,
    method = "get",
    payload,
    requiresAuth = true,
  ) => {
    it(`${functionName} should throw error on API failure`, async () => {
      const mockError = {
        response: { data: { success: false, message: "API Error" } },
      };
      if (method === "post") mockPost.mockRejectedValue(mockError);
      else mockGet.mockRejectedValue(mockError);

      if (requiresAuth) {
        SecureStore.getItemAsync.mockResolvedValue("some-token");
      }

      if (payload) {
        await expect(apiFunction(payload)).rejects.toEqual(mockError);
      } else {
        await expect(apiFunction()).rejects.toEqual(mockError);
      }
    });
  };

  testApiFunctionError(getCredits, "getCredits");
  testApiFunctionError(getCreditById, "getCreditById", "get", "testId");
  testApiFunctionError(createCredit, "createCredit", "post", { name: "test" });
  testApiFunctionError(createTrade, "createTrade", "post", { creditId: "1" });
  testApiFunctionError(getUserTrades, "getUserTrades");
  testApiFunctionError(getMarketStats, "getMarketStats");
  testApiFunctionError(getMarketForecast, "getMarketForecast");
  testApiFunctionError(getWalletBalance, "getWalletBalance");
});
