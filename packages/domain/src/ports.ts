import type { ChainVerification, PurchaseOrder, Settlement } from "./types.js";

export interface PaymentRail {
  fund(input: {
    purchaseOrder: PurchaseOrder;
    onSubmitted?: (paymentReference: string) => Promise<void> | void;
  }): Promise<{ paymentReference: string }>;
  settle(input: {
    purchaseOrder: PurchaseOrder;
    settlement: Settlement;
    supplierTenantId: string;
    onSubmitted?: (paymentReference: string) => Promise<void> | void;
  }): Promise<{ paymentReference: string }>;
  refund(input: {
    purchaseOrder: PurchaseOrder;
    settlement: Settlement;
    onSubmitted?: (paymentReference: string) => Promise<void> | void;
  }): Promise<{
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

  async fund(input: { purchaseOrder: PurchaseOrder; onSubmitted?: (paymentReference: string) => Promise<void> | void }) {
    this.calls.push(`fund:${input.purchaseOrder.id}`);
    this.counter += 1;
    const paymentReference = `tempo-test-fund-${this.counter}`;
    await input.onSubmitted?.(paymentReference);
    this.verifiedReferences.add(paymentReference);
    return { paymentReference };
  }

  async settle(input: { purchaseOrder: PurchaseOrder; settlement: Settlement; onSubmitted?: (paymentReference: string) => Promise<void> | void }) {
    this.calls.push(`settle:${input.purchaseOrder.id}`);
    this.counter += 1;
    const paymentReference = `tempo-test-settle-${this.counter}`;
    await input.onSubmitted?.(paymentReference);
    this.verifiedReferences.add(paymentReference);
    if (this.failNextSettlement) {
      this.failNextSettlement = false;
      throw new Error("payment rail timeout");
    }
    return { paymentReference };
  }

  async refund(input: { purchaseOrder: PurchaseOrder; settlement: Settlement; onSubmitted?: (paymentReference: string) => Promise<void> | void }) {
    this.calls.push(`refund:${input.purchaseOrder.id}`);
    this.counter += 1;
    const paymentReference = `tempo-test-refund-${this.counter}`;
    await input.onSubmitted?.(paymentReference);
    this.verifiedReferences.add(paymentReference);
    return { paymentReference };
  }

  async verify(input: { settlement: Settlement }) {
    if (input.settlement.paymentReference && this.verifiedReferences.has(input.settlement.paymentReference)) {
      return { rail: "tempo" as const, status: "verified" as const, reference: input.settlement.paymentReference, detail: "Mock rail confirms the submitted payment." };
    }
    return { rail: "tempo" as const, status: "unavailable" as const, detail: "Tempo verification is unavailable on the mock rail." };
  }

  private readonly verifiedReferences = new Set<string>();
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
