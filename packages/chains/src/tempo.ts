import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
  toHex,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PaymentNotSubmittedError, type ChainVerification, type PaymentRail, type PurchaseOrder, type Settlement } from "@nischit/domain";

const tokenAbi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const escrowAbi = parseAbi([
  "function fund(bytes32 orderRef, address token, address supplier, uint256 amount) external",
  "function settle(bytes32 orderRef, uint256 supplierAmount, uint256 buyerCredit) external",
  "function refund(bytes32 orderRef) external",
  "event Funded(bytes32 indexed orderRef,address indexed buyer,address indexed supplier,address token,uint256 amount)",
  "event Settled(bytes32 indexed orderRef,uint256 supplierAmount,uint256 buyerCredit)",
  "event Refunded(bytes32 indexed orderRef,uint256 amount)",
]);

const settlementRef = (purchaseOrder: PurchaseOrder): Hex => keccak256(toHex(purchaseOrder.settlementReference));
const fundedEventAbi = parseAbiItem("event Funded(bytes32 indexed orderRef,address indexed buyer,address indexed supplier,address token,uint256 amount)");
const settledEventAbi = parseAbiItem("event Settled(bytes32 indexed orderRef,uint256 supplierAmount,uint256 buyerCredit)");
const refundedEventAbi = parseAbiItem("event Refunded(bytes32 indexed orderRef,uint256 amount)");

export interface TempoRailConfig {
  rpcUrl: string;
  chainId: number;
  escrowAddress: Address;
  payerPrivateKey: Hex;
  tokenAddresses: Record<string, Address>;
  supplierAddresses: Record<string, Address>;
  confirmations?: number;
  /** Inclusive deployment block used to recover submitted hashes after a process crash. */
  deploymentBlock: bigint;
}

/**
 * Tempo payment adapter for a deployed Nischit escrow contract.
 *
 * The domain never sees viem objects or chain-specific errors. Every operation
 * waits for a receipt before returning a payment reference, and the caller can
 * keep an unknown state when the RPC request fails after submission.
 */
export class TempoPaymentRail implements PaymentRail {
  private readonly account;
  private readonly wallet;
  private readonly publicClient;
  private readonly confirmations: number;

  constructor(private readonly config: TempoRailConfig) {
    const chain = defineChain({
      id: config.chainId,
      name: "Tempo",
      nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    });
    this.account = privateKeyToAccount(config.payerPrivateKey);
    this.wallet = createWalletClient({ account: this.account, chain, transport: http(config.rpcUrl) });
    this.publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
    this.confirmations = config.confirmations ?? 1;
  }

  async fund(input: { purchaseOrder: PurchaseOrder; onSubmitted?: (paymentReference: string) => Promise<void> | void }) {
    const token = this.config.tokenAddresses[input.purchaseOrder.token];
    const supplier = this.config.supplierAddresses[input.purchaseOrder.supplierTenantId];
    if (!token) throw new PaymentNotSubmittedError(`No Tempo token configured for ${input.purchaseOrder.token}; funding was not submitted`);
    if (!supplier) throw new PaymentNotSubmittedError(`No Tempo supplier address configured for ${input.purchaseOrder.supplierTenantId}; funding was not submitted`);
    let approval: Hex;
    try {
      approval = await this.wallet.writeContract({
        address: token,
        abi: tokenAbi,
        functionName: "approve",
        args: [this.config.escrowAddress, input.purchaseOrder.amountBaseUnits],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approval, confirmations: this.confirmations });
    } catch {
      throw new PaymentNotSubmittedError("Token approval did not complete; no escrow funding transaction was submitted");
    }
    const reference = settlementRef(input.purchaseOrder);
    const escrowTx = await this.wallet.writeContract({
      address: this.config.escrowAddress,
      abi: escrowAbi,
      functionName: "fund",
      args: [reference, token, supplier, input.purchaseOrder.amountBaseUnits],
    });
    await input.onSubmitted?.(escrowTx);
    await this.publicClient.waitForTransactionReceipt({ hash: escrowTx, confirmations: this.confirmations });
    return { paymentReference: escrowTx };
  }

