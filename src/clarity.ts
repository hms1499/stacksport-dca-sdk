/**
 * Clarity value parsing & serialization helpers.
 * Handles both string-typed (newer @stacks/transactions) and
 * numeric ClarityType enum (legacy) formats.
 */

import {
  uintCV,
  standardPrincipalCV,
  contractPrincipalCV,
  serializeCV,
  hexToCV,
  ClarityType,
  type ClarityValue,
} from "@stacks/transactions";

// ─── Serialization ────────────────────────────────────────────────────────────

/** Serialize a ClarityValue to a hex string (prefixed with 0x) */
export function cvToHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

/** Build a principal CV from an address or "address.contractName" string */
export function toPrincipalCV(principal: string): ClarityValue {
  const parts = principal.split(".");
  if (parts.length === 2) return contractPrincipalCV(parts[0], parts[1]);
  return standardPrincipalCV(principal);
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Recursively parse a ClarityValue into a plain JS value.
 * Supports: uint, int, bool, none, some, ok, err, tuple, list, principal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCV(cv: ClarityValue): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as unknown as any;
  const t = raw.type;

  // String-typed format (newer @stacks/transactions versions)
  if (t === "uint" || t === "int") return Number(raw.value);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "none") return null;
  if (t === "some") return parseCV(raw.value);
  if (t === "ok") return parseCV(raw.value);
  if (t === "err") throw new ContractError(raw.value);
  if (t === "address" || t === "contract") return String(raw.value);
  if (t === "tuple") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    const data: Record<string, ClarityValue> = raw.value ?? {};
    for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
    return result;
  }
  if (t === "list") {
    const list: ClarityValue[] = raw.value ?? [];
    return list.map((item: ClarityValue) => parseCV(item));
  }

  // Fallback: legacy numeric ClarityType enum
  switch (cv.type) {
    case ClarityType.UInt:
    case ClarityType.Int:
      return Number(raw.value);
    case ClarityType.BoolTrue:
      return true;
    case ClarityType.BoolFalse:
      return false;
    case ClarityType.ResponseOk:
      return parseCV(raw.value);
    case ClarityType.ResponseErr:
      throw new ContractError(raw.value);
    case ClarityType.OptionalNone:
      return null;
    case ClarityType.OptionalSome:
      return parseCV(raw.value);
    case ClarityType.Tuple: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      const data: Record<string, ClarityValue> =
        raw.data ?? raw.value ?? {};
      for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
      return result;
    }
    case ClarityType.PrincipalStandard:
    case ClarityType.PrincipalContract:
      return String(raw.value ?? raw.address ?? "unknown");
    case ClarityType.List: {
      const list: ClarityValue[] = raw.list ?? raw.value ?? [];
      return list.map((item: ClarityValue) => parseCV(item));
    }
    default:
      return null;
  }
}

// ─── Read-only contract call ──────────────────────────────────────────────────

const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

/** Execute a read-only contract function call via the Hiro API */
export async function callReadOnly(
  apiUrl: string,
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: string[] = []
): Promise<ClarityValue> {
  const url = `${apiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
  });

  if (res.status === 429) {
    throw new RateLimitError();
  }

  const json = (await res.json()) as {
    okay: boolean;
    result: string;
    cause?: string;
  };

  if (!json.okay) {
    throw new Error(json.cause ?? "Read-only call failed");
  }

  return hexToCV(json.result);
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ContractError extends Error {
  constructor(public readonly clarityValue: unknown) {
    super(`Contract returned error: ${JSON.stringify(clarityValue)}`);
    this.name = "ContractError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Hiro API rate limit exceeded (HTTP 429)");
    this.name = "RateLimitError";
  }
}

// Re-export for convenience
export { uintCV, standardPrincipalCV, contractPrincipalCV, hexToCV };
