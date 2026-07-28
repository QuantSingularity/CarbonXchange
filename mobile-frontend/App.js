import React from "react";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "./src/components/ErrorBoundary";
import RootNavigator from "./src/navigation/RootNavigator";
import store from "./src/store";

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Provider store={store}>
          <StatusBar style="dark" />
          <RootNavigator />
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
