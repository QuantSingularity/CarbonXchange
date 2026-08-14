// Helpers for displaying on-chain provenance (tx hashes, contract
// addresses) alongside carbon credit records. The backend's operator
// wallet is the sole on-chain actor (custodial model - see
// code/backend/src/services/blockchain_service.py), so these are purely
// for transparency/audit display, not wallet-connect or signing.
import { FEATURES } from "../config/constants";

function explorerBase() {
  return (FEATURES.blockExplorerUrl || "https://polygonscan.com").replace(
    /\/+$/,
    "",
  );
}

export function explorerTxUrl(txHash) {
  return `${explorerBase()}/tx/${txHash}`;
}

export function explorerAddressUrl(address) {
  return `${explorerBase()}/address/${address}`;
}

// Shorten a 0x-prefixed hash/address for compact display, e.g. 0x1234...abcd
export function shortenHex(value, lead = 6, trail = 4) {
  if (!value || value.length <= lead + trail + 2) return value;
  return `${value.slice(0, lead + 2)}...${value.slice(-trail)}`;
}
