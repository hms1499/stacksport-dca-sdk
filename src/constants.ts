import type { VaultPreset } from "./types.js";

interface VaultDefaults {
  contractAddress: string;
  contractName: string;
  swapRouter: string;
  targetTokens: { label: string; contractId: string }[];
  /** Source token decimals */
  sourceDecimals: number;
  /** Minimum amount per swap (in smallest unit) */
  minSwapAmount: number;
  /** Minimum initial deposit (in smallest unit) */
  minDeposit: number;
}

export const VAULT_PRESETS: Record<VaultPreset, VaultDefaults> = {
  "stx-to-sbtc": {
    contractAddress: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV",
    contractName: "dca-vault",
    swapRouter:
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router",
    targetTokens: [
      {
        label: "sBTC",
        contractId:
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
      },
    ],
    sourceDecimals: 6, // microSTX
    minSwapAmount: 1_000_000, // 1 STX
    minDeposit: 2_000_000, // 2 STX
  },
  "sbtc-to-usdcx": {
    contractAddress: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV",
    contractName: "dca-vault-sbtc-v2",
    swapRouter:
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-swap-router",
    targetTokens: [
      {
        label: "USDCx",
        contractId: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
      },
    ],
    sourceDecimals: 8, // satoshis
    minSwapAmount: 334, // min sats for 0.3% fee >= 1 sat
    minDeposit: 668, // 2x min swap
  },
};

export const DEFAULT_API_URL = "https://api.hiro.so";
export const MAX_PLANS_PER_USER = 10;
export const PROTOCOL_FEE_BPS = 30; // 0.3%
