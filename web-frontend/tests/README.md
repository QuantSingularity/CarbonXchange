# Tests

The previous test suite here targeted the pre-rewrite components (old
`Market.tsx`, `components/Dashboard.tsx`, `components/MarketStats.tsx`, and
an `api.ts` client with different function signatures) and no longer
applies now that the app has been rebuilt against the real backend with a
new page set (see `src/pages`) and a new `src/services/api.ts` client.

Those stale spec files have been removed rather than left failing. If you
add a test suite back, target the current pages/components and mock
`src/services/api.ts`'s named exports (`authApi`, `tradingApi`,
`marketApi`, `creditsApi`, `projectsApi`, `complianceApi`, `adminApi`,
`userApi`) rather than a generic `api` default export.
