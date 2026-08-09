# CarbonXchange

![CI/CD Status](https://img.shields.io/github/actions/workflow/status/quantsingularity/CarbonXchange/cicd.yml?branch=main&label=CI/CD&logo=github)
[![Test Coverage](https://img.shields.io/badge/coverage-81%25-brightgreen)](https://github.com/quantsingularity/CarbonXchange/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Blockchain-Based Carbon Credit Trading Platform

CarbonXchange is an innovative platform that leverages blockchain technology and artificial intelligence to revolutionize carbon credit trading, making it more transparent, efficient, and accessible for businesses and individuals.

<div align="center">
  <img src="docs/images/homepage.bmp" alt="CarbonXchange HomePage" width="80%">
</div>

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Installation and Setup](#installation-and-setup)
- [Usage](#usage)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

CarbonXchange is a decentralized platform that transforms how carbon credits are verified, traded, and retired. By combining blockchain's immutability with AI-powered verification, the platform ensures transparency and trust in the carbon offset market while making it accessible to businesses of all sizes and environmentally conscious individuals.

## Project Structure

The project is organized into several main components:

```
CarbonXchange/
├── code/                   # Core backend logic, services, and shared utilities
├── docs/                   # Project documentation
├── infrastructure/         # DevOps, deployment, and infra-related code
├── mobile-frontend/        # Mobile application
├── web-frontend/           # Web dashboard
├── scripts/                # Automation, setup, and utility scripts
├── LICENSE                 # License information
└── README.md               # Project overview and instructions
```

## Key Features

### Blockchain-Based Carbon Credit Tokenization

| Feature                       | Description                                                        |
| :---------------------------- | :----------------------------------------------------------------- |
| **Transparent Verification**  | Immutable record of carbon credit origin and lifecycle             |
| **Fractional Ownership**      | Ability to purchase partial carbon credits                         |
| **Smart Contract Automation** | Automated issuance, trading, and retirement                        |
| **Provenance Tracking**       | Complete history of each carbon credit from creation to retirement |

### AI-Powered Verification System

| Feature                        | Description                                                  |
| :----------------------------- | :----------------------------------------------------------- |
| **Project Validation**         | Automated assessment of carbon offset projects               |
| **Satellite Imagery Analysis** | Remote monitoring of reforestation and conservation projects |
| **Data Verification**          | Cross-referencing multiple data sources for accuracy         |
| **Fraud Detection**            | Identifying suspicious patterns and double-counting          |

### Carbon Credit Marketplace

| Feature                  | Description                                    |
| :----------------------- | :--------------------------------------------- |
| **Peer-to-Peer Trading** | Direct transactions between buyers and sellers |
| **Auction Mechanism**    | Competitive bidding for carbon credits         |
| **Price Discovery**      | Transparent market-based pricing               |
| **Portfolio Management** | Tools for managing carbon credit investments   |

### Impact Tracking & Reporting

| Feature                  | Description                                                 |
| :----------------------- | :---------------------------------------------------------- |
| **Real-Time Metrics**    | Live tracking of carbon offset impact                       |
| **Customizable Reports** | Generate reports for sustainability goals and compliance    |
| **ESG Integration**      | Connect carbon credits to broader ESG initiatives           |
| **API Access**           | Integrate carbon data into corporate sustainability systems |

## Technology Stack

### Blockchain & Smart Contracts

- **Blockchain**: Ethereum, Polygon
- **Smart Contract Language**: Solidity
- **Development Framework**: Hardhat, Truffle
- **Token Standard**: ERC-1155 (for carbon credit tokens)
- **Oracles**: Chainlink for external data

### Backend

- **Language**: Node.js, TypeScript
- **Framework**: Express, NestJS
- **Database**: PostgreSQL, MongoDB
- **API Documentation**: Swagger
- **Authentication**: JWT, OAuth2

### Frontend

- **Framework**: React with TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS, Styled Components
- **Web3 Integration**: ethers.js, web3.js
- **Data Visualization**: D3.js, Recharts

### AI & Machine Learning

- **Languages**: Python, TensorFlow
- **Computer Vision**: For satellite imagery analysis
- **Natural Language Processing**: For document verification
- **Data Processing**: Pandas, NumPy
- **Model Deployment**: TensorFlow Serving

### Infrastructure

- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana
- **Infrastructure as Code**: Terraform

## Architecture

The CarbonXchange platform follows a microservices architecture with these key components:

```
CarbonXchange/
├── Blockchain Layer
│   ├── Carbon Credit Token Contracts
│   ├── Marketplace Contracts
│   ├── Verification Registry
│   └── Governance Contracts
├── AI Verification Layer
│   ├── Project Validation Service
│   ├── Satellite Imagery Analysis
│   ├── Document Processing
│   └── Fraud Detection System
├── Marketplace Layer
│   ├── Order Matching Engine
│   ├── Auction System
│   ├── Price Discovery Mechanism
│   └── Portfolio Management
├── Analytics Layer
│   ├── Impact Calculation
│   ├── Reporting Engine
│   ├── Data Visualization
│   └── ESG Integration
└── API Gateway
    ├── Authentication & Authorization
    ├── Rate Limiting
    ├── Request Routing
    └── External Integrations
```

## Installation and Setup

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- Docker and Docker Compose
- Ethereum wallet (MetaMask recommended)

### Quick Start with Setup Script

```bash
# Clone the repository
git clone https://github.com/quantsingularity/CarbonXchange.git
cd CarbonXchange

# Run the setup script
./setup_carbonxchange_env.sh

# Start the application
./run_carbonxchange.sh
```

### Manual Local Development Setup

1. Install dependencies:

```bash
# Backend dependencies
cd code/backend
npm install

# Frontend dependencies
cd ../web-frontend
npm install

# AI service dependencies
cd ../ai-service
pip install -r requirements.txt
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the development environment:

```bash
docker-compose up -d
```

4. Deploy smart contracts to local blockchain:

```bash
cd code/blockchain
npx hardhat run scripts/deploy.js --network localhost
```

## Testing

The project maintains comprehensive test coverage across all components to ensure reliability and security.

### Test Coverage

| Component           | Coverage | Status |
| ------------------- | -------- | ------ |
| Smart Contracts     | 90%      | ✅     |
| Backend Services    | 83%      | ✅     |
| AI Verification     | 78%      | ✅     |
| Frontend Components | 75%      | ✅     |
| Integration Tests   | 80%      | ✅     |
| Overall             | 81%      | ✅     |

### Smart Contract Tests

| Test Type              | Description                |
| :--------------------- | :------------------------- |
| Unit tests             | For all contract functions |
| Integration tests      | For contract interactions  |
| Security tests         | Using Slither and Mythril  |
| Gas optimization tests | To ensure efficiency       |

### Backend Tests

| Test Type                              | Description                            |
| :------------------------------------- | :------------------------------------- |
| API endpoint tests                     | To verify correct routing and response |
| Service layer unit tests               | For core business logic                |
| Database integration tests             | For data persistence and retrieval     |
| Authentication and authorization tests | To ensure secure access control        |

### AI Model Tests

| Test Type                       | Description                          |
| :------------------------------ | :----------------------------------- |
| Model accuracy validation       | To ensure predictive power           |
| Computer vision algorithm tests | For satellite imagery analysis       |
| Document processing tests       | For data extraction and verification |
| Fraud detection tests           | To assess security                   |

### Frontend Tests

| Test Type                  | Description                      |
| :------------------------- | :------------------------------- |
| Component tests            | With React Testing Library       |
| Integration tests          | With Cypress for feature flows   |
| End-to-end user flow tests | To verify complete user journeys |
| Web3 integration tests     | For blockchain connectivity      |

### Running Tests

```bash
# Smart contract tests
cd code/blockchain
npx hardhat test

# Backend tests
cd code/backend
npm test

# AI service tests
cd code/ai-service
pytest

# Frontend tests
cd web-frontend
npm test

# Run all tests
./lint-all.sh test
```

#### CI/CD Pipeline

CarbonXchange uses GitHub Actions for continuous integration and deployment:

| Stage                | Control Area                    | Institutional-Grade Detail                                                              |
| :------------------- | :------------------------------ | :-------------------------------------------------------------------------------------- |
| **Formatting Check** | Change Triggers                 | Enforced on all `push` and `pull_request` events to `main` and `develop`                |
|                      | Manual Oversight                | On-demand execution via controlled `workflow_dispatch`                                  |
|                      | Source Integrity                | Full repository checkout with complete Git history for auditability                     |
|                      | Python Runtime Standardization  | Python 3.10 with deterministic dependency caching                                       |
|                      | Backend Code Hygiene            | `autoflake` to detect unused imports/variables using non-mutating diff-based validation |
|                      | Backend Style Compliance        | `black --check` to enforce institutional formatting standards                           |
|                      | Non-Intrusive Validation        | Temporary workspace comparison to prevent unauthorized source modification              |
|                      | Node.js Runtime Control         | Node.js 18 with locked dependency installation via `npm ci`                             |
|                      | Web Frontend Formatting Control | Prettier checks for web-facing assets                                                   |
|                      | Mobile Frontend Formatting      | Prettier enforcement for mobile application codebases                                   |
|                      | Documentation Governance        | Repository-wide Markdown formatting enforcement                                         |
|                      | Infrastructure Configuration    | Prettier validation for YAML/YML infrastructure definitions                             |
|                      | Compliance Gate                 | Any formatting deviation fails the pipeline and blocks merge                            |

## Documentation

| Document                    | Path                 | Description                                                          |
| :-------------------------- | :------------------- | :------------------------------------------------------------------- |
| **README**                  | `README.md`          | High-level overview, project scope, and repository entry point       |
| **Installation Guide**      | `INSTALLATION.md`    | Step-by-step installation and environment setup                      |
| **API Reference**           | `API.md`             | Detailed documentation for all API endpoints                         |
| **CLI Reference**           | `CLI.md`             | Command-line interface usage, commands, and examples                 |
| **User Guide**              | `USAGE.md`           | Comprehensive end-user guide, workflows, and examples                |
| **Architecture Overview**   | `ARCHITECTURE.md`    | System architecture, components, and design rationale                |
| **Configuration Guide**     | `CONFIGURATION.md`   | Configuration options, environment variables, and tuning             |
| **Feature Matrix**          | `FEATURE_MATRIX.md`  | Feature coverage, capabilities, and roadmap alignment                |
| **Smart Contracts**         | `SMART_CONTRACTS.md` | Smart contract architecture, interfaces, and security considerations |
| **Contributing Guidelines** | `CONTRIBUTING.md`    | Contribution workflow, coding standards, and PR requirements         |
| **Troubleshooting**         | `TROUBLESHOOTING.md` | Common issues, diagnostics, and remediation steps                    |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
