import type { ChainVerification, PurchaseOrder, Settlement } from "./types.js";

export interface PaymentRail {
  fund(input: { purchaseOrder: PurchaseOrder }): Promise<{ paymentReference: string }>;
  settle(input: {
    purchaseOrder: PurchaseOrder;
    settlement: Settlement;
    supplierTenantId: string;
  }): Promise<{ paymentReference: string }>;
  refund(input: { purchaseOrder: PurchaseOrder; settlement: Settlement }): Promise<{
    paymentReference: string;
  }>;
  verify(input: { purchaseOrder: PurchaseOrder; settlement: Settlement }): Promise<ChainVerification>;
}

export interface PublicAttestationRail {
  publish(input: {
    purchaseOrderId: string;
    settlementReference: string;
    termsHash: string;
    conditionReportHash?: string;
    qaDecisionHash?: string;
    paymentReference?: string;
  }): Promise<{ signature: string }>;
  verify(input: {
    purchaseOrderId: string;
    settlementReference: string;
    termsHash: string;
    conditionReportHash?: string;
    qaDecisionHash?: string;
    paymentReference?: string;
    signature?: string;
  }): Promise<ChainVerification>;
}

export class MockPaymentRail implements PaymentRail {
  private counter = 0;
  readonly calls: string[] = [];
  failNextSettlement = false;

  async fund(input: { purchaseOrder: PurchaseOrder }) {
    this.calls.push(`fund:${input.purchaseOrder.id}`);
    this.counter += 1;
    return { paymentReference: `tempo-test-fund-${this.counter}` };
  }

  async settle(input: { purchaseOrder: PurchaseOrder; settlement: Settlement }) {
    this.calls.push(`settle:${input.purchaseOrder.id}`);
    if (this.failNextSettlement) {
      this.failNextSettlement = false;
      throw new Error("payment rail timeout");
    }
    this.counter += 1;
    return { paymentReference: `tempo-test-settle-${this.counter}` };
  }

  async refund(input: { purchaseOrder: PurchaseOrder }) {
    this.calls.push(`refund:${input.purchaseOrder.id}`);
    this.counter += 1;
    return { paymentReference: `tempo-test-refund-${this.counter}` };
  }

  async verify() {
    return { rail: "tempo" as const, status: "unavailable" as const, detail: "Tempo verification is unavailable on the mock rail." };
  }
}

export class MockPublicAttestationRail implements PublicAttestationRail {
  private counter = 0;
  readonly calls: string[] = [];

  async publish(input: { purchaseOrderId: string }) {
    this.calls.push(`publish:${input.purchaseOrderId}`);
    this.counter += 1;
    return { signature: `solana-devnet-receipt-${this.counter}` };
  }

  async verify() {
    return { rail: "solana" as const, status: "unavailable" as const, detail: "Solana verification is unavailable on the mock rail." };
  }
}
