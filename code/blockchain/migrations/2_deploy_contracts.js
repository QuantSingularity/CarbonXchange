const fs = require("fs");
const path = require("path");

const CarbonCreditToken = artifacts.require("CarbonCreditToken");
const Marketplace = artifacts.require("Marketplace");
const AdvancedCarbonCreditToken = artifacts.require(
  "AdvancedCarbonCreditToken",
);
const AdvancedMarketplace = artifacts.require("AdvancedMarketplace");

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];

  // Optional overrides via .env; default to the deployer account so the
  // project works out of the box on a local/dev network.
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || admin;

  // ------------------------------------------------------------------
  // Basic (lightweight) token + marketplace
  // ------------------------------------------------------------------
  await deployer.deploy(CarbonCreditToken, admin);
  const token = await CarbonCreditToken.deployed();
  await deployer.deploy(Marketplace, token.address);

  // ------------------------------------------------------------------
  // Advanced (production) token + marketplace
  // ------------------------------------------------------------------
  await deployer.deploy(
    AdvancedCarbonCreditToken,
    "Advanced Carbon Credit",
    "ACCO2",
    admin,
    feeRecipient,
  );
  const advancedToken = await AdvancedCarbonCreditToken.deployed();

  // The advanced marketplace settles trades in an ERC20 payment token
  // (e.g. a stablecoin). PAYMENT_TOKEN_ADDRESS should point at that token
  // on the target network; for local development we deploy the basic
  // CarbonCreditToken as a stand-in payment token so `truffle migrate`
  // works without any extra configuration.
  let paymentTokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;
  if (!paymentTokenAddress) {
    paymentTokenAddress = token.address;
  }

  await deployer.deploy(
    AdvancedMarketplace,
    advancedToken.address,
    paymentTokenAddress,
    admin,
    feeRecipient,
  );
  const advancedMarketplace = await AdvancedMarketplace.deployed();

  // ------------------------------------------------------------------
  // Grant roles to the backend's operator wallet, if it's a different
  // address than `admin` (e.g. a dedicated hot wallet used by
  // code/backend/src/services/blockchain_service.py, separate from the
  // treasury/admin key that performed this deployment). Without this,
  // the backend operator would be unable to call registerProject,
  // verifyProject, issueCarbonCredits, or placeOrder on-chain.
  const operatorAddress = process.env.BACKEND_OPERATOR_ADDRESS;
  if (
    operatorAddress &&
    operatorAddress.toLowerCase() !== admin.toLowerCase()
  ) {
    const VERIFIER_ROLE = await advancedToken.VERIFIER_ROLE();
    const MINTER_ROLE = await advancedToken.MINTER_ROLE();
    const MARKET_MAKER_ROLE = await advancedMarketplace.MARKET_MAKER_ROLE();

    await advancedToken.grantRole(VERIFIER_ROLE, operatorAddress, {
      from: admin,
    });
    await advancedToken.grantRole(MINTER_ROLE, operatorAddress, {
      from: admin,
    });
    await advancedMarketplace.grantRole(MARKET_MAKER_ROLE, operatorAddress, {
      from: admin,
    });

    console.log(`Granted VERIFIER_ROLE + MINTER_ROLE (token) and`);
    console.log(
      `MARKET_MAKER_ROLE (marketplace) to operator ${operatorAddress}`,
    );
  }

  // ------------------------------------------------------------------
  // Write deployed addresses to a JSON file so the backend's .env can be
  // populated without hunting through migration logs.
  // ------------------------------------------------------------------
  const summary = {
    network,
    admin,
    feeRecipient,
    contracts: {
      CarbonCreditToken: token.address,
      Marketplace: Marketplace.address,
      AdvancedCarbonCreditToken: advancedToken.address,
      AdvancedMarketplace: advancedMarketplace.address,
      paymentToken: paymentTokenAddress,
    },
  };
  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nDeployed contract addresses written to ${outPath}`);
  console.log(JSON.stringify(summary.contracts, null, 2));
};
