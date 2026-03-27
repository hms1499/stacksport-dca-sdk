/**
 * Manages nonce sequencing for keeper transactions.
 * Tracks pending nonces locally and re-fetches from chain on errors.
 */
export class NonceManager {
  private currentNonce = -1;
  private pendingCount = 0;

  constructor(
    private apiUrl: string,
    private address: string
  ) {}

  async getNextNonce(): Promise<number> {
    if (this.currentNonce === -1) {
      this.currentNonce = await this.fetchNonce();
      this.pendingCount = 0;
    }

    const nonce = this.currentNonce + this.pendingCount;
    this.pendingCount++;
    return nonce;
  }

  confirmTx(): void {
    this.currentNonce++;
    this.pendingCount = Math.max(0, this.pendingCount - 1);
  }

  reset(): void {
    this.currentNonce = -1;
    this.pendingCount = 0;
  }

  private async fetchNonce(): Promise<number> {
    // Check mempool for pending txs to avoid nonce conflicts
    const mempoolRes = await fetch(
      `${this.apiUrl}/extended/v1/address/${this.address}/mempool?limit=50`
    );

    const accountNonce = await this.getAccountNonce();

    if (!mempoolRes.ok) return accountNonce;

    const json = (await mempoolRes.json()) as {
      results?: { nonce: number }[];
    };
    const results = json.results ?? [];
    if (results.length === 0) return accountNonce;

    const maxPendingNonce = Math.max(...results.map((tx) => tx.nonce));
    return Math.max(maxPendingNonce + 1, accountNonce);
  }

  private async getAccountNonce(): Promise<number> {
    const res = await fetch(
      `${this.apiUrl}/v2/accounts/${this.address}?proof=0`
    );
    if (!res.ok) throw new Error(`Failed to fetch nonce for ${this.address}`);
    const json = (await res.json()) as { nonce: number };
    return json.nonce;
  }
}
