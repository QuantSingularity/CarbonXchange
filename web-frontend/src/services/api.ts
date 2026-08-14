import axios, { type AxiosInstance } from "axios";

/**
 * API client for the CarbonXchange Flask backend.
 *
 * Every function here maps 1:1 to a real route registered in
 * code/backend/src/main.py. Response shapes mirror the `to_dict()`
 * output of the corresponding SQLAlchemy models exactly, so pages can
 * consume this data without guessing at field names.
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

const ACCESS_TOKEN_KEY = "cx_access_token";
const REFRESH_TOKEN_KEY = "cx_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url: string = original?.url || "";
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        tokenStorage.clear();
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
          `${API_BASE_URL}/auth/refresh`,
          null,
          {
            headers: { Authorization: `Bearer ${refreshToken}` },
          },
        );
        tokenStorage.set(data.access_token);
        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return apiClient(original);
      } catch (refreshError) {
        tokenStorage.clear();
        pendingQueue = [];
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export function apiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      { message?: string; error?: string } | undefined;
    return data?.message || data?.error || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type UserRole =
  | "individual"
  | "corporate"
  | "institutional"
  | "broker"
  | "market_maker"
  | "admin"
  | "compliance_officer"
  | "auditor"
  | "system";

export type UserStatus =
  | "pending"
  | "active"
  | "suspended"
  | "closed"
  | "under_review"
  | "locked"
  | "dormant";

export interface UserProfile {
  middle_name?: string | null;
  nationality?: string | null;
  country_of_residence?: string | null;
  address?: {
    line_1?: string | null;
    line_2?: string | null;
    city?: string | null;
    state_province?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  occupation?: string | null;
  employer?: string | null;
  annual_income?: number | null;
  source_of_funds?: string | null;
  company?: {
    name?: string | null;
    registration_number?: string | null;
    tax_id?: string | null;
    incorporation_country?: string | null;
    business_type?: string | null;
  } | null;
  trading?: {
    experience?: string | null;
    objectives?: string | null;
    risk_tolerance?: string | null;
  };
  preferences?: {
    language?: string | null;
    timezone?: string | null;
    marketing_consent?: boolean;
  };
}

export interface KYC {
  status: string;
  [key: string]: unknown;
}

export interface User {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number?: string | null;
  status: UserStatus;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  is_kyc_approved: boolean;
  is_email_verified: boolean;
  risk_level: string;
  created_at: string;
  last_login_at: string | null;
  mfa_enabled: boolean;
  profile?: UserProfile;
  kyc?: KYC;
}

export interface CarbonProject {
  id: number;
  uuid: string;
  name: string;
  description: string;
  project_type: string;
  status: string;
  project_id: string;
  onchain_project_id?: number | null;
  standard: string | null;
  country: string;
  region?: string | null;
  methodology?: string | null;
  annual_emission_reductions: number | null;
  total_emission_reductions: number | null;
  actual_reductions_to_date: number;
  completion_percentage: number;
  project_start_date: string | null;
  project_end_date: string | null;
  developer_name?: string | null;
  validation_status: string;
  verification_status: string;
  is_verified: boolean;
  total_credits_issued: number;
  available_credits: number;
  retired_credits: number;
  permanence_risk?: string | null;
  leakage_risk?: string | null;
  overall_risk_rating?: string | null;
  estimated_credit_price: number | null;
  price_currency?: string | null;
  sdg_contributions?: unknown;
  co_benefits?: unknown;
  created_at: string;
  updated_at: string;
}

export interface CarbonCredit {
  id: number;
  uuid: string;
  serial_number: string;
  batch_id?: string | null;
  project_id: number;
  quantity: number;
  vintage_year: number;
  status: string;
  is_tradeable: boolean;
  is_available: boolean;
  is_retired: boolean;
  is_expired: boolean;
  is_valid: boolean;
  age_in_years: number;
  last_trade_price: number | null;
  market_price: number | null;
  last_trade_currency?: string | null;
  permanence_risk?: string | null;
  additionality_verified?: boolean;
  verification_body?: string | null;
  verification_date?: string | null;
  co_benefits?: unknown;
  compliance_standards?: unknown;
  is_tokenized: boolean;
  onchain_batch_id?: number | null;
  blockchain_tx_hash?: string | null;
  smart_contract_address?: string | null;
  token_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderSide = "buy" | "sell";
export type OrderStatus =
  | "pending"
  | "open"
  | "partially_filled"
  | "filled"
  | "executed"
  | "cancelled"
  | "rejected"
  | "expired";

export interface Order {
  id: number;
  uuid: string;
  order_id: string;
  order_type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  credit_type: string;
  vintage_year?: number | null;
  quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  fill_percentage: number;
  price: number | null;
  average_fill_price: number | null;
  total_value: number | null;
  currency: string;
  fees: number;
  time_in_force?: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  closed_at: string | null;
}

export interface Trade {
  id: number;
  uuid: string;
  trade_id: string;
  quantity: number;
  price: number;
  total_value: number;
  currency: string;
  vintage_year?: number | null;
  status: string;
  executed_at: string;
  settlement_date: string | null;
  created_at: string;
  updated_at: string;
  credit_type?: string;
}

export interface Portfolio {
  id: number;
  uuid: string;
  name: string;
  portfolio_type: string;
  description?: string | null;
  base_currency: string;
  total_value: number;
  total_credits: number;
  total_pnl: number;
  number_of_holdings: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_valuation_at: string | null;
}

export interface PortfolioHolding {
  id: number;
  uuid: string;
  quantity: number;
  average_cost: number;
  current_price: number | null;
  current_value: number | null;
  total_pnl: number;
  pnl_percentage: number;
  vintage_year?: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  first_acquired_at: string;
  last_traded_at: string | null;
}

export interface MarketData {
  id: number;
  uuid: string;
  symbol: string;
  project_id?: number | null;
  vintage_year?: number | null;
  credit_standard?: string | null;
  data_type: string;
  value: number;
  currency: string;
  volume: number | null;
  volume_usd: number | null;
  bid_price: number | null;
  ask_price: number | null;
  spread: number | null;
  spread_percentage: number | null;
  high_24h: number | null;
  low_24h: number | null;
  change_24h: number | null;
  change_percentage_24h: number | null;
  timestamp?: string;
}

export interface PriceCandle {
  id: number;
  uuid: string;
  symbol: string;
  timeframe: string;
  period_start: string;
  period_end: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  volume_usd: number;
  vwap: number | null;
  number_of_trades: number;
  price_change: number;
  price_change_percentage: number;
  is_bullish: boolean;
}

export interface MarketStatistics {
  period_days: number;
  credit_type: string | null;
  trade_count: number;
  average_price: number;
  min_price: number;
  max_price: number;
  price_std_dev: number;
  price_volatility: number;
  total_volume: number;
  total_value_usd: number;
  generated_at: string;
  error?: string;
}

export interface OrderBookDepth {
  symbol: string;
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  timestamp: string;
}

export interface ComplianceStatusSummary {
  user_id: number;
  kyc_status: string;
  is_kyc_approved: boolean;
  risk_level: string;
  trading_enabled: boolean;
  email?: string;
  open_compliance_issues?: number;
}

export interface ComplianceRecord {
  id: number;
  uuid: string;
  record_id: string;
  entity_type: string;
  entity_id: string;
  framework: string;
  rule_reference: string;
  rule_description: string;
  status: string;
  risk_level?: string | null;
  severity?: string | null;
  violation_type?: string | null;
  violation_description?: string | null;
  remediation_required?: boolean;
  is_overdue: boolean;
  days_until_due: number | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  closed_date: string | null;
}

export interface RegulatoryReport {
  id: number;
  uuid: string;
  report_id: string;
  report_type: string;
  framework: string;
  title: string;
  description?: string | null;
  reporting_period_start: string;
  reporting_period_end: string;
  status: string;
  version: number;
  due_date: string;
  days_until_due: number;
  is_overdue: boolean;
  is_submitted: boolean;
  created_at: string;
  updated_at: string;
  submission_date: string | null;
}

export interface AmlSummary {
  total_users: number;
  kyc_approved_users: number;
  kyc_approval_rate: number;
  open_compliance_issues: number;
  total_compliance_records: number;
  generated_at: string;
}

export interface SystemInfo {
  users: { total: number; active: number };
  trading: { orders: number; trades: number };
  carbon: { projects: number; credits: number };
}

export interface Paginated {
  total: number;
  pages: number;
  current_page: number;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  company_name?: string;
}

export const authApi = {
  async register(payload: RegisterPayload) {
    const { data } = await apiClient.post("/auth/register", payload);
    tokenStorage.set(data.access_token, data.refresh_token);
    return data as {
      message: string;
      user: User;
      access_token: string;
      refresh_token: string;
    };
  },

  async login(email: string, password: string) {
    const { data } = await apiClient.post("/auth/login", { email, password });
    tokenStorage.set(data.access_token, data.refresh_token);
    return data as {
      message: string;
      user: User;
      access_token: string;
      refresh_token: string;
    };
  },

  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      tokenStorage.clear();
    }
  },

  async me() {
    const { data } = await apiClient.get("/auth/me");
    return data.user as User;
  },

  async changePassword(current_password: string, new_password: string) {
    const { data } = await apiClient.post("/auth/change-password", {
      current_password,
      new_password,
    });
    return data as { message: string };
  },

  async verifyEmail() {
    const { data } = await apiClient.post("/auth/verify-email");
    return data as { message: string };
  },
};

/* ------------------------------------------------------------------ */
/* Users                                                                */
/* ------------------------------------------------------------------ */

