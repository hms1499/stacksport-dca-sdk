/**
 * Keeper — automated DCA plan executor for server-side / bot usage.
 *
 * @example
 * ```ts
 * import { Keeper } from "@stacksport/dca-sdk/keeper";
 *
 * const keeper = new Keeper({
 *   privateKey: "deadbeef...",
 *   address: "SP1FDP...",
 *   vault: { preset: "stx-to-sbtc" },
 * });
 *
 * const result = await keeper.run();
 * console.log(`Executed ${result.executed.length} plans`);
 * ```
 */

import { DCAVault } from "../vault.js";
import { NonceManager } from "./nonce-manager.js";
import { Executor, type ExecutorConfig } from "./executor.js";
import { VAULT_PRESETS, DEFAULT_API_URL } from "../constants.js";
import type {
  KeeperConfig,
  KeeperRunResult,
  ExecutionResult,
  VaultPreset,
} from "../types.js";

export interface KeeperOptions extends KeeperConfig {
  /** Which vault preset to use — defaults to "stx-to-sbtc" */
  preset?: VaultPreset;
  /** Called when a plan is successfully executed */
  onExecuted?: (result: ExecutionResult) => void;
  /** Called when a plan fails to execute */
  onFailed?: (planId: number, error: unknown) => void;
  /** Called with log messages */
  onLog?: (level: "info" | "warn" | "error", message: string, meta?: object) => void;
  /** Delay between executing plans (ms) — defaults to 2000 */
  delayBetweenPlans?: number;
  /** Delay between scanning plans (ms) — defaults to 200 */
  delayBetweenScans?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Keeper {
  private vault: DCAVault;
  private nonceManager: NonceManager;
  private executor: Executor;
  private log: (level: "info" | "warn" | "error", msg: string, meta?: object) => void;
  private opts: KeeperOptions;

  constructor(options: KeeperOptions) {
    this.opts = options;
    const preset = options.preset ?? "stx-to-sbtc";
    const defaults = VAULT_PRESETS[preset];
    const apiUrl = options.vault?.apiUrl ?? DEFAULT_API_URL;

    this.vault = new DCAVault(preset, {
      ...options.vault,
      apiUrl,
    });

    this.nonceManager = new NonceManager(apiUrl, options.address);

    const executorConfig: ExecutorConfig = {
      contractAddress: options.vault?.contractAddress ?? defaults.contractAddress,
      contractName: options.vault?.contractName ?? defaults.contractName,
      swapRouter: options.vault?.swapRouter ?? defaults.swapRouter,
      privateKey: options.privateKey,
      minAmountOut: options.minAmountOut ?? 1,
      txFee: BigInt(options.txFee ?? 3000),
    };
    this.executor = new Executor(executorConfig);

    this.log = options.onLog ?? (() => {});
  }

  /** Get the keeper wallet's STX balance (in microSTX) */
  async getBalance(): Promise<number> {
    const apiUrl = this.opts.vault?.apiUrl ?? DEFAULT_API_URL;
    const res = await fetch(
      `${apiUrl}/v2/accounts/${this.opts.address}?proof=0`
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as { balance: string };
    return Number(json.balance ?? 0);
  }

  /** Scan all plans and return IDs that are ready to execute */
  async getExecutablePlanIds(): Promise<number[]> {
    const stats = await this.vault.getStats();
    const totalPlans = stats.totalPlans;
    this.log("info", "Scanning plans", { totalPlans });

    if (totalPlans === 0) return [];

    const executable: number[] = [];
    const scanDelay = this.opts.delayBetweenScans ?? 200;

    for (let id = 1; id <= totalPlans; id++) {
      try {
        const canExec = await this.vault.canExecute(id);
        if (canExec) executable.push(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") || msg.includes("RateLimit")) break;
        // skip this plan on other errors
      }
      if (scanDelay > 0) await sleep(scanDelay);
    }

    return executable;
  }

  /**
   * Run a single keeper cycle: scan for executable plans and execute them.
   * Returns a summary of what was executed.
   */
  async run(): Promise<KeeperRunResult> {
    const balance = await this.getBalance();
    this.log("info", "Keeper balance", {
      balanceSTX: (balance / 1_000_000).toFixed(6),
    });

    if (balance < 100_000) {
      this.log("warn", "Keeper balance is low — top up needed", {
        balanceSTX: (balance / 1_000_000).toFixed(6),
      });
    }

    const executableIds = await this.getExecutablePlanIds();
    this.log("info", "Plans ready to execute", {
      count: executableIds.length,
      ids: executableIds,
    });

    if (executableIds.length === 0) {
      return { executed: [], failed: [], total: 0 };
    }

    const executed: ExecutionResult[] = [];
    const failed: number[] = [];
    const execDelay = this.opts.delayBetweenPlans ?? 2000;

    for (const planId of executableIds) {
      const result = await this.executor.executePlanWithRetry(
        planId,
        () => this.nonceManager.getNextNonce(),
        () => this.nonceManager.confirmTx(),
        () => this.nonceManager.reset()
      );

      if (result) {
        executed.push({ planId, txid: result.txid });
        this.log("info", "DCA executed", { planId, txid: result.txid });
        this.opts.onExecuted?.({ planId, txid: result.txid });
      } else {
        failed.push(planId);
        this.log("error", "DCA failed after retries", { planId });
        this.opts.onFailed?.(planId, new Error("All retries exhausted"));
      }

      if (execDelay > 0) await sleep(execDelay);
    }

    this.log("info", "Run complete", {
      executed: executed.length,
      failed: failed.length,
      total: executableIds.length,
    });

    return { executed, failed, total: executableIds.length };
  }
}

export { NonceManager } from "./nonce-manager.js";
export { Executor, type ExecutorConfig } from "./executor.js";
