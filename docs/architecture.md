# Architecture

CarbonXchange platform architecture, system design, and component interactions.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Module Architecture](#module-architecture)
- [Deployment Architecture](#deployment-architecture)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Web Browser │  │ Mobile App   │  │ API Clients  │                  │
│  │ (React)     │  │ (React Native│  │ (Python/JS)  │                  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘                  │
└─────────┼────────────────┼──────────────────┼──────────────────────────┘
          │                │                  │
          └────────────────┼──────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────────┐
│                  API Gateway / Load Balancer                              │
│                    (Nginx / Rate Limiting)                                │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────────┐
│                     Backend API Layer                                     │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │             Flask Application (Python)                      │         │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │         │
│  │  │  Auth    │ │ Trading  │ │Portfolio │ │Compliance│     │         │
│  │  │ Routes   │ │ Routes   │ │ Routes   │ │ Routes   │     │         │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │         │
│  │       │            │            │            │             │         │
│  │  ┌────┴─────┬──────┴─────┬──────┴─────┬──────┴─────┐     │         │
│  │  │  Auth    │  Trading   │ Portfolio  │Compliance  │     │         │
│  │  │ Service  │  Service   │  Service   │  Service   │     │         │
│  │  └──────────┴────────────┴────────────┴────────────┘     │         │
│  └────────────────────────┬───────────────────────────────────         │
└───────────────────────────┼────────────────────────────────────────────┘
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
┌─────▼──────┐    ┌─────────▼──────┐    ┌────────▼───────┐
│PostgreSQL  │    │    Redis        │    │   Blockchain   │
│ Database   │    │  Cache/Queue    │    │(Ethereum/Polygon│
│            │    │                 │    │  Web3 Provider) │
└────────────┘    └─────────────────┘    └────────────────┘
```

## System Components

### 1. Client Layer

**Web Frontend** (`web-frontend/`)

- React 18+ with TypeScript
- Redux Toolkit for state management
- Tailwind CSS for styling
- ethers.js for Web3 integration
- Recharts for data visualization

**Mobile Frontend** (`mobile-frontend/`)

- React Native for iOS/Android
- Shared business logic with web
- Native wallet integration

### 2. API Layer

**Backend API** (`code/backend/`)

- Flask 3.1 web framework
- RESTful API design
- JWT-based authentication
- Role-based access control (RBAC)
- Request/response validation
- Comprehensive error handling

**Key Modules:**

| Module        | File Path           | Responsibility                                  |
| ------------- | ------------------- | ----------------------------------------------- |
| Main App      | `src/main.py`       | Application factory, middleware, error handlers |
| Configuration | `src/config.py`     | Environment-based configuration                 |
| Routes        | `src/routes/*.py`   | HTTP endpoint definitions                       |
| Services      | `src/services/*.py` | Business logic layer                            |
| Models        | `src/models/*.py`   | Database ORM models                             |
| Security      | `src/security.py`   | Authentication decorators, permissions          |
| Utils         | `src/utils.py`      | Helper functions, validators                    |

### 3. Service Layer

**Core Services:**

```python
# Service Architecture Pattern
class TradingService:
    def __init__(self):
        self.risk_service = RiskService()
        self.compliance_service = ComplianceService()
        self.blockchain_service = BlockchainService()

    def submit_order(self, order):
        # Pre-trade checks
        risk_check = self.risk_service.check_order_risk(order)
        compliance_check = self.compliance_service.check_order_compliance(order)

        # Execute order
        result = self._match_order(order)

        # Post-trade processing
        self.blockchain_service.record_transaction(result)
        return result
```

| Service                 | Primary Functions                        |
| ----------------------- | ---------------------------------------- |
| **AuthService**         | Login, registration, MFA, password reset |
| **TradingService**      | Order creation, matching, execution      |
| **PortfolioService**    | Holdings, P&L calculation, analytics     |
| **ComplianceService**   | KYC/AML, regulatory reports              |
| **RiskService**         | Pre-trade checks, position limits        |
| **BlockchainService**   | Web3 integration, transaction tracking   |
| **MarketDataService**   | Real-time prices, historical data        |
| **AuditService**        | Audit logging, event tracking            |
| **NotificationService** | Email, SMS notifications                 |

### 4. Data Layer

**PostgreSQL Database**

- Primary data store
- User accounts, orders, trades
- Audit logs, compliance records
- ACID transactions

**Schema Overview:**

```sql
Users
├── id, email, password_hash, full_name
├── user_type, status, is_verified
├── kyc_status, mfa_enabled, created_at
└── Relationships: Orders, Portfolio, Trades

Orders
├── id, user_id, order_type, side
├── quantity, price, status, filled_quantity
├── credit_type, vintage_year, created_at
└── Relationships: User, Trades

Trades
├── id, buy_order_id, sell_order_id
├── quantity, price, executed_at
├── buyer_id, seller_id, credit_type
└── Relationships: Orders, Users

Portfolio
├── id, user_id, credit_type
├── total_quantity, average_price
├── unrealized_pnl, last_updated
└── Relationships: User, PortfolioHoldings
```

**Redis Cache**

- Session storage
- Rate limiting counters
- Market data cache
- Celery task queue

### 5. Blockchain Layer

**Smart Contracts** (`code/blockchain/contracts/`)

```
Smart Contract Architecture:

┌─────────────────────────────────────────┐
│   CarbonCreditToken (ERC-20)            │
│   ├── Basic token functionality         │
│   ├── Minting & burning                 │
│   └── Transfer & allowance             │
└─────────────────────────────────────────┘
         │ inherits
         ▼
┌─────────────────────────────────────────┐
│   AdvancedCarbonCreditToken             │
│   ├── Role-based access control         │
│   ├── Pausable functionality            │
│   ├── Vintage year tracking             │
│   ├── Project metadata                  │
│   └── Retirement mechanism              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   Marketplace                            │
│   ├── Listing creation                  │
│   ├── Buy/sell functionality            │
│   └── Basic trading                     │
└─────────────────────────────────────────┘
         │ inherits
         ▼
┌─────────────────────────────────────────┐
│   AdvancedMarketplace                   │
│   ├── Auction mechanism                 │
│   ├── Escrow functionality              │
│   ├── Fee management                    │
│   └── Advanced order types              │
└─────────────────────────────────────────┘
```

**Web3 Integration:**

- ethers.js / web3.py for blockchain interaction
- Infura/Alchemy as RPC providers
- MetaMask for user wallet connections
- Polygon (preferred) and Ethereum support

### 6. AI/ML Layer

**AI Models** (`code/ai_models/`)

- TensorFlow-based forecasting models
- Price prediction algorithms
- Anomaly detection
- Data preprocessing pipelines

## Data Flow

### Order Execution Flow

```
User → API Gateway → Backend API
            │
            ├─→ Authentication (JWT validation)
            │
            ├─→ Risk Check (RiskService)
            │   ├─→ Position limits
            │   ├─→ Buying power
            │   └─→ Concentration risk
            │
            ├─→ Compliance Check (ComplianceService)
            │   ├─→ KYC status
            │   ├─→ AML screening
            │   └─→ Trading restrictions
            │
            ├─→ Order Creation (TradingService)
            │   ├─→ Order validation
            │   ├─→ Database insert
            │   └─→ Order matching engine
            │
            ├─→ Trade Execution (if matched)
            │   ├─→ Update orders
            │   ├─→ Create trade record
            │   ├─→ Update portfolios
            │   └─→ Blockchain recording
            │
            └─→ Notifications
                ├─→ Email confirmation
                └─→ Real-time updates
```

### Authentication Flow

```
1. User Login Request
   ↓
2. Validate credentials (bcrypt hash comparison)
   ↓
3. Check MFA status
   ├─→ MFA enabled → Request TOTP code → Verify
   └─→ MFA disabled → Continue
   ↓
4. Generate JWT tokens
   ├─→ Access token (15min)
   └─→ Refresh token (7 days)
   ↓
5. Return tokens + user info
   ↓
6. Client stores tokens (localStorage/secure storage)
   ↓
7. Subsequent requests include: Authorization: Bearer <token>
   ↓
8. Backend validates token, extracts user_id
   ↓
9. Process request with authenticated user context
```

## Technology Stack

### Backend Technologies

```python
# Python Dependencies (requirements.txt)
Flask==3.1.1              # Web framework
SQLAlchemy==2.0.41        # ORM
Flask-JWT-Extended==4.6.0 # JWT authentication
Flask-CORS==6.0.0         # CORS handling
Flask-Limiter==3.5.0      # Rate limiting
psycopg2-binary==2.9.9    # PostgreSQL driver
redis==5.0.1              # Redis client
web3==6.12.0              # Blockchain integration
celery==5.3.4             # Async tasks
pytest==7.4.3             # Testing framework
```

### Frontend Technologies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "@reduxjs/toolkit": "^1.9.5",
    "ethers": "^6.7.0",
    "tailwindcss": "^3.3.0",
    "react-router-dom": "^6.14.0",
    "axios": "^1.4.0",
    "recharts": "^2.7.0"
  }
}
```

### Blockchain Technologies

```javascript
// Solidity ^0.8.19
// OpenZeppelin Contracts
// Truffle/Hardhat for development
// Polygon/Ethereum networks
```

## Module Architecture

### Backend Module Structure

```
code/backend/
├── src/
│   ├── __init__.py
│   ├── main.py                    # Application entry point
│   ├── config.py                  # Configuration management
│   ├── security.py                # Auth decorators, permissions
│   ├── utils.py                   # Helper functions
│   ├── models/                    # Database models (SQLAlchemy)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── trading.py
│   │   ├── carbon_credit.py
│   │   └── ...
│   ├── routes/                    # API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py               # Authentication endpoints
│   │   ├── trading.py            # Trading endpoints
│   │   ├── user.py               # User management
│   │   └── ...
│   └── services/                  # Business logic
│       ├── __init__.py
│       ├── auth_service.py
│       ├── trading_service.py
│       ├── portfolio_service.py
│       └── ...
├── tests/                         # Test suites
│   ├── conftest.py
│   ├── test_auth_service.py
│   ├── test_trading_service.py
│   └── ...
├── requirements.txt               # Python dependencies
├── Dockerfile                     # Container definition
└── .env.example                   # Environment template
```

### File-to-Feature Mapping

| Feature                | Implementation Files                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| User Registration      | `routes/auth.py`, `services/auth_service.py`, `models/user.py`          |
| Order Placement        | `routes/trading.py`, `services/trading_service.py`, `models/trading.py` |
| Portfolio Management   | `routes/user.py`, `services/portfolio_service.py`, `models/trading.py`  |
| KYC Verification       | `routes/user.py`, `services/kyc_service.py`, `models/user.py`           |
| Blockchain Integration | `services/blockchain_service.py`                                        |
| Market Data            | `routes/market.py`, `services/market_data_service.py`                   |

## Deployment Architecture

### Development Environment

```
┌─────────────────────────────────────────┐
│   Developer Machine                      │
│  ┌───────────────────────────────────┐  │
│  │ Flask Dev Server (port 5000)      │  │
│  │ Vite Dev Server (port 5173)       │  │
│  │ PostgreSQL (local/Docker)         │  │
│  │ Redis (local/Docker)              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Production Architecture (Kubernetes)

```
┌────────────────────────────────────────────────────────────┐
│                    Load Balancer (Cloud)                    │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────┼─────────────────────────────────┐
│         Kubernetes Cluster                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Ingress Controller (Nginx)                         │   │
│  └─────────────────┬───────────────────────────────────┘   │
│                    │                                        │
│  ┌─────────────────┼───────────────────────────────────┐   │
│  │  Backend Pods (3 replicas)                          │   │
│  │  ├── Flask App + Gunicorn                           │   │
│  │  ├── Auto-scaling (CPU/Memory)                      │   │
│  │  └── Health checks                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Frontend Pods (2 replicas)                         │   │
│  │  ├── Nginx serving static files                     │   │
│  │  └── CDN integration                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Worker Pods (Celery)                               │   │
│  │  ├── Background job processing                      │   │
│  │  └── Scheduled tasks                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
┌──────────▼─────┐   ┌─────────▼────────┐  ┌────────▼────────┐
│ PostgreSQL     │   │ Redis Cluster    │  │ External        │
│ (Managed)      │   │ (Managed)        │  │ Services        │
│ - Primary      │   │ - Cache          │  │ - Infura/Alchemy│
│ - Read Replicas│   │ - Queue          │  │ - SendGrid      │
│ - Backups      │   │ - Sessions       │  │ - Twilio        │
└────────────────┘   └──────────────────┘  │ - Sentry        │
                                            └─────────────────┘
```

## Monitoring and Observability

```
Application
    ├─→ Logs → CloudWatch / ELK Stack
    ├─→ Metrics → Prometheus → Grafana
    ├─→ Traces → OpenTelemetry
    └─→ Errors → Sentry
```

## Security Architecture

- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: TLS/SSL in transit, encrypted at rest
- **Rate Limiting**: Redis-backed token bucket algorithm
- **CSRF Protection**: Token-based CSRF prevention
- **SQL Injection**: Parameterized queries (SQLAlchemy)
- **XSS Protection**: Content Security Policy headers
- **Secrets Management**: Environment variables, secrets manager

## Next Steps

- Review [API Reference](API.md) for endpoint details
- Check [Feature Matrix](FEATURE_MATRIX.md) for component mapping
- See [Configuration](CONFIGURATION.md) for deployment settings
- Read [Contributing](CONTRIBUTING.md) for development guidelines