export const userApi = {
  async updateMyProfile(payload: Record<string, unknown>) {
    const { data } = await apiClient.put("/users/me/profile", payload);
    return data.user as User;
  },
};

/* ------------------------------------------------------------------ */
/* Carbon credits & projects                                           */
/* ------------------------------------------------------------------ */

export const creditsApi = {
  async list(
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      project_id?: number;
      vintage_year?: number;
    } = {},
  ) {
    const { data } = await apiClient.get("/carbon-credits/", { params });
    return data as Paginated & { credits: CarbonCredit[] };
  },

  async get(id: number) {
    const { data } = await apiClient.get(`/carbon-credits/${id}`);
    return data as CarbonCredit;
  },

  async retire(id: number) {
    const { data } = await apiClient.post(`/carbon-credits/${id}/retire`);
    return data as {
      credit: CarbonCredit;
      blockchain_tx: string | null;
      message: string;
    };
  },

  async verifyTx(id: number) {
    const { data } = await apiClient.get(`/carbon-credits/${id}/verify-tx`);
    return data;
  },

  async blockchainStatus() {
    const { data } = await apiClient.get("/carbon-credits/blockchain/status");
    return data;
  },
};

export const projectsApi = {
  async list(
    params: {
      page?: number;
      per_page?: number;
      type?: string;
      status?: string;
      country?: string;
    } = {},
  ) {
    const { data } = await apiClient.get("/carbon-credits/projects", {
      params,
    });
    return data as Paginated & { projects: CarbonProject[] };
  },

  async get(id: number) {
    const { data } = await apiClient.get(`/carbon-credits/projects/${id}`);
    return data as CarbonProject;
  },

  async credits(id: number) {
    const { data } = await apiClient.get(
      `/carbon-credits/projects/${id}/credits`,
    );
    return data as {
      project: CarbonProject;
      credits: CarbonCredit[];
      total: number;
    };
  },

  async create(payload: Record<string, unknown>) {
    const { data } = await apiClient.post("/carbon-credits/projects", payload);
    return data.project as CarbonProject;
  },
};

