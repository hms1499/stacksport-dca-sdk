/** Convert smallest unit to human-readable amount */
export function toHuman(amount: number, decimals: number): number {
  return amount / Math.pow(10, decimals);
}

/** Convert human-readable amount to smallest unit */
export function toSmallest(amount: number, decimals: number): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

// Convenience aliases
export const microToSTX = (micro: number) => toHuman(micro, 6);
export const stxToMicro = (stx: number) => toSmallest(stx, 6);
export const satsToBTC = (sats: number) => toHuman(sats, 8);
export const btcToSats = (btc: number) => toSmallest(btc, 8);

/** Convert block interval to human label */
export function blocksToLabel(blocks: number): string {
  // Current values
  if (blocks === 650) return "Daily";
  if (blocks === 4550) return "Weekly";
  if (blocks === 19500) return "Monthly";
  // v2 intervals
  if (blocks === 1300) return "Daily (v2)";
  if (blocks === 9100) return "Weekly (v2)";
  if (blocks === 39000) return "Monthly (v2)";
  // Legacy intervals
  if (blocks === 9360) return "Daily (legacy)";
  if (blocks === 65520) return "Weekly (legacy)";
  if (blocks === 280800) return "Monthly (legacy)";
  if (blocks === 144) return "Daily (v1)";
  if (blocks === 1008) return "Weekly (v1)";
  if (blocks === 4320) return "Monthly (v1)";
  return `${blocks} blocks`;
}
