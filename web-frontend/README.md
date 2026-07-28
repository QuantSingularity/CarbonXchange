# CarbonXchange — Web Frontend

A regulated carbon credit trading platform. React 18 + TypeScript + Vite +
Tailwind CSS + shadcn/ui, fully wired to the Flask backend in `code/backend`.

## Design system

The visual identity ("atmospheric ledger") pairs a deep spruce-green brand
color with a warm ember accent, Fraunces for display type, Inter for body
text, and IBM Plex Mono for prices/tickers/IDs. Trading semantics (gains,
losses) use dedicated tokens separate from the brand color so they never
collide. The left navigation rail is always dark, like a terminal, regardless
of light/dark theme. All tokens live in `src/index.css` and
`tailwind.config.js`.

## Pages

| Route                              | Description                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `/`                                | Public marketing homepage — always the first screen on load                  |
| `/login`, `/register`              | Auth                                                                         |
| `/dashboard`                       | Portfolio summary, recent orders, compliance status                          |
| `/marketplace`, `/marketplace/:id` | Browse verified projects, drill into a project's credit batches              |
| `/trade`                           | Order entry with live ticker, order book depth, recent trades                |
| `/orders`                          | Order history with cancel                                                    |
| `/portfolio`                       | Holdings, P&L, allocation chart                                              |
| `/transactions`                    | Settled trade history with CSV export                                        |
| `/compliance`                      | KYC status, compliance records; reports tab for staff roles                  |
| `/profile`                         | Personal/KYC profile fields, password, email verification                    |
| `/admin`                           | User management, platform stats, AML summary (admin/compliance/auditor only) |

Unauthenticated visitors always land on `/`; `/dashboard` and everything
under it requires a session, and `/admin` additionally requires an
`admin`, `compliance_officer`, or `auditor` role.

## Backend integration

`src/services/api.ts` is a single typed client covering every route
registered in `code/backend/src/main.py` (auth, users, carbon-credits,
trading, market, compliance, admin), with response types mirrored from the
backend models' `to_dict()` output. It handles JWT storage, automatic
access-token refresh on 401s, and consistent error messages.

## Getting started

```bash
cp .env.example .env      # set VITE_API_URL if the backend isn't on :5000
npm install
npm run dev
```

The backend must be running (see `code/backend/README.md`) for any page
beyond the marketing homepage to have real data.

```bash
npm run build   # type-check + production build
npm run lint
```

## Known limitations

- The previous test suite (`tests/*.test.tsx`) targeted the pre-rewrite
  components and has been removed rather than left failing — see
  `tests/README.md`. A new suite should be written against the current
  pages/components.
- The bundle is a single chunk (~260 KB gzipped); route-based code-splitting
  would reduce initial load time further.
