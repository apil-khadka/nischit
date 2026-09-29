import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import {
  MockPaymentRail,
  MockPublicAttestationRail,
  NischitEngine,
  PaymentOutcomeUnknownError,
  type Actor,
  type Role,
  type PaymentRail,
  type PublicAttestationRail,
} from "@nischit/domain";
import { SolanaMemoAttestationRail, TempoPaymentRail, parseSolanaSecretKey } from "@nischit/chains";
import { S3ObjectStore, type ObjectStore } from "@nischit/storage";
import { auditEventsToOutbox, PostgresStateStore } from "./persistence.js";
import { BearerJwtIdentityProvider, PreviewHeaderIdentityProvider, SignedSessionIdentityProvider, type IdentityProvider, type RequestIdentity } from "./identity.js";
import { ClamAvEvidenceScanner, DevelopmentEvidenceScanner, type EvidenceScanner } from "./evidence-scanner.js";

export interface AuthenticatedSession {
  kind: "preview" | "verified";
  tenantId: string;
  userId: string;
  name: string;
  tenantName: string;
  role: "buyer" | "supplier" | "receiving" | "qa" | "finance" | "auditor";
  roles: Role[];
  email?: string;
}

@Injectable()
export class EngineService implements OnModuleInit, OnModuleDestroy {
  readonly paymentRail: PaymentRail;
  readonly attestationRail: PublicAttestationRail;
  objectStore: ObjectStore | undefined;
  readonly identityProvider: IdentityProvider;
  readonly engine: NischitEngine;
  readonly evidenceScanner?: EvidenceScanner;
  readonly preview?: { buyerTenantId: string; supplierTenantId: string; users: Record<string, string>; productId: string };
  private store?: PostgresStateStore;
  private initialized = false;
  private commandQueue: Promise<unknown> = Promise.resolve();
  private persistedAuditCount = 0;

