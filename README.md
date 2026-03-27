# @stacksport/dca-sdk

TypeScript SDK for **StacksPort DCA Vaults** — create, manage, and auto-execute Dollar Cost Averaging plans on the Stacks blockchain.

## Features

- **Two vault types**: STX → sBTC and sBTC → USDCx
- **Read-only queries**: plans, stats, execution status — no wallet needed
- **Wallet integration**: create, deposit, pause, resume, cancel plans via `@stacks/connect`
- **Keeper module**: automated plan execution for bots (server-side, no browser)
- **Zero config**: mainnet defaults built-in, just import and use

## Install

```bash
npm install @stacksport/dca-sdk
```

For wallet interactions (browser):
```bash
npm install @stacks/connect
```

## Quick Start

### Read vault data (no wallet needed)

```ts
import { DCAVault, blocksToLabel, microToSTX } from "@stacksport/dca-sdk";

const vault = new DCAVault("stx-to-sbtc");

// Global stats
const stats = await vault.getStats();
console.log(`${stats.totalPlans} plans, ${stats.totalExecuted} executions`);

// User's plans
const plans = await vault.getUserPlans("SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV");
for (const plan of plans) {
  console.log(
    `Plan #${plan.id}: ${microToSTX(plan.amountPerSwap)} STX ${blocksToLabel(plan.intervalBlocks)}, ` +
    `${plan.totalSwaps} swaps done, ${plan.active ? "active" : "paused"}`
  );
}

// Check if a plan can be executed now
const canExec = await vault.canExecute(1);
```

### Create a DCA plan (browser with wallet)

```ts
import { DCAVault, Intervals, stxToMicro } from "@stacksport/dca-sdk";

const vault = new DCAVault("stx-to-sbtc");

vault.createPlan(
  {
    targetToken: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    amountPerSwap: stxToMicro(5),       // 5 STX per swap
    intervalBlocks: Intervals.Daily,     // every ~3.3 hours
    initialDeposit: stxToMicro(50),      // 50 STX total
  },
  {
    onFinish: ({ txId }) => console.log("Transaction:", txId),
    onCancel: () => console.log("User cancelled"),
  }
);
```

### Manage plans

```ts
// Deposit more funds
await vault.deposit(planId, stxToMicro(25), { onFinish, onCancel });

// Pause / Resume
await vault.pausePlan(planId, { onFinish });
await vault.resumePlan(planId, { onFinish });

// Cancel and refund
await vault.cancelPlan(planId, { onFinish });
```

### sBTC → USDCx vault

```ts
import { DCAVault, Intervals, btcToSats } from "@stacksport/dca-sdk";

const vault = new DCAVault("sbtc-to-usdcx");

vault.createPlan(
  {
    targetToken: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
    amountPerSwap: btcToSats(0.0001),    // 10,000 sats per swap
    intervalBlocks: Intervals.Weekly,
    initialDeposit: btcToSats(0.001),     // 100,000 sats total
  },
  { onFinish: ({ txId }) => console.log(txId) }
);
```

## Keeper (Automated Execution)

Run a bot that scans and executes eligible DCA plans. Designed for server-side use (Node.js, GitHub Actions, cron jobs).

```ts
import { Keeper } from "@stacksport/dca-sdk/keeper";

const keeper = new Keeper({
  privateKey: process.env.KEEPER_PRIVATE_KEY!,
  address: process.env.KEEPER_ADDRESS!,
  preset: "stx-to-sbtc",
  onLog: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta),
  onExecuted: ({ planId, txid }) => {
    console.log(`Plan #${planId} executed: ${txid}`);
  },
  onFailed: (planId) => {
    console.error(`Plan #${planId} failed`);
  },
});

const result = await keeper.run();
console.log(`Done: ${result.executed.length} executed, ${result.failed.length} failed`);
```

### Keeper with custom config

```ts
const keeper = new Keeper({
  privateKey: "...",
  address: "SP...",
  preset: "sbtc-to-usdcx",
  minAmountOut: 0,
  txFee: 5000,  // 0.005 STX
  vault: {
    apiUrl: "https://api.hiro.so",
  },
  delayBetweenPlans: 3000,
  delayBetweenScans: 300,
});
```

## API Reference

### `DCAVault`

| Method | Description |
|--------|-------------|
| `getStats()` | Global vault statistics |
| `getUserPlans(address)` | All plans for a user |
| `getPlan(planId)` | Single plan by ID |
| `getUserPlanIds(address)` | Plan IDs for a user |
| `canExecute(planId)` | Check if plan is executable now |
| `getNextExecutionBlock(planId)` | Next eligible block height |
| `createPlan(options, callbacks)` | Create new DCA plan |
| `deposit(planId, amount, callbacks)` | Add funds to plan |
| `execute(planId, callbacks)` | Manually trigger swap |
| `pausePlan(planId, callbacks)` | Pause an active plan |
| `resumePlan(planId, callbacks)` | Resume a paused plan |
| `cancelPlan(planId, callbacks)` | Cancel and refund |

### `Keeper`

| Method | Description |
|--------|-------------|
| `run()` | Scan and execute all eligible plans |
| `getExecutablePlanIds()` | List plan IDs ready to execute |
| `getBalance()` | Keeper wallet STX balance |

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `Intervals.Daily` | `1300` | ~3.3 hour interval |
| `Intervals.Weekly` | `9100` | ~1 day interval |
| `Intervals.Monthly` | `39000` | ~4.2 day interval |
| `MAX_PLANS_PER_USER` | `10` | Max plans per wallet |
| `PROTOCOL_FEE_BPS` | `30` | 0.3% protocol fee |

### Vault Presets

| Preset | Source | Target | Min Swap |
|--------|--------|--------|----------|
| `stx-to-sbtc` | STX | sBTC | 1 STX (1,000,000 μSTX) |
| `sbtc-to-usdcx` | sBTC | USDCx | 334 satoshis |

## License

MIT