  async settle(input: { purchaseOrder: PurchaseOrder; settlement: Settlement; supplierTenantId: string; onSubmitted?: (paymentReference: string) => Promise<void> | void }) {
    const tx = await this.wallet.writeContract({
      address: this.config.escrowAddress,
      abi: escrowAbi,
      functionName: "settle",
      args: [
        settlementRef(input.purchaseOrder),
        input.settlement.supplierAmountBaseUnits ?? input.settlement.amountBaseUnits,
        input.settlement.buyerCreditBaseUnits ?? 0n,
      ],
    });
    await input.onSubmitted?.(tx);
    await this.publicClient.waitForTransactionReceipt({ hash: tx, confirmations: this.confirmations });
    return { paymentReference: tx };
  }

  async refund(input: { purchaseOrder: PurchaseOrder; settlement: Settlement; onSubmitted?: (paymentReference: string) => Promise<void> | void }) {
    const tx = await this.wallet.writeContract({
      address: this.config.escrowAddress,
      abi: escrowAbi,
      functionName: "refund",
      args: [settlementRef(input.purchaseOrder)],
    });
    await input.onSubmitted?.(tx);
    await this.publicClient.waitForTransactionReceipt({ hash: tx, confirmations: this.confirmations });
    return { paymentReference: tx };
  }

