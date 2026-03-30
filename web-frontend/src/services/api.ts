import axios from "axios";
import { io, type Socket } from "socket.io-client";

// Define the base URL for the API - use import.meta.env for Vite
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Socket connection for real-time updates
let socket: Socket | null = null;

// Connect to websocket
export const connectSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("error", (error: any) => {
      console.error("Socket error:", error);
    });
  }

  return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Subscribe to market data updates
export const subscribeToMarketData = (callback: (data: any) => void) => {
  if (USE_MOCK) {
    const mockSocket = connectMockSocket();
    mockSocket.on("market_data_update", callback);
    mockSocket.emit("subscribe_market_data");
    return () => {
      mockSocket.off("market_data_update", callback);
      mockSocket.emit("unsubscribe_market_data");
    };
  }

  const socket = connectSocket();
  socket.on("market_data_update", callback);
  socket.emit("subscribe_market_data");

  return () => {
    socket.off("market_data_update", callback);
    socket.emit("unsubscribe_market_data");
  };
};

// Subscribe to trading volume updates
export const subscribeToVolumeData = (callback: (data: any) => void) => {
  if (USE_MOCK) {
    const mockSocket = connectMockSocket();
    mockSocket.on("volume_data_update", callback);
    mockSocket.emit("subscribe_volume_data");
    return () => {
      mockSocket.off("volume_data_update", callback);
      mockSocket.emit("unsubscribe_volume_data");
    };
  }

  const socket = connectSocket();
  socket.on("volume_data_update", callback);
  socket.emit("subscribe_volume_data");

  return () => {
    socket.off("volume_data_update", callback);
    socket.emit("unsubscribe_volume_data");
  };
};

// Authentication APIs
export const login = async (email: string, password: string) => {
  try {
    const response = await apiClient.post("/auth/login", { email, password });
    if (response.data.access_token) {
      localStorage.setItem("access_token", response.data.access_token);
    }
    return response.data;
  } catch (error: any) {
    console.error("Login error:", error);
    throw error;
  }
};

