import { uintCV, contractPrincipalCV, standardPrincipalCV } from "@stacks/transactions";
import {
  cvToHex,
  toPrincipalCV,
  parseCV,
  callReadOnly,
} from "./clarity.js";
import { VAULT_PRESETS, DEFAULT_API_URL } from "./constants.js";
import type {
  VaultPreset,
  VaultConfig,
  DCAPlan,
  DCAStats,
  CreatePlanOptions,
  TxCallbacks,
} from "./types.js";

/**
 * DCAVault — interact with StacksPort DCA vault smart contracts.
 *
 * Supports both vault types:
 * - `"stx-to-sbtc"` — DCA from STX into sBTC
 * - `"sbtc-to-usdcx"` — DCA from sBTC into USDCx
 *
 * @example
 * ```ts
 * import { DCAVault, Intervals } from "@stacksport/dca-sdk";
 *
 * const vault = new DCAVault("stx-to-sbtc");
 *
 * // Read plans
 * const plans = await vault.getUserPlans("SP2...");
 * const stats = await vault.getStats();
 *
 * // Create a plan (opens wallet popup via @stacks/connect)
 * vault.createPlan({
 *   targetToken: "SM3VDX...sbtc-token",
 *   amountPerSwap: 5_000_000,        // 5 STX
 *   intervalBlocks: Intervals.Daily,  // every ~3.3h
 *   initialDeposit: 50_000_000,       // 50 STX
 * }, {
 *   onFinish: ({ txId }) => console.log("TX:", txId),
 * });
 * ```
 */
export class DCAVault {
  readonly contractAddress: string;
  readonly contractName: string;
  readonly swapRouter: string;
  readonly apiUrl: string;
  readonly network: string;

  constructor(preset: VaultPreset, config?: VaultConfig) {
    const defaults = VAULT_PRESETS[preset];
    this.contractAddress = config?.contractAddress ?? defaults.contractAddress;
    this.contractName = config?.contractName ?? defaults.contractName;
    this.swapRouter = config?.swapRouter ?? defaults.swapRouter;
    this.apiUrl = config?.apiUrl ?? DEFAULT_API_URL;
    this.network = config?.network ?? "mainnet";
  }

  // ─── Read-only helpers ────────────────────────────────────────────────────

  private readOnly(fn: string, args: string[] = []) {
    return callReadOnly(
      this.apiUrl,
      this.contractAddress,
      this.contractName,
      fn,
      args
    );
  }

  // ─── Read functions ───────────────────────────────────────────────────────

  /** Get global vault statistics */
  async getStats(): Promise<DCAStats> {
    const cv = await this.readOnly("get-stats");
    const val = parseCV(cv) as {
      "total-plans": number;
      "total-volume": number;
      "total-executed": number;
    };
    return {
      totalPlans: val["total-plans"],
      totalVolume: val["total-volume"],
      totalExecuted: val["total-executed"],
    };
  }

  /** Get all plan IDs for a user */
  async getUserPlanIds(address: string): Promise<number[]> {
    const cv = await this.readOnly("get-user-plans", [
      cvToHex(standardPrincipalCV(address)),
    ]);
    return parseCV(cv) as number[];
  }

  /** Get a single plan by ID (returns null if not found) */
  async getPlan(planId: number): Promise<DCAPlan | null> {
    const cv = await this.readOnly("get-plan", [cvToHex(uintCV(planId))]);
    const val = parseCV(cv);
    if (!val) return null;
    return {
      id: planId,
      owner: val.owner ?? "",
      targetToken: val.token ?? "",
      amountPerSwap: Number(val.amt ?? 0),
      intervalBlocks: Number(val.ivl ?? 0),
      lastExecutedBlock: Number(val.leb ?? 0),
      balance: Number(val.bal ?? 0),
      totalSwaps: Number(val.tsd ?? 0),
      totalSpent: Number(val.tss ?? 0),
      active: Boolean(val.active),
      createdAtBlock: Number(val.cat ?? 0),
    };
  }

