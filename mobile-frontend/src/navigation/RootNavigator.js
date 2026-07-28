import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { bootstrapAuth } from "../store/slices/authSlice";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import LoadingScreen from "../screens/LoadingScreen";

/**
 * Top-level switch. The app always mounts on the Welcome screen inside
 * AuthNavigator first; once a session is confirmed (existing token or a
 * fresh login/registration), this swaps to the authenticated tab navigator.
 */
const RootNavigator = () => {
  const dispatch = useDispatch();
  const { user, isBootstrapping } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
