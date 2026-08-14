// app.config.js - Dynamic Expo configuration
export default {
  expo: {
    name: "CarbonXchangeMobile",
    slug: "CarbonXchangeMobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#F3F5EF",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.carbonxchange.mobile",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F3F5EF",
      },
      package: "com.carbonxchange.mobile",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      API_BASE_URL: process.env.API_BASE_URL || "http://localhost:5000/api",
      APP_ENV: process.env.APP_ENV || "development",
      DEBUG: process.env.DEBUG || "true",
      ENABLE_BLOCKCHAIN: process.env.ENABLE_BLOCKCHAIN || "true",
      BLOCK_EXPLORER_URL:
        process.env.BLOCK_EXPLORER_URL || "https://polygonscan.com",
      LOG_API_REQUESTS: process.env.LOG_API_REQUESTS || "true",
      eas: {
        projectId: "your-project-id-here",
      },
    },
  },
};
