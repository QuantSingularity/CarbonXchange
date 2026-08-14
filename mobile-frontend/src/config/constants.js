// Configuration constants for the application
import Constants from "expo-constants";

const ENV = {
  API_BASE_URL:
    Constants.expoConfig?.extra?.API_BASE_URL || "http://localhost:5000/api",
  APP_ENV: Constants.expoConfig?.extra?.APP_ENV || "development",
  DEBUG: Constants.expoConfig?.extra?.DEBUG === "true",
  ENABLE_BLOCKCHAIN: Constants.expoConfig?.extra?.ENABLE_BLOCKCHAIN !== "false",
  BLOCK_EXPLORER_URL:
    Constants.expoConfig?.extra?.BLOCK_EXPLORER_URL ||
    "https://polygonscan.com",
  LOG_API_REQUESTS: Constants.expoConfig?.extra?.LOG_API_REQUESTS === "true",
};

export const APP_CONFIG = {
  name: "CarbonXchange",
  version: "1.0.0",
  environment: ENV.APP_ENV,
  debug: ENV.DEBUG,
};

export const API_CONFIG = {
  baseURL: ENV.API_BASE_URL,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  logRequests: ENV.LOG_API_REQUESTS,
};

export const FEATURES = {
  blockchain: ENV.ENABLE_BLOCKCHAIN,
  blockExplorerUrl: ENV.BLOCK_EXPLORER_URL,
  biometricAuth: false,
  pushNotifications: false,
  offlineMode: false,
};

export const UI_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  SEARCH_DEBOUNCE: 500,
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  MARKET_DATA_REFRESH: 60000,
  WALLET_REFRESH: 30000,
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR:
    "Unable to connect to the server. Please check your internet connection.",
  TIMEOUT_ERROR: "Request timed out. Please try again.",
  AUTH_ERROR: "Authentication failed. Please log in again.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
  INVALID_INPUT: "Please check your input and try again.",
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: "Login successful!",
  REGISTER_SUCCESS: "Registration successful!",
  TRADE_SUCCESS: "Trade executed successfully!",
  LOGOUT_SUCCESS: "Logged out successfully!",
};

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
};

export default {
  APP_CONFIG,
  API_CONFIG,
  FEATURES,
  UI_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION,
};
