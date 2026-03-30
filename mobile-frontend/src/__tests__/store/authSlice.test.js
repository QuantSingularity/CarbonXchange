import * as api from "../../../services/api"; // To mock API calls for thunks
import authReducer, {
  loginUser,
  logout, // Assuming this is the action for logout
  registerUser,
  resetAuthError,
  setError,
  setLoading,
  setLoggedIn,
  setUser,
} from "../../../store/slices/authSlice";

// Mock API service for thunks
jest.mock("../../../services/api");
// Mock SecureStore for thunks that interact with it
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const initialState = {
  user: null,
  token: null,
  isLoggedIn: false,
  isLoading: false,
  error: null,
};

describe("authSlice reducers", () => {
  it("should return the initial state", () => {
    expect(authReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("should handle setLoading", () => {
    expect(authReducer(initialState, setLoading(true)).isLoading).toBe(true);
    expect(authReducer(initialState, setLoading(false)).isLoading).toBe(false);
  });

  it("should handle setError", () => {
    const error = { message: "Test error" };
    expect(authReducer(initialState, setError(error)).error).toEqual(error);
    expect(authReducer(initialState, setError(null)).error).toBeNull();
  });

  it("should handle setLoggedIn", () => {
    expect(authReducer(initialState, setLoggedIn(true)).isLoggedIn).toBe(true);
    expect(authReducer(initialState, setLoggedIn(false)).isLoggedIn).toBe(
      false,
    );
  });

  it("should handle setUser", () => {
    const user = { id: "1", email: "test@example.com" };
    expect(authReducer(initialState, setUser(user)).user).toEqual(user);
    expect(authReducer(initialState, setUser(null)).user).toBeNull();
  });

  it("should handle resetAuthError", () => {
    const stateWithError = {
      ...initialState,
      error: { message: "Some error" },
    };
    expect(authReducer(stateWithError, resetAuthError()).error).toBeNull();
  });

  describe("loginUser thunk", () => {
    it("should handle loginUser.pending", () => {
      const action = { type: loginUser.pending.type };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it("should handle loginUser.fulfilled", () => {
      const mockUserData = { id: "1", name: "Test User" };
      const mockToken = "test-token";
      const action = {
        type: loginUser.fulfilled.type,
        payload: { user: mockUserData, token: mockToken },
      };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.isLoggedIn).toBe(true);
      expect(state.user).toEqual(mockUserData);
      expect(state.token).toEqual(mockToken);
      expect(state.error).toBeNull();
    });

    it("should handle loginUser.rejected", () => {
      const mockError = { message: "Login failed" };
      const action = { type: loginUser.rejected.type, payload: mockError }; // Or error: mockError depending on createAsyncThunk
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.isLoggedIn).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error).toEqual(mockError);
    });
  });

  describe("registerUser thunk", () => {
    it("should handle registerUser.pending", () => {
      const action = { type: registerUser.pending.type };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it("should handle registerUser.fulfilled", () => {
      const mockUserData = { id: "2", name: "New User" };
      const mockToken = "new-token";
      const action = {
        type: registerUser.fulfilled.type,
        payload: { user: mockUserData, token: mockToken },
      };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.isLoggedIn).toBe(true);
      expect(state.user).toEqual(mockUserData);
      expect(state.token).toEqual(mockToken);
      expect(state.error).toBeNull();
    });

    it("should handle registerUser.rejected", () => {
      const mockError = { message: "Registration failed" };
      const action = { type: registerUser.rejected.type, payload: mockError };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.isLoggedIn).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error).toEqual(mockError);
    });
  });

  describe("logout action/thunk", () => {
    // If logout is a simple action creator that results in specific state changes handled by extraReducers or a reducer case
    // Or if it's a thunk that dispatches actions leading to reset state
    it("should handle logout and reset state", () => {
      const loggedInState = {
        user: { id: "1", name: "Test User" },
        token: "test-token",
        isLoggedIn: true,
        isLoading: false,
        error: null,
      };
      // Assuming logout action directly resets state or is handled in extraReducers
      // If logout is a thunk, you might test its dispatched actions or the final state after thunk completion
      const action = { type: logout.type }; // Or a specific action type if logout is not a thunk itself
      // If logout is a thunk that dispatches, e.g., setLoggedIn(false), setUser(null), etc.
      // For this example, let's assume there's a case for `logout` or `logoutUser.fulfilled` that resets state.
      // The actual implementation of logout in authSlice.js determines how this test is written.
      // For simplicity, if logout directly leads to initial state like properties:
      const state = authReducer(loggedInState, action); // This might need to be logout.fulfilled if it's a thunk

      // A more common pattern for logout thunk is it dispatches multiple actions
      // e.g. api.logoutUser() then dispatch(setUser(null)), dispatch(setToken(null)), dispatch(setLoggedIn(false))
      // In that case, you'd test the thunk itself (see below) or the individual reducers for those dispatched actions.

      // For now, let's assume a simple reducer case for 'logout' or similar action type
      // that resets to initial-like state for logged out user.
      expect(state.isLoggedIn).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isLoading).toBe(false); // Assuming logout doesn't set loading
      expect(state.error).toBeNull();
    });
  });
});

