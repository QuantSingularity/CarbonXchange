import { configureStore } from "@reduxjs/toolkit";
import authReducer, { sessionExpired } from "./slices/authSlice";
import { setSessionExpiredHandler } from "../services/api";

const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

// If a refresh token is invalid/expired, the API client calls this so the
// Redux store (and therefore the navigator) drops back to the auth stack.
setSessionExpiredHandler(() => store.dispatch(sessionExpired()));

export default store;