  constructor(@Optional() identityProvider?: IdentityProvider) {
    const configuredIdentity = SignedSessionIdentityProvider.fromEnvironment() ?? BearerJwtIdentityProvider.fromEnvironment();
    if (!identityProvider && !configuredIdentity && process.env.NODE_ENV === "production") {
      throw new Error("A verified identity provider is required in production");
    }
    this.identityProvider = identityProvider ?? configuredIdentity ?? new PreviewHeaderIdentityProvider();
    this.paymentRail = this.createPaymentRail();
    this.attestationRail = this.createAttestationRail();
    this.engine = new NischitEngine(this.paymentRail, this.attestationRail);
    const scannerHost = process.env.EVIDENCE_SCANNER_HOST;
    if (scannerHost) {
      this.evidenceScanner = new ClamAvEvidenceScanner(
        scannerHost,
        Number(process.env.EVIDENCE_SCANNER_PORT ?? "3310"),
        Number(process.env.EVIDENCE_SCANNER_TIMEOUT_MS ?? "30000"),
      );
    } else if (process.env.NODE_ENV !== "production") this.evidenceScanner = new DevelopmentEvidenceScanner();
    const endpoint = process.env.OBJECT_STORE_ENDPOINT;
    const bucket = process.env.OBJECT_STORE_BUCKET;
    const accessKeyId = process.env.OBJECT_STORE_ACCESS_KEY;
    const secretAccessKey = process.env.OBJECT_STORE_SECRET_KEY;
    if (endpoint && bucket && accessKeyId && secretAccessKey) {
      this.objectStore = S3ObjectStore.fromConfig({
        endpoint,
        region: process.env.OBJECT_STORE_REGION ?? "us-east-1",
        forcePathStyle: process.env.OBJECT_STORE_FORCE_PATH_STYLE !== "false",
        credentials: { accessKeyId, secretAccessKey },
        bucket,
      });
    }
    const previewDataEnabled = process.env.NODE_ENV !== "production";
    if (!previewDataEnabled) return;
    const buyer = this.engine.createTenant({
      id: "preview-buyer",
      name: "Nischit Preview Laboratory",
      ownerUserId: "preview-buyer-owner",
      ownerName: "Preview Buyer",
    });
    const supplier = this.engine.createTenant({
      id: "preview-supplier",
      name: "Nischit Preview Reagents",
      ownerUserId: "preview-supplier-owner",
      ownerName: "Preview Supplier",
    });
    this.engine.addMembership({ tenantId: buyer.id, userId: "preview-finance", displayName: "Preview Finance", roles: ["finance"] });
    this.engine.addMembership({ tenantId: buyer.id, userId: "preview-receiver", displayName: "Preview Receiving", roles: ["receiving"] });
    this.engine.addMembership({ tenantId: buyer.id, userId: "preview-qa", displayName: "Preview QA", roles: ["qa"] });
    this.engine.addMembership({ tenantId: supplier.id, userId: "preview-supplier-manager", displayName: "Preview Supplier Manager", roles: ["supplier"] });
    this.engine.configureTenant(this.engine.actor(buyer.id, "preview-buyer-owner"), {
      timezone: "Asia/Kathmandu",
      sites: [
        { id: "central", name: "Kathmandu central store", kind: "warehouse", active: true },
        { id: "branch", name: "Lalitpur branch laboratory", kind: "branch", active: true },
      ],
    });
    this.engine.configureTenant(this.engine.actor(supplier.id, "preview-supplier-owner"), {
      timezone: "Asia/Kathmandu",
      sites: [{ id: "supplier-warehouse", name: "Supplier warehouse", kind: "warehouse", active: true }],
    });
    const product = this.engine.createProduct(this.engine.actor(buyer.id, "preview-buyer-owner"), {
      name: "HbA1c reagent kit",
      manufacturer: "Nischit Diagnostics",
      baseUnit: "kit",
      storageMinCelsius: 2,
      storageMaxCelsius: 8,
      minimumShelfLifeDays: 30,
      requiredDocuments: ["invoice", "coa"],
    });
    this.preview = {
      buyerTenantId: buyer.id,
      supplierTenantId: supplier.id,
      productId: product.id,
      users: { buyerOwner: "preview-buyer-owner", finance: "preview-finance", receiver: "preview-receiver", qa: "preview-qa", supplier: "preview-supplier-manager" },
    };
  }

