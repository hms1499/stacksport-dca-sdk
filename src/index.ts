// ─── Main entry point ─────────────────────────────────────────────────────────

export { DCAVault } from "./vault.js";

// Types
export type {
  Network,
  VaultConfig,
  VaultPreset,
  DCAPlan,
  DCAStats,
  CreatePlanOptions,
  TxCallbacks,
  IntervalName,
  KeeperConfig,
  KeeperRunResult,
  ExecutionResult,
} from "./types.js";

// Constants
export { Intervals } from "./types.js";
export {
  VAULT_PRESETS,
  DEFAULT_API_URL,
  MAX_PLANS_PER_USER,
  PROTOCOL_FEE_BPS,
} from "./constants.js";

// Utils
export {
  microToSTX,
  stxToMicro,
  satsToBTC,
  btcToSats,
  toHuman,
  toSmallest,
  blocksToLabel,
} from "./utils.js";

// Errors
export { ContractError, RateLimitError } from "./clarity.js";
