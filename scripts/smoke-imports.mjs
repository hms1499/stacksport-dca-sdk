import { DCAVault } from "../dist/index.js";
import * as keeper from "../dist/keeper/index.js";

if (typeof DCAVault !== "function") {
  throw new Error("DCAVault export is missing or invalid.");
}

if (!keeper || typeof keeper !== "object") {
  throw new Error("Keeper module export is missing.");
}

const vault = new DCAVault("stx-to-sbtc");

if (!vault) {
  throw new Error("Failed to instantiate DCAVault.");
}

console.log("Smoke test passed: root and keeper exports are available.");
