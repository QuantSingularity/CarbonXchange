import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";
import * as api from "../../services/api"; // Assuming api service is set up

// Async thunk for login
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.login(email, password);
      // Assuming API returns { success: true, token: '...', user: {...} }
      if (response.success) {
        // Store token securely (e.g., AsyncStorage) - Placeholder
        console.log("Login successful, token:", response.token);
        return { user: response.user, token: response.token };
      } else {
        return rejectWithValue(response.error || "Login failed");
      }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.message ||
          "An error occurred during login",
      );
    }
  },
);

// Async thunk for rehydrating auth state on app start
export const rehydrateAuth = createAsyncThunk(
  "auth/rehydrateAuth",
  async (_, { rejectWithValue }) => {
    try {
      const token = await SecureStore.getItemAsync("userToken");
      if (token) {
        // Token exists, assume user is logged in
        // In a production app, you might want to validate the token with the backend
        return { token };
      }
      return rejectWithValue("No token found");
    } catch (error) {
      return rejectWithValue(error.message || "Failed to rehydrate auth");
    }
  },
);

// Async thunk for registration
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await api.register(userData);
      if (response.success) {
        console.log("Registration successful, token:", response.token);
        return { user: response.user, token: response.token };
      } else {
        return rejectWithValue(response.error || "Registration failed");
      }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.message ||
          "An error occurred during registration",
      );
    }
  },
);

const initialState = {
  user: null,
  token: null,
  isLoading: false,
  isLoggedIn: false,
  isRehydrating: true,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isLoggedIn = false;
      state.error = null;
      // Clear token from secure storage
      SecureStore.deleteItemAsync("userToken").catch((error) => {
        console.error("Error removing token:", error);
      });
    },
    resetAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoggedIn = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isLoggedIn = false;
        state.error = action.payload;
        state.user = null;
        state.token = null;
      })
      // Registration cases
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoggedIn = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isLoggedIn = false;
        state.error = action.payload;
        state.user = null;
        state.token = null;
      })
      // Rehydration cases
      .addCase(rehydrateAuth.pending, (state) => {
        state.isRehydrating = true;
      })
      .addCase(rehydrateAuth.fulfilled, (state, action) => {
        state.isRehydrating = false;
        state.isLoggedIn = true;
        state.token = action.payload.token;
        // User data will be loaded after successful rehydration if needed
      })
      .addCase(rehydrateAuth.rejected, (state) => {
        state.isRehydrating = false;
        state.isLoggedIn = false;
      });
  },
});

export const { logout, resetAuthError } = authSlice.actions;
export default authSlice.reducer;