/* ------------------------------------------------------------------ */
/* Trading                                                              */
/* ------------------------------------------------------------------ */

export interface CreateOrderPayload {
  order_type: OrderType;
  side: OrderSide;
  quantity: number;
  credit_type: string;
  price?: number;
  vintage_year?: number;
}

export const tradingApi = {
  async createOrder(payload: CreateOrderPayload) {
    const { data } = await apiClient.post("/trading/orders", payload);
    return data as { message: string; order: Order };
  },

  async listOrders(
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      side?: string;
    } = {},
  ) {
    const { data } = await apiClient.get("/trading/orders", { params });
    return data as Paginated & { orders: Order[] };
  },

  async getOrder(orderId: string) {
    const { data } = await apiClient.get(`/trading/orders/${orderId}`);
    return data as Order;
  },

  async cancelOrder(orderId: string) {
    const { data } = await apiClient.post(`/trading/orders/${orderId}/cancel`);
    return data as { message: string; order: Order };
  },

  async listTrades(params: { page?: number; per_page?: number } = {}) {
    const { data } = await apiClient.get("/trading/trades", { params });
    return data as Paginated & { trades: Trade[] };
  },

  async portfolios() {
    const { data } = await apiClient.get("/trading/portfolio");
    return data as { portfolios: Portfolio[]; total: number };
  },

  async holdings() {
    const { data } = await apiClient.get("/trading/portfolio/holdings");
    return data as { holdings: PortfolioHolding[]; total?: number };
  },
};

