import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi, tokenStorage, apiErrorMessage } from "../../services/api";

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authApi.login(email, password);
      return data.user;
    } catch (error) {
      return rejectWithValue(
        apiErrorMessage(error, "Incorrect email or password."),
      );
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authApi.register(payload);
      return data.user;
    } catch (error) {
      return rejectWithValue(
        apiErrorMessage(error, "We couldn't create your account."),
      );
    }
  },
);

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await authApi.logout();
  return true;
});

/** Runs once at app start: if a token is stored, fetch the current user. */
export const bootstrapAuth = createAsyncThunk(
  "auth/bootstrapAuth",
  async (_, { rejectWithValue }) => {
    try {
      const token = await tokenStorage.getAccess();
      if (!token) return null;
      const user = await authApi.me();
      return user;
    } catch (error) {
      await tokenStorage.clear();
      return rejectWithValue(apiErrorMessage(error));
    }
  },
);

export const refreshCurrentUser = createAsyncThunk(
  "auth/refreshCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      return await authApi.me();
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error));
    }
  },
);

const initialState = {
  user: null,
  isBootstrapping: true,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    resetAuthError: (state) => {
      state.error = null;
    },
    sessionExpired: (state) => {
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
      })

      .addCase(bootstrapAuth.pending, (state) => {
        state.isBootstrapping = true;
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.isBootstrapping = false;
        state.user = action.payload;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.isBootstrapping = false;
        state.user = null;
      })

      .addCase(refreshCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { resetAuthError, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
