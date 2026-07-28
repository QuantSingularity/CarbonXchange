import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import theme from "../styles/theme";

import DashboardScreen from "../screens/Main/DashboardScreen";
import MarketplaceScreen from "../screens/Main/MarketplaceScreen";
import ProjectDetailScreen from "../screens/Main/ProjectDetailScreen";
import TradingScreen from "../screens/Main/TradingScreen";
import OrdersScreen from "../screens/Main/OrdersScreen";
import PortfolioScreen from "../screens/Main/PortfolioScreen";
import TradeHistoryScreen from "../screens/Main/TradeHistoryScreen";
import ComplianceScreen from "../screens/Main/ComplianceScreen";
import ProfileScreen from "../screens/Main/ProfileScreen";
import AdminScreen from "../screens/Main/AdminScreen";
import MoreScreen from "../screens/Main/MoreScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: theme.colors.rail },
  headerTintColor: theme.colors.railForeground,
  headerTitleStyle: { fontWeight: "700" },
  contentStyle: { backgroundColor: theme.colors.background },
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="DashboardHome"
        component={DashboardScreen}
        options={{ title: "Dashboard" }}
      />
    </Stack.Navigator>
  );
}

function MarketplaceStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="MarketplaceHome"
        component={MarketplaceScreen}
        options={{ title: "Marketplace" }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: "Project" }}
      />
    </Stack.Navigator>
  );
}

function TradeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="TradeHome"
        component={TradingScreen}
        options={{ title: "Trade" }}
      />
    </Stack.Navigator>
  );
}

function PortfolioStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="PortfolioHome"
        component={PortfolioScreen}
        options={{ title: "Portfolio" }}
      />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ title: "More" }}
      />
      <Stack.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: "Order history" }}
      />
      <Stack.Screen
        name="Transactions"
        component={TradeHistoryScreen}
        options={{ title: "Transactions" }}
      />
      <Stack.Screen
        name="Compliance"
        component={ComplianceScreen}
        options={{ title: "Compliance" }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile & settings" }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: "Admin console" }}
      />
    </Stack.Navigator>
  );
}

const icons = {
  DashboardTab: "grid-outline",
  MarketplaceTab: "leaf-outline",
  TradeTab: "swap-horizontal-outline",
  PortfolioTab: "wallet-outline",
  MoreTab: "menu-outline",
};

/** The authenticated app: bottom tabs, each wrapping its own stack. */
const MainNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: theme.colors.railAccent,
      tabBarInactiveTintColor: theme.colors.railMuted,
      tabBarStyle: {
        backgroundColor: theme.colors.rail,
        borderTopColor: theme.colors.railBorder,
        height: 60,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={icons[route.name]} size={size ?? 22} color={color} />
      ),
    })}
  >
    <Tab.Screen
      name="DashboardTab"
      component={DashboardStack}
      options={{ title: "Dashboard" }}
    />
    <Tab.Screen
      name="MarketplaceTab"
      component={MarketplaceStack}
      options={{ title: "Marketplace" }}
    />
    <Tab.Screen
      name="TradeTab"
      component={TradeStack}
      options={{ title: "Trade" }}
    />
    <Tab.Screen
      name="PortfolioTab"
      component={PortfolioStack}
      options={{ title: "Portfolio" }}
    />
    <Tab.Screen
      name="MoreTab"
      component={MoreStack}
      options={{ title: "More" }}
    />
  </Tab.Navigator>
);

export default MainNavigator;
