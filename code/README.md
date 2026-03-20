# CarbonXchange Code Directory

## Overview

CarbonXchange is a comprehensive, institutional-grade carbon credit trading platform built with cutting-edge technology and financial industry best practices. This includes advanced trading algorithms, sophisticated risk management, AI-powered analytics, and enterprise-level security features designed for investor presentation and production deployment.

The code directory is the central repository for all source code in the CarbonXchange project, containing core components that power a comprehensive carbon credit trading and management platform. Each subdirectory represents a distinct component of the system architecture, designed to work together seamlessly.

## 🏗️ Directory Structure

```
CarbonXchange/code/
├── backend/                               # Flask-based API server
│   ├── src/
│   │   ├── models/                        # Database models with financial compliance
│   │   ├── services/                      # Advanced trading and risk management services
│   │   ├── api/                           # REST API endpoints with comprehensive documentation
│   │   ├── security/                      # Multi-layer security and authentication
│   │   └── utils/                         # Financial calculation utilities
│   ├── tests/                             # Comprehensive test suite (>90% coverage)
│   ├── docs/                              # Detailed API documentation
│   └── requirements.txt                   # Python dependencies
├── web-frontend/                          # React-based web application
│   ├── src/
│   │   ├── components/                    # Professional trading components
│   │   │   ├── Dashboard/                 # Advanced trading dashboard
│   │   │   ├── Analytics/                 # Market analytics and charts
│   │   │   └── Trading/                   # Order management interface
│   │   ├── pages/                         # Application pages with modern UX
│   │   ├── hooks/                         # Custom React hooks for trading
│   │   ├── utils/                         # Financial calculation utilities
│   │   └── styles/                        # Tailwind CSS with custom design system
│   ├── public/                            # Static assets and PWA configuration
│   ├── package.json                       # Node.js dependencies
│   └── tailwind.config.js                 # Custom Tailwind configuration
├── blockchain/                            # Smart contracts and blockchain integration
│   ├── contracts/                         # Advanced Solidity smart contracts
│   │   ├── AdvancedCarbonCreditToken.sol  # Token contract
│   │   └── AdvancedMarketplace.sol        # Sophisticated marketplace
│   ├── scripts/                           # Deployment and management scripts
│   └── tests/                             # Comprehensive contract tests
└── ai_models/                             # Machine learning models
    ├── training_scripts/                  # Advanced model training code
    │   ├── train_forecasting_model.py     # Original forecasting
    │   └── advanced_forecasting_model.py  # Multi-algorithm
    ├── models/                            # Trained model files
    └── data/                              # Training and validation data
```

## 🛠️ Technology Stack

### Backend

- **Framework**: Flask 3.1.1 with SQLAlchemy ORM
- **Database**: PostgreSQL with Redis caching
- **Security**: JWT authentication, bcrypt hashing, multi-factor authentication
- **Background Tasks**: Celery with Redis broker
- **API Documentation**: Flask-RESTX with OpenAPI/Swagger
- **Testing**: pytest with comprehensive coverage
- **Monitoring**: Prometheus metrics, structured logging

### Frontend

- **Framework**: React 18.2.0 with modern hooks
- **Styling**: Tailwind CSS 3.3.6 with custom design system
- **Charts**: Recharts, D3.js, Lightweight Charts for financial data visualization
- **State Management**: Zustand with Immer for immutable updates
- **Real-time**: Socket.IO client for WebSocket connections
- **Testing**: Jest with React Testing Library
- **Build**: Webpack 5 with optimization plugins

### Blockchain

- **Platform**: Ethereum-compatible smart contracts
- **Language**: Solidity 0.8.19 with OpenZeppelin libraries
- **Integration**: Web3.js and Ethers.js for blockchain interaction
- **Security**: Multi-signature wallets, access control, circuit breakers

### AI/ML

