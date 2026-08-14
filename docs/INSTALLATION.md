# Installation Guide

This guide provides detailed instructions for installing and setting up CarbonXchange on various platforms.

## Table of Contents

- [System Prerequisites](#system-prerequisites)
- [Installation Methods](#installation-methods)
- [Quick Setup Script](#quick-setup-script)
- [Manual Installation](#manual-installation)
- [Docker Installation](#docker-installation)
- [Database Setup](#database-setup)
- [Blockchain Configuration](#blockchain-configuration)
- [Verification](#verification)

## System Prerequisites

Before installing CarbonXchange, ensure your system meets the following requirements:

| Requirement | Version        | Purpose                                |
| ----------- | -------------- | -------------------------------------- |
| Python      | 3.8+           | Backend API server                     |
| Node.js     | 14+            | Frontend applications and build tools  |
| npm         | 6+             | Package management                     |
| Git         | 2.x            | Version control                        |
| PostgreSQL  | 13+            | Primary database                       |
| Redis       | 6+ (optional)  | Caching and rate limiting              |
| Docker      | 20+ (optional) | Containerized deployment               |
| MetaMask    | Latest         | Web3 wallet for blockchain interaction |

**Recommended System Resources:**

- CPU: 4+ cores
- RAM: 8GB minimum, 16GB recommended
- Storage: 20GB+ available space
- Network: Stable internet connection for blockchain interaction

## Installation Methods

CarbonXchange can be installed in three ways:

1. **Quick Setup Script** (Recommended) - Automated installation for development
2. **Manual Installation** - Step-by-step setup with full control
3. **Docker Installation** - Containerized deployment for production

## Installation by Operating System

| OS / Platform              | Recommended install method   | Notes                                  |
| -------------------------- | ---------------------------- | -------------------------------------- |
| Ubuntu 20.04+ / Debian 11+ | Quick setup script or manual | Native support, all features available |
| macOS 11+                  | Quick setup script or manual | Full compatibility                     |
| Windows 10/11              | Docker or WSL2 + manual      | Use WSL2 for better compatibility      |
| CentOS 8+ / RHEL 8+        | Manual or Docker             | Adjust package manager commands        |
| Production (any)           | Docker with Kubernetes       | Recommended for scalability            |

## Quick Setup Script

The fastest way to get started with CarbonXchange:

```bash
# 1. Clone the repository
git clone https://github.com/quantsingularity/CarbonXchange.git
cd CarbonXchange

# 2. Run the automated setup script
chmod +x scripts/dev_env/cx_setup_env.sh
./scripts/dev_env/cx_setup_env.sh

# 3. Start the platform
./scripts/orchestration/cx_run_dev.sh
```

The setup script will:

- ✓ Check system prerequisites
- ✓ Install Python and Node.js dependencies
- ✓ Configure environment variables
- ✓ Set up the database
- ✓ Initialize smart contracts (if blockchain is enabled)
- ✓ Run initial tests

**Time estimate**: 5-10 minutes on a typical development machine

## Manual Installation

For more control over the installation process:

### Step 1: Clone Repository

```bash
git clone https://github.com/quantsingularity/CarbonXchange.git
cd CarbonXchange
```

### Step 2: Backend Setup

```bash
# Navigate to backend directory
cd code/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env
# Edit .env with your settings (database URL, secrets, etc.)

# Initialize database
flask db upgrade
```

### Step 3: Web Frontend Setup

```bash
# Navigate to frontend directory
cd ../../web-frontend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Configure API endpoint and Web3 settings

# Build frontend (optional for production)
npm run build
```

### Step 4: Mobile Frontend Setup (Optional)

```bash
# Navigate to mobile frontend
cd ../mobile-frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### Step 5: Smart Contracts Setup (Optional)

```bash
# Navigate to blockchain directory
cd ../code/blockchain

# Install dependencies
npm install

# Compile contracts
npx truffle compile

# Deploy to local network (requires Ganache or similar)
npx truffle migrate --network development
```

### Step 6: AI Models Setup (Optional)

```bash
# Navigate to AI models directory
cd ../ai_models/training_scripts

# Install ML dependencies (already in backend requirements.txt)
# Train models (optional)
python train_forecasting_model.py
```

## Docker Installation

For production or isolated development environments:

### Prerequisites

- Docker 20.10+
- Docker Compose 1.29+

### Installation Steps

```bash
# Clone repository
git clone https://github.com/quantsingularity/CarbonXchange.git
cd CarbonXchange

# Build and start containers
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f backend
```

The Docker setup includes:

- Backend API container
- PostgreSQL database container
- Redis cache container
- Nginx reverse proxy (optional)

**Access points:**

- API: `http://localhost:5000`
- Web UI: `http://localhost:3000`

## Database Setup

### PostgreSQL Installation

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (Homebrew):**

```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Database Initialization

```bash
# Create database user
sudo -u postgres createuser carbonxchange --createdb --pwprompt

# Create database
sudo -u postgres createdb carbonxchange_dev

# Run migrations (from backend directory)
cd code/backend
source venv/bin/activate
flask db upgrade
```

### Redis Setup (Optional but Recommended)

**Ubuntu/Debian:**

```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS (Homebrew):**

```bash
brew install redis
brew services start redis
```

**Docker:**

```bash
docker run -d -p 6379:6379 redis:alpine
```

## Blockchain Configuration

### Setting Up Web3 Provider

1. **Create Infura Account** (or use Alchemy, QuickNode)
   - Visit [Infura](https://infura.io/)
   - Create a new project
   - Copy the project ID

2. **Deploy Smart Contracts**

```bash
cd code/blockchain
npm install

# For testnet (Polygon Amoy)
npx truffle migrate --network polygonTestnet

# For mainnet (requires significant MATIC for gas)
npx truffle migrate --network polygon
```

This deploys `CarbonCreditToken`, `Marketplace`, `AdvancedCarbonCreditToken`,
and `AdvancedMarketplace`, and writes their addresses to
`code/blockchain/deployed-addresses.json`.

3. **Configure Environment Variables**

Edit `code/backend/.env`:

```bash
# Blockchain Configuration
FEATURE_BLOCKCHAIN_INTEGRATION=true
WEB3_PROVIDER_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
WEB3_PRIVATE_KEY=your_operator_wallet_private_key
WEB3_CHAIN_ID=137  # 137 for Polygon, 1 for Ethereum mainnet
WEB3_GAS_LIMIT=500000
WEB3_GAS_PRICE_MULTIPLIER=1.1

# Contract addresses, from code/blockchain/deployed-addresses.json
CARBON_TOKEN_CONTRACT_ADDRESS=0x...   # AdvancedCarbonCreditToken address
MARKETPLACE_CONTRACT_ADDRESS=0x...    # AdvancedMarketplace address
PAYMENT_TOKEN_CONTRACT_ADDRESS=0x...  # ERC20 token the marketplace settles in
```

The backend operator wallet (`WEB3_PRIVATE_KEY`) must hold `VERIFIER_ROLE`
and `MINTER_ROLE` on the deployed `AdvancedCarbonCreditToken` contract to
register/verify projects and issue credits. If it's a different address
than whichever account ran `truffle migrate`, set
`BACKEND_OPERATOR_ADDRESS` in `code/blockchain/.env` before deploying so
the migration grants these roles automatically; otherwise grant them
manually via `grantRole()` after deployment.

If deploying the backend as a Docker container, see
`code/backend/contracts_abi/README.md` for the extra step needed to make
the compiled contract ABIs available inside the image.

4. **Configure MetaMask** (for manual/admin chain interactions, not
   required for the backend itself)
   - Install MetaMask browser extension
   - Add Polygon network
   - Import wallet or create new one

## Verification

After installation, verify everything is working:

### 1. Check Backend Health

```bash
curl http://localhost:5000/api/health
```

Expected output:

```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "api": "healthy"
  }
}
```

### 2. Run Tests

```bash
# Backend tests
cd code/backend
source venv/bin/activate
pytest tests/ -v

# Frontend tests
cd ../../web-frontend
npm test
```

### 3. Access Web Interface

Open browser to `http://localhost:3000` - you should see the CarbonXchange dashboard.

### 4. Verify Blockchain Connection

```bash
cd code/blockchain
npx truffle console --network development

# Inside console:
> web3.eth.getBlockNumber()
# Should return a number
```

## Post-Installation

### Security Checklist

- [ ] Change default secret keys in `.env`
- [ ] Configure strong JWT secrets
- [ ] Set up proper database user permissions
- [ ] Enable HTTPS in production
- [ ] Configure CORS origins appropriately
- [ ] Set up firewall rules
- [ ] Enable rate limiting with Redis

### Optional Enhancements

- Set up monitoring with Prometheus/Grafana
- Configure email notifications (SendGrid)
- Set up SMS notifications (Twilio)
- Enable Sentry for error tracking
- Configure backup jobs for database

## Next Steps

- Read the [Usage Guide](USAGE.md) to learn platform features
- Review the [API Reference](API.md) for development
- Check [Configuration](CONFIGURATION.md) for advanced settings
- Explore [Examples](examples/) for common use cases

## Troubleshooting

If you encounter issues, see the [Troubleshooting Guide](TROUBLESHOOTING.md) or common problems below:

**Problem**: Python dependencies fail to install
**Solution**: Ensure Python 3.8+ and pip are up to date: `pip install --upgrade pip`

**Problem**: Database connection fails
**Solution**: Check PostgreSQL is running: `sudo systemctl status postgresql`

**Problem**: Port already in use
**Solution**: Change ports in `.env` or stop conflicting services

**Problem**: Smart contract deployment fails
**Solution**: Ensure Web3 provider URL is correct and you have test ETH/MATIC
