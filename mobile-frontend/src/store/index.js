import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";

// Import other reducers here as they are created

const store = configureStore({
  reducer: {
    auth: authReducer,
    // Add other reducers here
  },
});

export default store;