  /** Get all plans for a user (fetches each plan by ID) */
  async getUserPlans(address: string): Promise<DCAPlan[]> {
    const ids = await this.getUserPlanIds(address);
    if (ids.length === 0) return [];
    const plans = await Promise.all(ids.map((id) => this.getPlan(id)));
    return plans.filter(Boolean) as DCAPlan[];
  }

  /** Get the next block height at which a plan can be executed */
  async getNextExecutionBlock(planId: number): Promise<number | null> {
    try {
      const cv = await this.readOnly("next-execution-block", [
        cvToHex(uintCV(planId)),
      ]);
      return parseCV(cv) as number;
    } catch {
      return null;
    }
  }

  /** Check if a plan can be executed right now */
  async canExecute(planId: number): Promise<boolean> {
    try {
      const cv = await this.readOnly("can-execute", [
        cvToHex(uintCV(planId)),
      ]);
      return parseCV(cv) as boolean;
    } catch {
      return false;
    }
  }

  // ─── Write functions (require @stacks/connect) ────────────────────────────

  /**
   * Create a new DCA plan.
   * Opens a wallet popup for the user to sign the transaction.
   * Requires `@stacks/connect` as a peer dependency.
   */
  async createPlan(options: CreatePlanOptions, callbacks: TxCallbacks) {
    const { openContractCall } = await import("@stacks/connect");
    const [tAddr, tName] = options.targetToken.split(".");

    openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: "create-plan",
      functionArgs: [
        contractPrincipalCV(tAddr, tName),
        uintCV(options.amountPerSwap),
        uintCV(options.intervalBlocks),
        uintCV(options.initialDeposit),
      ],
      network: this.network as "mainnet" | "testnet",
      postConditionMode: 1,
      onFinish: callbacks.onFinish,
      onCancel: callbacks.onCancel,
    });
  }

  /** Deposit additional funds into an existing plan */
  async deposit(planId: number, amount: number, callbacks: TxCallbacks) {
    const { openContractCall } = await import("@stacks/connect");

    openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: "deposit",
      functionArgs: [uintCV(planId), uintCV(amount)],
      network: this.network as "mainnet" | "testnet",
      postConditionMode: 1,
      onFinish: callbacks.onFinish,
      onCancel: callbacks.onCancel,
    });
  }

  /** Manually execute a DCA swap for a plan */
  async execute(
    planId: number,
    callbacks: TxCallbacks,
    swapRouter?: string,
    minAmountOut = 0
  ) {
    const { openContractCall } = await import("@stacks/connect");
    const router = swapRouter ?? this.swapRouter;
    const [rAddr, rName] = router.split(".");

    openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: "execute-dca",
      functionArgs: [
        uintCV(planId),
        contractPrincipalCV(rAddr, rName),
        uintCV(minAmountOut),
      ],
      network: this.network as "mainnet" | "testnet",
      postConditionMode: 1,
      onFinish: callbacks.onFinish,
      onCancel: callbacks.onCancel,
    });
  }

  /** Cancel a plan and refund remaining balance to the owner */
  async cancelPlan(planId: number, callbacks: TxCallbacks) {
    const { openContractCall } = await import("@stacks/connect");

    openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: "cancel-plan",
      functionArgs: [uintCV(planId)],
      network: this.network as "mainnet" | "testnet",
      postConditionMode: 1,
      onFinish: callbacks.onFinish,
      onCancel: callbacks.onCancel,
    });
  }

  /** Pause an active plan */
  async pausePlan(planId: number, callbacks: TxCallbacks) {
    const { openContractCall } = await import("@stacks/connect");

    openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: "pause-plan",
      functionArgs: [uintCV(planId)],
      network: this.network as "mainnet" | "testnet",
      postConditionMode: 1,
      onFinish: callbacks.onFinish,
      onCancel: callbacks.onCancel,
    });
  }

  /** Resume a paused plan */
  async resumePlan(planId: number, callbacks: TxCallbacks) {
    const { openContractCall } = await import("@stacks/connect");

    openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: "resume-plan",
      functionArgs: [uintCV(planId)],
      network: this.network as "mainnet" | "testnet",
      postConditionMode: 1,
      onFinish: callbacks.onFinish,
      onCancel: callbacks.onCancel,
    });
  }
}