- **Frameworks**: TensorFlow, scikit-learn, pandas, numpy
- **Models**: LSTM networks, ARIMA time series, ensemble methods
- **Features**: Price prediction, risk assessment, sentiment analysis

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.11+ and pip
- PostgreSQL 13+
- Redis 6+
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/CarbonXchange.git
   cd CarbonXchange/code
   ```

2. **Backend Setup**

   ```bash
   cd backend

   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt

   # Set up environment variables
   cp .env.example .env
   # Edit .env with your configuration

   # Initialize database
   flask db upgrade

   # Start the server
   flask run --host=0.0.0.0 --port=8000
   ```

3. **Frontend Setup**

   ```bash
   cd ../web-frontend

   # Install dependencies
   npm install

   # Start development server
   npm start
   ```

4. **Blockchain Setup** (Optional)

   ```bash
   cd ../blockchain

   # Install dependencies
   npm install

   # Compile contracts
   npx hardhat compile

   # Deploy to local network
   npx hardhat run scripts/deploy.js --network localhost
   ```

## 📊 Features

### Advanced Trading Features

- **Sophisticated Order Types**: Market, Limit, Stop, Stop-Limit, Iceberg orders
- **Execution Algorithms**: TWAP (Time-Weighted Average Price), VWAP (Volume-Weighted Average Price)
- **Real-time Market Data**: Live quotes, order book depth, trade history with WebSocket updates
- **Portfolio Management**: Real-time P&L, position tracking, performance analytics with risk metrics

### Comprehensive Risk Management

- **Value at Risk (VaR)**: 95% and 99% confidence intervals with Monte Carlo simulations
- **Stress Testing**: Scenario analysis with custom shock parameters and historical simulations
- **Portfolio Optimization**: Modern Portfolio Theory implementation with efficient frontier
- **Risk Limits**: Position limits, concentration limits, daily trading limits with real-time monitoring

### Enterprise Security & Compliance

- **Multi-Factor Authentication**: TOTP-based 2FA with backup codes and biometric support
- **KYC/AML Integration**: Automated identity verification, sanctions screening, PEP checks
- **Audit Trails**: Comprehensive logging of all trading activities with immutable records
- **Regulatory Reporting**: Automated generation of MiFID II, EMIR, and other compliance reports

### AI-Powered Analytics

- **Advanced Price Prediction**: LSTM neural networks, ARIMA models, ensemble methods
- **Market Sentiment Analysis**: Real-time sentiment from news, social media, and market data
- **Technical Indicators**: RSI, MACD, Bollinger Bands, custom indicators with alerts
- **Anomaly Detection**: ML-based detection of unusual trading patterns and market manipulation

### Professional Trading Interface

- **Real-time Dashboard**: Live market data, portfolio performance, risk metrics
- **Advanced Charting**: Professional-grade charts with 50+ technical indicators
- **Order Management**: Sophisticated order entry with pre-trade risk checks
- **Portfolio Analytics**: Performance attribution, risk decomposition, scenario analysis

## 🧪 Testing & Quality Assurance

### Comprehensive Test Coverage

```bash
# Backend Tests (>90% coverage)
cd backend
pytest tests/ -v --cov=src --cov-report=html

# Frontend Tests (>85% coverage)
cd web-frontend
npm test -- --coverage --watchAll=false

# Smart Contract Tests
cd blockchain
npx hardhat test

# Integration Tests
npm run test:integration
```

### Code Quality Standards

- **Python**: PEP 8 compliance with Black formatting
- **JavaScript**: ESLint with Prettier formatting
- **TypeScript**: Strict type checking enabled
- **Security**: OWASP compliance with automated security scanning

### Key API Endpoints

- `POST /api/v1/auth/login` - Multi-factor authentication
- `GET /api/v1/trading/orders` - Advanced order management
- `POST /api/v1/trading/orders/twap` - TWAP order execution
- `GET /api/v1/portfolio/risk-metrics` - Comprehensive risk analysis
- `POST /api/v1/portfolio/optimize` - Portfolio optimization
- `GET /api/v1/analytics/trading-signals` - AI-powered trading signals
- `GET /api/v1/market/depth/{symbol}` - Real-time order book data

## 🔐 Enterprise Security Features

### Multi-Layer Security

- **Authentication**: JWT with refresh tokens, MFA, biometric support
- **Authorization**: Role-based access control (RBAC) with fine-grained permissions
- **Encryption**: AES-256 for data at rest, TLS 1.3 for data in transit
- **API Security**: Rate limiting, DDoS protection, input validation

### Compliance & Regulatory

- **GDPR**: Data anonymization, right to be forgotten, consent management
- **SOX**: Financial reporting controls, audit trails, segregation of duties
- **MiFID II**: Transaction reporting, best execution, investor protection
- **AML/KYC**: Automated screening, risk scoring, ongoing monitoring
