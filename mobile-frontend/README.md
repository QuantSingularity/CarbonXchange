# CarbonXchange — Mobile Frontend

React Native (Expo SDK 52) companion app for the CarbonXchange trading
platform, sharing the same "atmospheric ledger" design language as the web
app (spruce green / ember palette, serif display headings, monospace
prices) and talking to the same Flask backend in `code/backend`.

## Flow

The app always opens on **Welcome** — a lightweight version of the web
homepage — before any sign-in. From there people sign in or open an
account; once authenticated, the app switches to a 5-tab main navigator:

- **Dashboard** — portfolio summary, compliance banner, recent orders/holdings
- **Marketplace** — browse verified projects → project detail → credit batches
- **Trade** — symbol lookup, live ticker/depth/recent trades, order entry
- **Portfolio** — holdings, P&L, allocation chart
- **More** — Order history, Transactions, Compliance, Profile & settings, and (for admin/compliance/auditor roles) an Admin console

## Backend integration

`src/services/api.js` mirrors the web app's `src/services/api.ts`
function-for-function against the real backend routes, using
`expo-secure-store` for token persistence and the same refresh-on-401
handling. Auth state lives in Redux Toolkit (`src/store/slices/authSlice.js`).

## Getting started

```bash
cp .env.example .env
# Android emulator: API_BASE_URL=http://10.0.2.2:5000/api
# iOS simulator:    API_BASE_URL=http://localhost:5000/api
# Physical device:  API_BASE_URL=http://<your-machine-ip>:5000/api
npm install
npm start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR
code with Expo Go. The backend must be running for anything past the
Welcome screen to show real data.

```bash
npm run lint
```

## Known limitations

- The previous test suite under `src/__tests__` targeted screens that no
  longer exist and has been removed rather than left failing — see
  `src/__tests__/README.md`.
- The app uses a single light theme (matching the web app's light mode)
  rather than a full dark-mode toggle, to keep the two apps visually
  identical without adding a second theming system.
