require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

const { MNEMONIC, POLYGON_RPC_URL, POLYGON_AMOY_RPC_URL, PRIVATE_KEY } =
  process.env;

module.exports = {
  // This project's Solidity tests live in ./tests (plural), not Truffle's
  // ./test default, so we point Truffle at it explicitly.
  test_directory: "./tests",
  test_file_extension_regexp: /.*\.js$/,

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },

    // Local Truffle-managed development chain (ganache under the hood).
    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },

    // Polygon PoS mainnet.
    polygon: {
      provider: () => {
        if (!MNEMONIC && !PRIVATE_KEY) {
          throw new Error(
            "Set MNEMONIC or PRIVATE_KEY in your .env file before deploying to polygon",
          );
        }
        return new HDWalletProvider({
          mnemonic: MNEMONIC,
          privateKeys: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
          providerOrUrl: POLYGON_RPC_URL || "https://polygon-rpc.com",
        });
      },
      network_id: 137,
      gas: 5500000,
      gasPrice: 50000000000, // 50 gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: false,
    },

    // Polygon Amoy testnet for staging deployments.
    polygonTestnet: {
      provider: () => {
        if (!MNEMONIC && !PRIVATE_KEY) {
          throw new Error(
            "Set MNEMONIC or PRIVATE_KEY in your .env file before deploying to polygonTestnet",
          );
        }
        return new HDWalletProvider({
          mnemonic: MNEMONIC,
          privateKeys: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
          providerOrUrl:
            POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
        });
      },
      network_id: 80002,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  compilers: {
    solc: {
      version: "0.8.24",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        // Avoids "stack too deep" compile errors in the larger marketplace
        // and token contracts without changing execution semantics.
        viaIR: true,
      },
    },
  },

  db: {
    enabled: false,
  },

  mocha: {
    timeout: 100000,
  },
};
