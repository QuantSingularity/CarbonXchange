import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_CONFIG } from "../config/constants";

/**
 * API client for the CarbonXchange Flask backend. Mirrors the web
 * frontend's services/api.ts function-for-function so both apps talk to
 * the exact same routes and expect the exact same response shapes.
 */

const ACCESS_TOKEN_KEY = "cx_access_token";
const REFRESH_TOKEN_KEY = "cx_refresh_token";

export const tokenStorage = {
  async getAccess() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefresh() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async set(access, refresh) {
    if (access) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (API_CONFIG.logRequests) {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

let isRefreshing = false;
let pendingQueue = [];
let onSessionExpired = null;

/** Registered by the auth store so a failed refresh can force a sign-out. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url = original?.url || "";
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (error.response?.status === 401 && !original?._retry && !isAuthRoute) {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) {
        await tokenStorage.clear();
        onSessionExpired?.();
        return Promise.reject(error);
      }

      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push(() => resolve(apiClient(original)));
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${API_CONFIG.baseURL}/auth/refresh`,
          null,
          { headers: { Authorization: `Bearer ${refreshToken}` } },
        );
        await tokenStorage.set(data.access_token);
        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return apiClient(original);
      } catch (refreshError) {
        await tokenStorage.clear();
        pendingQueue = [];
        onSessionExpired?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export function apiErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return data?.message || data?.error || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

export const authApi = {
  async register(payload) {
    const { data } = await apiClient.post("/auth/register", payload);
    await tokenStorage.set(data.access_token, data.refresh_token);
    return data;
  },
  async login(email, password) {
    const { data } = await apiClient.post("/auth/login", { email, password });
    await tokenStorage.set(data.access_token, data.refresh_token);
    return data;
  },
  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      await tokenStorage.clear();
    }
  },
  async me() {
    const { data } = await apiClient.get("/auth/me");
    return data.user;
  },
  async changePassword(current_password, new_password) {
    const { data } = await apiClient.post("/auth/change-password", {
      current_password,
      new_password,
    });
    return data;
  },
  async verifyEmail() {
    const { data } = await apiClient.post("/auth/verify-email");
    return data;
  },
};

/* ------------------------------------------------------------------ */
/* Users                                                                */
/* ------------------------------------------------------------------ */

export const userApi = {
  async updateMyProfile(payload) {
    const { data } = await apiClient.put("/users/me/profile", payload);
    return data.user;
  },
};

/* ------------------------------------------------------------------ */
/* Carbon credits & projects                                           */
/* ------------------------------------------------------------------ */

export const creditsApi = {
  async list(params = {}) {
    const { data } = await apiClient.get("/carbon-credits/", { params });
    return data;
  },
  async get(id) {
    const { data } = await apiClient.get(`/carbon-credits/${id}`);
    return data;
  },
  async retire(id) {
    const { data } = await apiClient.post(`/carbon-credits/${id}/retire`);
    return data;
  },
  async blockchainStatus() {
    const { data } = await apiClient.get("/carbon-credits/blockchain/status");
    return data;
  },
};

export const projectsApi = {
  async list(params = {}) {
    const { data } = await apiClient.get("/carbon-credits/projects", {
      params,
    });
    return data;
  },
  async get(id) {
    const { data } = await apiClient.get(`/carbon-credits/projects/${id}`);
    return data;
  },
  async credits(id) {
    const { data } = await apiClient.get(
      `/carbon-credits/projects/${id}/credits`,
    );
    return data;
  },
};

/* ------------------------------------------------------------------ */
/* Trading                                                              */
/* ------------------------------------------------------------------ */

export const tradingApi = {
  async createOrder(payload) {
    const { data } = await apiClient.post("/trading/orders", payload);
    return data;
  },
  async listOrders(params = {}) {
    const { data } = await apiClient.get("/trading/orders", { params });
    return data;
  },
  async getOrder(orderId) {
    const { data } = await apiClient.get(`/trading/orders/${orderId}`);
    return data;
  },
  async cancelOrder(orderId) {
    const { data } = await apiClient.post(`/trading/orders/${orderId}/cancel`);
    return data;
  },
  async listTrades(params = {}) {
    const { data } = await apiClient.get("/trading/trades", { params });
    return data;
  },
  async portfolios() {
    const { data } = await apiClient.get("/trading/portfolio");
    return data;
  },
  async holdings() {
    const { data } = await apiClient.get("/trading/portfolio/holdings");
    return data;
  },
};

/* ------------------------------------------------------------------ */
/* Market data                                                         */
/* ------------------------------------------------------------------ */

export const marketApi = {
  async data(params = {}) {
    const { data } = await apiClient.get("/market/data", { params });
    return data;
  },
  async ticker(symbol) {
    const { data } = await apiClient.get(`/market/ticker/${symbol}`);
    return data.ticker;
  },
  async prices(params = {}) {
    const { data } = await apiClient.get("/market/prices", { params });
    return data;
  },
  async ohlcv(symbol, params = {}) {
    const { data } = await apiClient.get(`/market/prices/${symbol}/ohlcv`, {
      params,
    });
    return data;
  },
  async summary() {
    const { data } = await apiClient.get("/market/summary");
    return data;
  },
  async statistics(params = {}) {
    const { data } = await apiClient.get("/market/statistics", { params });
    return data;
  },
  async depth(symbol, levels = 10) {
    const { data } = await apiClient.get(`/market/depth/${symbol}`, {
      params: { levels },
    });
    return data;
  },
  async recentTrades(params = {}) {
    const { data } = await apiClient.get("/market/trades/recent", { params });
    return data;
  },
};

/* ------------------------------------------------------------------ */
/* Compliance                                                          */
/* ------------------------------------------------------------------ */

export const complianceApi = {
  async myStatus() {
    const { data } = await apiClient.get("/compliance/status");
    return data;
  },
  async records(params = {}) {
    const { data } = await apiClient.get("/compliance/records", { params });
    return data;
  },
  async reports(params = {}) {
    const { data } = await apiClient.get("/compliance/reports", { params });
    return data;
  },
  async submitReport(id) {
    const { data } = await apiClient.post(`/compliance/reports/${id}/submit`);
    return data;
  },
  async approveReport(id) {
    const { data } = await apiClient.post(`/compliance/reports/${id}/approve`);
    return data;
  },
  async amlSummary() {
    const { data } = await apiClient.get("/compliance/aml/summary");
    return data;
  },
};

/* ------------------------------------------------------------------ */
/* Admin                                                                */
/* ------------------------------------------------------------------ */

export const adminApi = {
  async users(params = {}) {
    const { data } = await apiClient.get("/admin/users", { params });
    return data;
  },
  async updateUserStatus(userId, status, reason) {
    const { data } = await apiClient.put(`/admin/users/${userId}/status`, {
      status,
      reason,
    });
    return data;
  },
  async unlockUser(userId) {
    const { data } = await apiClient.post(`/admin/users/${userId}/unlock`);
    return data;
  },
  async system() {
    const { data } = await apiClient.get("/admin/system");
    return data;
  },
};

export default apiClient;