/* ------------------------------------------------------------------ */
/* Market data                                                         */
/* ------------------------------------------------------------------ */

export const marketApi = {
  async data(params: { symbol?: string; type?: string; limit?: number } = {}) {
    const { data } = await apiClient.get("/market/data", { params });
    return data as { market_data: MarketData[]; total: number };
  },

  async ticker(symbol: string) {
    const { data } = await apiClient.get(`/market/ticker/${symbol}`);
    return data.ticker as MarketData;
  },

  async prices(
    params: { symbol?: string; days?: number; limit?: number } = {},
  ) {
    const { data } = await apiClient.get("/market/prices", { params });
    return data as { prices: PriceCandle[]; total: number };
  },

  async ohlcv(symbol: string, params: { days?: number; limit?: number } = {}) {
    const { data } = await apiClient.get(`/market/prices/${symbol}/ohlcv`, {
      params,
    });
    return data as { symbol: string; candles: PriceCandle[]; count: number };
  },

  async summary() {
    const { data } = await apiClient.get("/market/summary");
    return data as { latest_price?: MarketData; message?: string };
  },

  async statistics(params: { days?: number; credit_type?: string } = {}) {
    const { data } = await apiClient.get("/market/statistics", { params });
    return data as MarketStatistics;
  },

  async depth(symbol: string, levels = 10) {
    const { data } = await apiClient.get(`/market/depth/${symbol}`, {
      params: { levels },
    });
    return data as OrderBookDepth;
  },

  async recentTrades(params: { limit?: number; credit_type?: string } = {}) {
    const { data } = await apiClient.get("/market/trades/recent", { params });
    return data as { trades: Trade[]; total: number };
  },

  async health() {
    const { data } = await apiClient.get("/market/health");
    return data as { status: string; latest_data_age_seconds?: number };
  },
};

/* ------------------------------------------------------------------ */
/* Compliance                                                          */
/* ------------------------------------------------------------------ */

export const complianceApi = {
  async myStatus() {
    const { data } = await apiClient.get("/compliance/status");
    return data as ComplianceStatusSummary;
  },

  async userStatus(userId: number) {
    const { data } = await apiClient.get(`/compliance/status/${userId}`);
    return data as ComplianceStatusSummary;
  },

  async records(
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      user_id?: number;
    } = {},
  ) {
    const { data } = await apiClient.get("/compliance/records", { params });
    return data as Paginated & { records: ComplianceRecord[] };
  },

  async updateRecord(id: number, payload: Record<string, unknown>) {
    const { data } = await apiClient.put(`/compliance/records/${id}`, payload);
    return data as { record: ComplianceRecord };
  },

  async reports(
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      type?: string;
      framework?: string;
    } = {},
  ) {
    const { data } = await apiClient.get("/compliance/reports", { params });
    return data as Paginated & { reports: RegulatoryReport[] };
  },

  async createReport(payload: Record<string, unknown>) {
    const { data } = await apiClient.post("/compliance/reports", payload);
    return data.report as RegulatoryReport;
  },

  async submitReport(id: number) {
    const { data } = await apiClient.post(`/compliance/reports/${id}/submit`);
    return data;
  },

  async approveReport(id: number) {
    const { data } = await apiClient.post(`/compliance/reports/${id}/approve`);
    return data;
  },

  async amlSummary() {
    const { data } = await apiClient.get("/compliance/aml/summary");
    return data as AmlSummary;
  },
};

/* ------------------------------------------------------------------ */
/* Admin                                                                */
/* ------------------------------------------------------------------ */

export const adminApi = {
  async users(
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      role?: string;
    } = {},
  ) {
    const { data } = await apiClient.get("/admin/users", { params });
    return data as Paginated & { users: User[]; per_page: number };
  },

  async updateUserStatus(userId: number, status: UserStatus, reason?: string) {
    const { data } = await apiClient.put(`/admin/users/${userId}/status`, {
      status,
      reason,
    });
    return data as { message: string; user: User };
  },

  async unlockUser(userId: number) {
    const { data } = await apiClient.post(`/admin/users/${userId}/unlock`);
    return data as { message: string; user: User };
  },

  async system() {
    const { data } = await apiClient.get("/admin/system");
    return data as SystemInfo;
  },
};

export default apiClient;