  private createPaymentRail(): PaymentRail {
    const mode = process.env.PAYMENT_MODE ?? (process.env.NODE_ENV === "production" ? "" : "mock");
    if (!mode) throw new Error("PAYMENT_MODE must be explicit in production (tempo only)");
    if (mode === "mock") {
      if (process.env.NODE_ENV === "production") throw new Error("Mock payment rail is disabled in production");
      return new MockPaymentRail();
    }
    if (mode !== "tempo") throw new Error(`Unsupported PAYMENT_MODE: ${mode}`);
    const rpcUrl = process.env.TEMPO_RPC_URL;
    const escrowAddress = process.env.TEMPO_ESCROW_ADDRESS;
    const payerPrivateKey = process.env.TEMPO_PAYER_PRIVATE_KEY;
    if (!rpcUrl || !escrowAddress || !payerPrivateKey) throw new Error("TEMPO_RPC_URL, TEMPO_ESCROW_ADDRESS, and TEMPO_PAYER_PRIVATE_KEY are required for PAYMENT_MODE=tempo");
    const deploymentBlock = process.env.TEMPO_ESCROW_DEPLOYMENT_BLOCK;
    if (!deploymentBlock || !/^\d+$/.test(deploymentBlock)) {
      throw new Error("TEMPO_ESCROW_DEPLOYMENT_BLOCK must identify the escrow deployment block for payment recovery");
    }
    const parseAddresses = (name: string) => {
      const raw = process.env[name];
      if (!raw) throw new Error(`${name} is required for PAYMENT_MODE=tempo`);
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${name} must be a JSON object`);
      return parsed as Record<string, `0x${string}`>;
    };
    return new TempoPaymentRail({
      rpcUrl,
      chainId: Number(process.env.TEMPO_CHAIN_ID ?? "42431"),
      escrowAddress: escrowAddress as `0x${string}`,
      payerPrivateKey: payerPrivateKey as `0x${string}`,
      tokenAddresses: parseAddresses("TEMPO_TOKEN_ADDRESSES_JSON"),
      supplierAddresses: parseAddresses("TEMPO_SUPPLIER_ADDRESSES_JSON"),
      confirmations: Number(process.env.TEMPO_CONFIRMATIONS ?? "1"),
      deploymentBlock: BigInt(deploymentBlock),
    });
  }

  private createAttestationRail(): PublicAttestationRail {
    const mode = process.env.ATTESTATION_MODE ?? (process.env.NODE_ENV === "production" ? "" : "mock");
    if (!mode) throw new Error("ATTESTATION_MODE must be explicit in production (solana only)");
    if (mode === "mock") {
      if (process.env.NODE_ENV === "production") throw new Error("Mock attestation rail is disabled in production");
      return new MockPublicAttestationRail();
    }
    if (mode !== "solana") throw new Error(`Unsupported ATTESTATION_MODE: ${mode}`);
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const signerSecretKey = process.env.SOLANA_SIGNER_SECRET_KEY;
    if (!rpcUrl || !signerSecretKey) throw new Error("SOLANA_RPC_URL and SOLANA_SIGNER_SECRET_KEY are required for ATTESTATION_MODE=solana");
    return new SolanaMemoAttestationRail({
      rpcUrl,
      rpcSubscriptionsUrl: process.env.SOLANA_RPC_SUBSCRIPTIONS_URL,
      signerSecretKey: parseSolanaSecretKey(signerSecretKey),
      memoPrefix: process.env.SOLANA_MEMO_PREFIX ?? "nischit:v1",
      networkName: process.env.SOLANA_NETWORK_NAME ?? "configured Solana cluster",
    });
  }

  async onModuleInit() {
    if (process.env.PERSISTENCE_MODE !== "postgres") {
      if (process.env.NODE_ENV === "production") throw new Error("PERSISTENCE_MODE=postgres is required in production");
      this.initialized = true;
      return;
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required when PERSISTENCE_MODE=postgres");
    this.store = new PostgresStateStore(connectionString);
    const snapshot = await this.store.load();
    if (snapshot) this.engine.replaceSnapshot(snapshot);
    else await this.store.save(this.engine.snapshot());
    this.persistedAuditCount = this.engine.snapshot().audit.length;
    this.engine.setPersistenceCheckpoint(() => this.persistCurrentSnapshot());
    this.initialized = true;
  }

  async onModuleDestroy() {
    await this.store?.close();
  }

  run<T>(action: () => T | Promise<T>): Promise<T> {
    const next = this.commandQueue.then(async () => {
      try {
        const result = await action();
        await this.persistCurrentSnapshot();
        return result;
      } catch (error) {
        if (error instanceof PaymentOutcomeUnknownError) await this.persistCurrentSnapshot();
        throw error;
      }
    });
    this.commandQueue = next.catch(() => undefined);
    return next;
  }

  private async persistCurrentSnapshot() {
    const snapshot = this.engine.snapshot();
    await this.store?.save(snapshot, auditEventsToOutbox(snapshot.audit, this.persistedAuditCount));
    this.persistedAuditCount = snapshot.audit.length;
  }

  actor(tenantId: string, userId: string): Actor {
    return this.engine.actor(tenantId, userId);
  }

  private provisionBootstrapIdentity(identity: RequestIdentity) {
    const snapshot = this.engine.snapshot();
    if (snapshot.memberships.some((membership) => membership.tenantId === identity.tenantId && membership.userId === identity.userId)) return;

    const bootstrapEmail = process.env.IDENTITY_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const bootstrapTenantId = process.env.IDENTITY_BOOTSTRAP_TENANT_ID?.trim();
    const bootstrapTenantName = process.env.IDENTITY_BOOTSTRAP_TENANT_NAME?.trim();
    if (!bootstrapEmail || !bootstrapTenantName || identity.email?.trim().toLowerCase() !== bootstrapEmail) return;
    if (bootstrapTenantId && bootstrapTenantId !== identity.tenantId) return;

    const existingTenant = snapshot.tenants.find((tenant) => tenant.id === identity.tenantId);
    if (!existingTenant) {
      this.engine.createTenant({
        id: identity.tenantId,
        name: bootstrapTenantName,
        ownerUserId: identity.userId,
        ownerName: identity.displayName ?? identity.email,
      });
      return;
    }

    const configuredRoles = (process.env.IDENTITY_BOOTSTRAP_ROLES ?? "owner,admin")
      .split(",")
      .map((role) => role.trim())
      .filter((role): role is Role => ["owner", "admin", "procurement", "supplier", "receiving", "qa", "finance", "auditor"].includes(role));
    this.engine.addMembership({
      tenantId: identity.tenantId,
      userId: identity.userId,
      displayName: identity.displayName ?? identity.email ?? identity.userId,
      roles: configuredRoles.length ? configuredRoles : ["owner", "admin"],
    });
  }

  private identityFromHeaders(headers: Record<string, string | string[] | undefined>) {
    const identity = this.identityProvider.resolve(headers);
    this.provisionBootstrapIdentity(identity);
    return identity;
  }

  actorFromHeaders(headers: Record<string, string | string[] | undefined>): Actor {
    const identity = this.identityFromHeaders(headers);
    return this.actor(identity.tenantId, identity.userId);
  }

  sessionFromHeaders(headers: Record<string, string | string[] | undefined>): AuthenticatedSession {
    const identity = this.identityFromHeaders(headers);
    const actor = this.actor(identity.tenantId, identity.userId);
    const snapshot = this.engine.snapshot();
    const membership = snapshot.memberships.find((candidate) => candidate.tenantId === actor.tenantId && candidate.userId === actor.userId);
    const tenant = snapshot.tenants.find((candidate) => candidate.id === actor.tenantId);
    if (!membership || !tenant) throw new Error("Authenticated tenant context is incomplete");
    const role = actor.roles.includes("supplier") ? "supplier"
      : actor.roles.includes("receiving") ? "receiving"
        : actor.roles.includes("qa") ? "qa"
          : actor.roles.includes("finance") ? "finance"
            : actor.roles.includes("auditor") ? "auditor"
              : "buyer";
    return {
      kind: this.identityProvider.verified === true ? "verified" : "preview",
      tenantId: actor.tenantId,
      userId: actor.userId,
      name: membership.displayName,
      tenantName: tenant.name,
      role,
      roles: actor.roles,
      ...(identity.email ? { email: identity.email } : {}),
    };
  }

  actorWithRole(tenantId: string, userId: string, roles: Role[]): Actor {
    return { tenantId, userId, roles };
  }

  readiness() {
    const production = process.env.NODE_ENV === "production";
    const checks = {
      persistence: this.initialized ? (process.env.PERSISTENCE_MODE === "postgres" ? "postgres" : "memory") : "starting",
      identity: this.identityProvider.verified === true ? "verified" : "local",
      objectStore: this.objectStore ? "configured" : "not_configured",
      evidenceScanner: this.evidenceScanner instanceof DevelopmentEvidenceScanner
        ? "development"
        : this.evidenceScanner ? "configured" : "not_configured",
      payment: this.paymentRail instanceof TempoPaymentRail ? "tempo" : "mock",
      attestation: this.attestationRail instanceof SolanaMemoAttestationRail ? "solana" : "mock",
    } as const;
    return {
      ok: this.initialized && (!production || (checks.identity === "verified" && checks.objectStore === "configured" && checks.evidenceScanner === "configured")),
      service: "nischit-api",
      checks,
    };
  }
}
