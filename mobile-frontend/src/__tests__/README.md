# Tests

The previous test suite here targeted screens that no longer exist
(`CreditsListScreen`, `CreditDetailScreen`, `MarketDataScreen`,
`WalletScreen`, the old `AppNavigator`) and an `authSlice`/`api` shape that
didn't match the real backend. Those stale spec files have been removed
rather than left failing.

If you add a test suite back, target the current screens under
`src/screens` and the new `src/navigation/RootNavigator.js` +
`src/navigation/MainNavigator.js`, and mock `src/services/api.js`'s named
exports (`authApi`, `tradingApi`, `marketApi`, `creditsApi`, `projectsApi`,
`complianceApi`, `adminApi`, `userApi`).