  async verify(input: { purchaseOrder: PurchaseOrder; settlement: Settlement }): Promise<ChainVerification> {
    let reference = input.settlement.paymentReference;
    const orderRef = settlementRef(input.purchaseOrder).toLowerCase();
    const action = input.settlement.pendingAction ??
      (input.settlement.status === "confirmed" ? "settle" : input.settlement.status === "refunded" ? "refund" : "fund");
    const expectedEvent = action === "settle" ? "Settled" : action === "refund" ? "Refunded" : "Funded";
    if (!reference) {
      try {
        const fromBlock = this.config.deploymentBlock;
        const [fundLogs, settleLogs, refundLogs] = await Promise.all([
          this.publicClient.getLogs({ address: this.config.escrowAddress, event: fundedEventAbi, args: { orderRef: orderRef as Hex }, fromBlock }),
          this.publicClient.getLogs({ address: this.config.escrowAddress, event: settledEventAbi, args: { orderRef: orderRef as Hex }, fromBlock }),
          this.publicClient.getLogs({ address: this.config.escrowAddress, event: refundedEventAbi, args: { orderRef: orderRef as Hex }, fromBlock }),
        ]);
        const logs = [...fundLogs, ...settleLogs, ...refundLogs];
        const recovered = parseEventLogs({ abi: escrowAbi, logs, strict: false }).find((log) =>
          log.eventName === expectedEvent && (log.args as { orderRef?: Hex }).orderRef?.toLowerCase() === orderRef,
        );
        reference = recovered?.transactionHash;
      } catch {
        return { rail: "tempo", network: `chain ${this.config.chainId}`, status: "unverifiable", detail: "Tempo could not recover the submitted transaction." };
      }
      if (!reference) {
        return { rail: "tempo", network: `chain ${this.config.chainId}`, status: "pending", detail: "No matching escrow event is visible yet; the payment intent must not be resubmitted." };
      }
    }
    const base = { rail: "tempo" as const, reference, network: `chain ${this.config.chainId}` };
    if (!/^0x[0-9a-f]{64}$/i.test(reference)) {
      return { ...base, status: "unavailable", detail: "The Tempo payment reference is not a transaction hash." };
    }
    try {
      const [chainId, receipt, transaction, blockNumber] = await Promise.all([
        this.publicClient.getChainId(),
        this.publicClient.getTransactionReceipt({ hash: reference as Hex }),
        this.publicClient.getTransaction({ hash: reference as Hex }),
        this.publicClient.getBlockNumber(),
      ]);
      if (chainId !== this.config.chainId) return { ...base, status: "mismatch", detail: `RPC connected to chain ${chainId}; expected ${this.config.chainId}.` };
      if (transaction.to?.toLowerCase() !== this.config.escrowAddress.toLowerCase()) {
        return { ...base, status: "mismatch", detail: "Transaction target does not match the configured Nischit escrow." };
      }
      const confirmations = Number(blockNumber - receipt.blockNumber + 1n);
      if (receipt.status !== "success") return { ...base, status: "failed", block: receipt.blockNumber.toString(), confirmations, detail: "Tempo transaction reverted." };
      const events = parseEventLogs({ abi: escrowAbi, logs: receipt.logs, strict: false }).filter((log) => log.address.toLowerCase() === this.config.escrowAddress.toLowerCase());
      const matchingOrder = (args: unknown) => (args as { orderRef?: Hex }).orderRef?.toLowerCase() === orderRef;
      const funded = events.find((log) => log.eventName === "Funded" && matchingOrder(log.args));
      const settled = events.find((log) => log.eventName === "Settled" && matchingOrder(log.args));
      const refunded = events.find((log) => log.eventName === "Refunded" && matchingOrder(log.args));
      const event = expectedEvent === "Settled" && settled ? "Settled"
        : expectedEvent === "Refunded" && refunded ? "Refunded"
          : expectedEvent === "Funded" && funded ? "Funded" : undefined;
      if (!event) return { ...base, status: "mismatch", block: receipt.blockNumber.toString(), confirmations, detail: "Successful escrow transaction contains no matching event for this purchase order." };
      if (funded) {
        const args = funded.args as { buyer?: Address; token?: Address; supplier?: Address; amount?: bigint };
        const token = this.config.tokenAddresses[input.purchaseOrder.token];
        const supplier = this.config.supplierAddresses[input.purchaseOrder.supplierTenantId];
        const valid = token && supplier && args.buyer && args.token && args.supplier && args.amount !== undefined
          && args.buyer.toLowerCase() === this.account.address.toLowerCase()
          && args.token.toLowerCase() === token.toLowerCase()
          && args.supplier.toLowerCase() === supplier.toLowerCase()
          && args.amount === input.purchaseOrder.amountBaseUnits;
        if (!valid) return { ...base, status: "mismatch", event, block: receipt.blockNumber.toString(), confirmations, detail: "Funded event does not match the configured token, supplier, or order amount." };
      }
      const settledArgs = settled?.args as { supplierAmount?: bigint; buyerCredit?: bigint } | undefined;
      if (settled && (settledArgs?.supplierAmount !== (input.settlement.supplierAmountBaseUnits ?? input.settlement.amountBaseUnits)
        || settledArgs?.buyerCredit !== (input.settlement.buyerCreditBaseUnits ?? 0n))) {
        return { ...base, status: "mismatch", event, block: receipt.blockNumber.toString(), confirmations, detail: "Settled event amounts do not match the recorded settlement." };
      }
      const refundedArgs = refunded?.args as { amount?: bigint } | undefined;
      if (refunded && refundedArgs?.amount !== input.purchaseOrder.amountBaseUnits) {
        return { ...base, status: "mismatch", event, block: receipt.blockNumber.toString(), confirmations, detail: "Refunded event amount does not match the purchase order." };
      }
      if (confirmations < this.confirmations) return { ...base, status: "pending", event, block: receipt.blockNumber.toString(), confirmations, detail: `Waiting for ${this.confirmations} Tempo confirmation(s).` };
      return { ...base, status: "verified", event, block: receipt.blockNumber.toString(), confirmations, detail: `Confirmed ${event} event matches this purchase order.` };
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError || error instanceof TransactionNotFoundError) return { ...base, status: "pending", detail: "Tempo has not included this transaction in a block yet." };
      return { ...base, status: "unverifiable", detail: error instanceof Error ? `Tempo RPC verification failed: ${error.message}` : "Tempo RPC verification failed." };
    }
  }
}