// Example for testing thunks themselves (if not covered by reducer tests for pending/fulfilled/rejected)
describe("authSlice thunks direct invocation", () => {
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn(() => ({ auth: initialState }));

  beforeEach(() => {
    mockDispatch.mockClear();
    api.login.mockClear();
    api.register.mockClear();
    api.logoutUser.mockClear(); // Assuming api.logoutUser exists
    require("expo-secure-store").setItemAsync.mockClear();
    require("expo-secure-store").deleteItemAsync.mockClear();
  });

  it("loginUser thunk dispatches pending and fulfilled on successful API call", async () => {
    const credentials = { email: "test@example.com", password: "password" };
    const responseData = { user: { id: "1" }, token: "abc" };
    api.login.mockResolvedValue(responseData);

    await loginUser(credentials)(mockDispatch, mockGetState, undefined);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: loginUser.pending.type }),
    );
    expect(api.login).toHaveBeenCalledWith(
      credentials.email,
      credentials.password,
    );
    expect(require("expo-secure-store").setItemAsync).toHaveBeenCalledWith(
      "userToken",
      responseData.token,
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: loginUser.fulfilled.type,
        payload: responseData,
      }),
    );
  });

  it("loginUser thunk dispatches pending and rejected on failed API call", async () => {
    const credentials = { email: "test@example.com", password: "password" };
    const error = { message: "Failed" };
    api.login.mockRejectedValue({ response: { data: error } }); // Simulate API error structure

    await loginUser(credentials)(mockDispatch, mockGetState, undefined);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: loginUser.pending.type }),
    );
    expect(api.login).toHaveBeenCalledWith(
      credentials.email,
      credentials.password,
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: loginUser.rejected.type,
        payload: error,
      }),
    );
  });

  // Similar tests for registerUser thunk
  it("registerUser thunk dispatches pending and fulfilled on successful API call", async () => {
    const userData = {
      username: "new",
      email: "new@example.com",
      password: "password",
    };
    const responseData = { user: { id: "2" }, token: "def" };
    api.register.mockResolvedValue(responseData);

    await registerUser(userData)(mockDispatch, mockGetState, undefined);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: registerUser.pending.type }),
    );
    expect(api.register).toHaveBeenCalledWith(userData);
    expect(require("expo-secure-store").setItemAsync).toHaveBeenCalledWith(
      "userToken",
      responseData.token,
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: registerUser.fulfilled.type,
        payload: responseData,
      }),
    );
  });

  // Test for logout thunk if it's more complex
  it("logout thunk calls api.logoutUser and dispatches relevant actions", async () => {
    api.logoutUser.mockResolvedValue({}); // Assuming api.logoutUser is an async operation

    await logout()(mockDispatch, mockGetState, undefined);

    // Check if api.logoutUser (which likely calls SecureStore.deleteItemAsync) was called
    expect(api.logoutUser).toHaveBeenCalledTimes(1);
    // Check for dispatched actions that reset the state, e.g.:
    expect(mockDispatch).toHaveBeenCalledWith(setUser(null));
    expect(mockDispatch).toHaveBeenCalledWith(setLoggedIn(false));
    // Add other actions that logout thunk is supposed to dispatch
  });
});
