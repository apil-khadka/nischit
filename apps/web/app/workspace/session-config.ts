import { isPreviewIdentityAllowed } from "../identity";
import type { RoleSession, WorkspaceRole } from "./shared";

export const roleDefaults: Record<WorkspaceRole, RoleSession> = {
  buyer: { role: "buyer", tenantId: "preview-buyer", userId: "preview-buyer-owner", name: "Procurement owner", tenantName: "Nischit Laboratory" },
  supplier: { role: "supplier", tenantId: "preview-supplier", userId: "preview-supplier-manager", name: "Supplier manager", tenantName: "Nischit Reagents" },
  receiving: { role: "receiving", tenantId: "preview-buyer", userId: "preview-receiver", name: "Receiving operator", tenantName: "Nischit Laboratory" },
  qa: { role: "qa", tenantId: "preview-buyer", userId: "preview-qa", name: "QA reviewer", tenantName: "Nischit Laboratory" },
  finance: { role: "finance", tenantId: "preview-buyer", userId: "preview-finance", name: "Finance operator", tenantName: "Nischit Laboratory" },
  auditor: { role: "auditor", tenantId: "preview-buyer", userId: "preview-buyer-owner", name: "Auditor", tenantName: "Nischit Laboratory" },
};

const configuredRole = process.env.NEXT_PUBLIC_NISCHIT_ROLE as WorkspaceRole | undefined;
const configuredSession = roleDefaults[configuredRole && configuredRole in roleDefaults ? configuredRole : "buyer"];

export const initialSession: RoleSession | null = isPreviewIdentityAllowed() ? {
  ...configuredSession,
  kind: "preview",
  tenantId: process.env.NEXT_PUBLIC_NISCHIT_TENANT_ID ?? configuredSession.tenantId,
  userId: process.env.NEXT_PUBLIC_NISCHIT_USER_ID ?? configuredSession.userId,
  name: process.env.NEXT_PUBLIC_NISCHIT_USER_NAME ?? configuredSession.name,
  tenantName: process.env.NEXT_PUBLIC_NISCHIT_TENANT_NAME ?? configuredSession.tenantName,
} : null;
