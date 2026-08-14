# Smart Contracts Documentation

Complete reference for CarbonXchange blockchain smart contracts.

## Contracts Overview

| Contract                  | Purpose                        | Network Support | Status     |
| ------------------------- | ------------------------------ | --------------- | ---------- |
| CarbonCreditToken         | Basic ERC-20 token             | All             | Production |
| AdvancedCarbonCreditToken | Enhanced token with governance | Mainnet         | Production |
| Marketplace               | Basic trading                  | All             | Production |
| AdvancedMarketplace       | Advanced trading with auctions | Mainnet         | Production |

## CarbonCreditToken (Basic)

**File**: `code/blockchain/contracts/CarbonCreditToken.sol`

Simple ERC-20 token for carbon credits.

### Key Functions

| Function                                   | Parameters      | Description      | Access    |
| ------------------------------------------ | --------------- | ---------------- | --------- |
| `mint(address to, uint256 amount)`         | to, amount      | Mint new tokens  | onlyOwner |
| `transfer(address to, uint256 amount)`     | to, amount      | Transfer tokens  | Public    |
| `approve(address spender, uint256 amount)` | spender, amount | Approve spending | Public    |

## AdvancedCarbonCreditToken

**File**: `code/blockchain/contracts/AdvancedCarbonCreditToken.sol`

Enhanced token with role-based access control, pausable functionality, vintage tracking.

### Roles

- `ADMIN_ROLE` - Platform administration
- `MINTER_ROLE` - Token minting permission
- `PAUSER_ROLE` - Pause/unpause contract
- `COMPLIANCE_ROLE` - Compliance checks
- `AUDITOR_ROLE` - Audit access
- `VERIFIER_ROLE` - Project verification

### Key Features

- ✅ ERC-20 compliant
- ✅ Role-based access control
- ✅ Pausable in emergencies
- ✅ Burnable for retirement
- ✅ Vintage year tracking
- ✅ Project metadata
- ✅ Audit trail

## Deployment

```bash
cd code/blockchain

# Install dependencies (first time only)
npm install

# Compile contracts
npx truffle compile

# Run the test suite
npx truffle test

# Deploy to a local development chain
npx truffle migrate

# Deploy to the Polygon Amoy testnet (set MNEMONIC or PRIVATE_KEY in .env)
npx truffle migrate --network polygonTestnet

# Deploy to Polygon mainnet (set MNEMONIC or PRIVATE_KEY in .env)
npx truffle migrate --network polygon
```

`migrations/2_deploy_contracts.js` deploys all four contracts in one pass:
`CarbonCreditToken`, `Marketplace`, `AdvancedCarbonCreditToken`, and
`AdvancedMarketplace`. See `code/blockchain/.env.example` for the
optional environment variables (`FEE_RECIPIENT_ADDRESS`,
`PAYMENT_TOKEN_ADDRESS`) that configure the advanced contracts.

## See Also

- [Blockchain Integration](ARCHITECTURE.md#blockchain-layer)
- [Configuration](CONFIGURATION.md#blockchain-configuration)
