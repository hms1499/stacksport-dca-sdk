import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  contractPrincipalCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";

export interface ExecutorConfig {
  contractAddress: string;
  contractName: string;
  swapRouter: string;
  privateKey: string;
  minAmountOut: number;
  txFee: bigint;
}

const RETRY_DELAYS = [1000, 3000, 8000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonceError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("conflictingnonce") ||
    msg.includes("badnonce") ||
    msg.includes("nonce")
  );
}

export class Executor {
  constructor(private config: ExecutorConfig) {}

  /** Execute a single DCA plan with the given nonce */
  async executePlan(planId: number, nonce: number): Promise<string> {
    const [routerAddr, routerName] = this.config.swapRouter.split(".");

    const tx = await makeContractCall({
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      functionName: "execute-dca",
      functionArgs: [
        uintCV(planId),
        contractPrincipalCV(routerAddr, routerName),
        uintCV(this.config.minAmountOut),
      ],
      senderKey: this.config.privateKey,
      network: STACKS_MAINNET,
      nonce: BigInt(nonce),
      fee: this.config.txFee,
      postConditionMode: 1,
    });

    const result = await broadcastTransaction({
      transaction: tx,
      network: STACKS_MAINNET,
    });

    if ("error" in result && result.error) {
      throw new Error(
        `Broadcast failed: ${result.error} — ${result.reason ?? ""}`
      );
    }

    return result.txid;
  }

  /** Execute with automatic nonce retry */
  async executePlanWithRetry(
    planId: number,
    getNonce: () => Promise<number>,
    confirmNonce: () => void,
    resetNonce: () => void
  ): Promise<{ txid: string } | null> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const nonce = await getNonce();
        const txid = await this.executePlan(planId, nonce);
        confirmNonce();
        return { txid };
      } catch (err: unknown) {
        const isLast = attempt === RETRY_DELAYS.length;

        if (isNonceError(err)) {
          resetNonce();
          if (isLast) return null;
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }

        if (isLast) return null;
        await sleep(RETRY_DELAYS[attempt]);
      }
    }

    return null;
  }
}
