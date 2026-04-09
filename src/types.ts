// ─── Network & Config ─────────────────────────────────────────────────────────

export type Network = "mainnet" | "testnet";

export interface VaultConfig {
  /** Stacks network — defaults to "mainnet" */
  network?: Network;
  /** Hiro API base URL — defaults to "https://api.hiro.so" */
  apiUrl?: string;
  /** Override default contract address */
  contractAddress?: string;
  /** Override default contract name */
  contractName?: string;
  /** Override default swap router */
  swapRouter?: string;
}

// ─── DCA Plan ─────────────────────────────────────────────────────────────────

export interface DCAPlan {
  id: number;
  /** Plan owner's STX address */
  owner: string;
  /** Target token contract ID */
  targetToken: string;
  /** Source token amount per swap (in smallest unit) */
  amountPerSwap: number;
  /** Interval in Stacks blocks */
  intervalBlocks: number;
  /** Last executed block height */
  lastExecutedBlock: number;
  /** Remaining balance (in smallest unit) */
  balance: number;
  /** Total swaps completed */
  totalSwaps: number;
  /** Total source tokens spent (in smallest unit) */
  totalSpent: number;
  /** Whether the plan is active */
  active: boolean;
  /** Block height when plan was created */
  createdAtBlock: number;
}

// ─── DCA Stats ────────────────────────────────────────────────────────────────

export interface DCAStats {
  totalPlans: number;
  totalVolume: number;
  totalExecuted: number;
}

// ─── Interval Presets ─────────────────────────────────────────────────────────

/** Pre-defined block intervals for Nakamoto (~6.5 blocks/min) */
export const Intervals = {
  /** ~1.7 hours (650 blocks) */
  Daily: 650,
  /** ~11.7 hours (4,550 blocks) */
  Weekly: 4550,
  /** ~2.1 days (19,500 blocks) */
  Monthly: 19500,
} as const;

export type IntervalName = keyof typeof Intervals;

// ─── Create Plan Options ──────────────────────────────────────────────────────

export interface CreatePlanOptions {
  /** Target token contract ID (e.g. "SM3VDX...sbtc-token") */
  targetToken: string;
  /** Amount per swap in smallest unit (microSTX or satoshis) */
  amountPerSwap: number;
  /** Interval in blocks — use Intervals.Daily / .Weekly / .Monthly or custom */
  intervalBlocks: number;
  /** Initial deposit in smallest unit */
  initialDeposit: number;
}

// ─── Wallet Tx Callbacks (@stacks/connect) ────────────────────────────────────

export interface TxCallbacks {
  onFinish: (data: { txId: string }) => void;
  onCancel?: () => void;
}

// ─── Keeper ───────────────────────────────────────────────────────────────────

export interface KeeperConfig {
  /** Hex private key (64 chars) for the keeper wallet */
  privateKey: string;
  /** Keeper's STX address (for nonce management) */
  address: string;
  /** Vault config overrides */
  vault?: VaultConfig;
  /** Minimum output amount for swaps — defaults to 1 */
  minAmountOut?: number;
  /** Tx fee in microSTX — defaults to 3000 (0.003 STX) */
  txFee?: number;
}

export interface ExecutionResult {
  planId: number;
  txid: string;
}

export interface KeeperRunResult {
  executed: ExecutionResult[];
  failed: number[];
  total: number;
}

// ─── Vault presets ────────────────────────────────────────────────────────────

export type VaultPreset = "stx-to-sbtc" | "sbtc-to-usdcx";