export const register = async (userData: {
  email: string;
  password: string;
  name: string;
}) => {
  try {
    const response = await apiClient.post("/auth/register", userData);
    return response.data;
  } catch (error) {
    console.error("Register error:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await apiClient.post("/auth/logout");
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    localStorage.removeItem("access_token");
    disconnectSocket();
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get("/users/me");
    return response.data;
  } catch (error) {
    console.error("Get current user error:", error);
    throw error;
  }
};

// Market Data API calls
export const getMarketStats = async () => {
  if (USE_MOCK) {
    return getMockMarketStats();
  }

  try {
    const response = await apiClient.get("/market/statistics");
    return response.data;
  } catch (error) {
    console.error("Get Market Stats API error:", error);
    // Fallback to mock data on error
    return getMockMarketStats();
  }
};

export const getMarketForecast = async (params = {}) => {
  try {
    const response = await apiClient.get("/market/forecast", { params });
    return response.data;
  } catch (error) {
    console.error("Get Market Forecast API error:", error);
    throw error;
  }
};

// Carbon Credits APIs
export const getCarbonCredits = async (params: any = {}) => {
  if (USE_MOCK) {
    return getMockCarbonCredits(params);
  }

  try {
    const response = await apiClient.get("/carbon-credits", { params });
    return response.data;
  } catch (error) {
    console.error("Get Carbon Credits error:", error);
    return getMockCarbonCredits(params);
  }
};

export const getCarbonCreditById = async (id: string) => {
  try {
    const response = await apiClient.get(`/carbon-credits/${id}`);
    return response.data;
  } catch (error) {
    console.error("Get Carbon Credit by ID error:", error);
    throw error;
  }
};

// Trading APIs
export const createOrder = async (orderData: {
  creditId: string;
  quantity: number;
  orderType: "buy" | "sell";
  price?: number;
}) => {
  try {
    const response = await apiClient.post("/trading/orders", orderData);
    return response.data;
  } catch (error) {
    console.error("Create Order error:", error);
    throw error;
  }
};

export const getMyOrders = async () => {
  if (USE_MOCK) {
    return getMockOrders();
  }

  try {
    const response = await apiClient.get("/trading/orders/my");
    return response.data;
  } catch (error) {
    console.error("Get My Orders error:", error);
    return getMockOrders();
  }
};

export const cancelOrder = async (orderId: string) => {
  try {
    const response = await apiClient.delete(`/trading/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error("Cancel Order error:", error);
    throw error;
  }
};

// Portfolio APIs
export const getPortfolio = async () => {
  if (USE_MOCK) {
    return getMockPortfolio();
  }

  try {
    const response = await apiClient.get("/users/me/portfolio");
    return response.data;
  } catch (error) {
    console.error("Get Portfolio error:", error);
    return getMockPortfolio();
  }
};

// Historical data API calls
export const getHistoricalPriceData = async (timeframe: string) => {
  if (USE_MOCK) {
    return getMockHistoricalData(timeframe, "price");
  }

  try {
    const response = await apiClient.get("/market/historical/price", {
      params: { timeframe },
    });
    return response.data;
  } catch (error) {
    console.error("Get Historical Price Data API error:", error);
    return getMockHistoricalData(timeframe, "price");
  }
};

export const getHistoricalVolumeData = async (timeframe: string) => {
  if (USE_MOCK) {
    return getMockHistoricalData(timeframe, "volume");
  }

  try {
    const response = await apiClient.get("/market/historical/volume", {
      params: { timeframe },
    });
    return response.data;
  } catch (error) {
    console.error("Get Historical Volume Data API error:", error);
    return getMockHistoricalData(timeframe, "volume");
  }
};

// Mock API for development (when backend is not available)
export const getMockMarketStats = () => {
  return {
    success: true,
    data: {
      averagePrice: 25 + Math.random() * 5,
      priceChange24h: -0.5 + Math.random() * 2,
      volume24h: 15000 + Math.random() * 5000,
      totalVolume: 1250000 + Math.random() * 10000,
      lastUpdated: new Date().toISOString(),
    },
  };
};

export const getMockCarbonCredits = (_params: any = {}) => {
  const credits = [
    {
      id: "1",
      name: "Amazon Rainforest Conservation",
      type: "Forestry",
      price: 28.5,
      available: 5000,
      totalIssued: 10000,
      vintage: 2024,
      verificationStandard: "VCS",
      location: "Brazil",
      description:
        "Conservation project protecting 10,000 hectares of Amazon rainforest",
    },
    {
      id: "2",
      name: "Wind Farm Project",
      type: "Renewable Energy",
      price: 24.2,
      available: 8000,
      totalIssued: 15000,
      vintage: 2024,
      verificationStandard: "Gold Standard",
      location: "India",
      description: "150MW wind farm generating clean energy",
    },
    {
      id: "3",
      name: "Coastal Mangrove Restoration",
      type: "Blue Carbon",
      price: 32.0,
      available: 3000,
      totalIssued: 5000,
      vintage: 2023,
      verificationStandard: "VCS",
      location: "Indonesia",
      description: "Restoration of 500 hectares of coastal mangrove forests",
    },
    {
      id: "4",
      name: "Solar Power Initiative",
      type: "Renewable Energy",
      price: 22.8,
      available: 12000,
      totalIssued: 20000,
      vintage: 2024,
      verificationStandard: "Gold Standard",
      location: "Morocco",
      description: "200MW solar power plant in North Africa",
    },
  ];

  return {
    success: true,
    data: credits,
    total: credits.length,
  };
};

export const getMockOrders = () => {
  return {
    success: true,
    data: [
      {
        id: "1",
        creditId: "1",
        creditName: "Amazon Rainforest Conservation",
        orderType: "buy",
        quantity: 100,
        price: 28.5,
        status: "completed",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "2",
        creditId: "2",
        creditName: "Wind Farm Project",
        orderType: "buy",
        quantity: 50,
        price: 24.2,
        status: "pending",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  };
};

export const getMockPortfolio = () => {
  return {
    success: true,
    data: {
      totalValue: 4285.0,
      totalCredits: 150,
      holdings: [
        {
          creditId: "1",
          name: "Amazon Rainforest Conservation",
          quantity: 100,
          averagePrice: 28.5,
          currentPrice: 28.8,
          value: 2880.0,
          profitLoss: 30.0,
          profitLossPercent: 1.05,
        },
        {
          creditId: "3",
          name: "Coastal Mangrove Restoration",
          quantity: 50,
          averagePrice: 31.0,
          currentPrice: 32.0,
          value: 1600.0,
          profitLoss: 50.0,
          profitLossPercent: 3.23,
        },
      ],
    },
  };
};

// Mock historical data generator
export const getMockHistoricalData = (
  timeframe: string,
  dataType: "price" | "volume",
) => {
  const now = Date.now();
  const points = [];
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

  // Base price and volume with some randomness
  let basePrice = 25;
  const baseVolume = 2500;

  // Generate data points
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * interval;

    // Add some realistic price movements
    const priceChange = (Math.random() - 0.48) * 0.5;
    basePrice = Math.max(basePrice + priceChange, 10);

    // Volume tends to be higher when price changes more dramatically
    const volumeMultiplier = 1 + Math.abs(priceChange) * 5;
    const volumeNoise = Math.random() * 0.4 + 0.8;
    const volume = Math.floor(baseVolume * volumeMultiplier * volumeNoise);

    // Add time-of-day patterns for volume
    const hour = new Date(timestamp).getHours();
    let timeOfDayFactor = 1;
    if (hour >= 9 && hour <= 16) {
      timeOfDayFactor = 1.5;
    } else if (hour < 6 || hour > 20) {
      timeOfDayFactor = 0.6;
    }

    points.push({
      timestamp,
      price: parseFloat(basePrice.toFixed(2)),
      volume: Math.floor(volume * timeOfDayFactor),
    });
  }

  return {
    success: true,
    data: {
      timeframe,
      dataType,
      points,
    },
  };
};

// Mock socket for development
export class MockSocket {
  private callbacks: Record<string, Array<(data: any) => void>> = {};
  private intervalIds: Record<string, NodeJS.Timeout> = {};

  on(event: string, callback: (data: any) => void) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(
        (cb) => cb !== callback,
      );
    }
  }

  emit(event: string) {
    if (event === "subscribe_market_data") {
      this.intervalIds.market_data = setInterval(() => {
        const lastPrice = 25 + Math.random() * 5;
        const priceChange = (Math.random() - 0.48) * 0.2;
        const newPrice = Math.max(lastPrice + priceChange, 10);

        const update = {
          timestamp: Date.now(),
          price: parseFloat(newPrice.toFixed(2)),
          change: parseFloat(priceChange.toFixed(2)),
        };

        this.trigger("market_data_update", update);
      }, 5000);
    }

    if (event === "subscribe_volume_data") {
      this.intervalIds.volume_data = setInterval(() => {
        const baseVolume = 2500;
        const volumeNoise = Math.random() * 0.4 + 0.8;
        const volume = Math.floor(baseVolume * volumeNoise);

        const update = {
          timestamp: Date.now(),
          volume: volume,
        };

        this.trigger("volume_data_update", update);
      }, 5000);
    }

    if (event === "unsubscribe_market_data") {
      if (this.intervalIds.market_data) {
        clearInterval(this.intervalIds.market_data);
        delete this.intervalIds.market_data;
      }
    }

    if (event === "unsubscribe_volume_data") {
      if (this.intervalIds.volume_data) {
        clearInterval(this.intervalIds.volume_data);
        delete this.intervalIds.volume_data;
      }
    }
  }

  trigger(event: string, data: any) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((callback) => callback(data));
    }
  }

  disconnect() {
    Object.values(this.intervalIds).forEach((intervalId) =>
      clearInterval(intervalId),
    );
    this.intervalIds = {};
    this.callbacks = {};
  }
}

// Create mock socket for development
let mockSocket: MockSocket | null = null;

// Connect to mock socket
export const connectMockSocket = (): MockSocket => {
  if (!mockSocket) {
    mockSocket = new MockSocket();
    console.log("Mock socket connected");
  }
  return mockSocket;
};

// Export a function to determine if we're using mock data
export const isUsingMockData = (): boolean => {
  return USE_MOCK || import.meta.env.DEV;
};

export default apiClient;
