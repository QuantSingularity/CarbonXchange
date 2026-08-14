/**
 * Helpers for displaying on-chain provenance (tx hashes, contract
 * addresses) alongside carbon credit records. The backend's operator
 * wallet is the sole on-chain actor (custodial model - see
 * code/backend/src/services/blockchain_service.py), so these are purely
 * for transparency/audit display, not wallet-connect or signing.
 */

const DEFAULT_EXPLORER_BASE = "https://polygonscan.com";

function explorerBase(): string {
  return (
    (import.meta.env.VITE_BLOCK_EXPLORER_URL as string) || DEFAULT_EXPLORER_BASE
  ).replace(/\/+$/, "");
}

export function explorerTxUrl(txHash: string): string {
  return `${explorerBase()}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${explorerBase()}/address/${address}`;
}

/** Shorten a 0x-prefixed hash/address for compact display, e.g. 0x1234...abcd */
export function shortenHex(value: string, lead = 6, trail = 4): string {
  if (!value || value.length <= lead + trail + 2) return value;
  return `${value.slice(0, lead + 2)}...${value.slice(-trail)}`;
}
