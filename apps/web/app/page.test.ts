import { describe, expect, it } from "vitest";
import LandingPage from "./page";
import ProductPage from "./product/page";
import WorkflowPage from "./workflow/page";
import SecurityPage from "./security/page";
import PricingPage from "./pricing/page";
import SignInPage from "./sign-in/page";
import Workspace from "./workspace";
import { isPreviewIdentityAllowed } from "./identity";

describe("Nischit public and workspace entry points", () => {
  it("exports renderable public pages and workspace entry point", () => {
    expect(LandingPage).toBeTypeOf("function");
    expect(ProductPage).toBeTypeOf("function");
    expect(WorkflowPage).toBeTypeOf("function");
    expect(SecurityPage).toBeTypeOf("function");
    expect(PricingPage).toBeTypeOf("function");
    expect(SignInPage).toBeTypeOf("function");
    expect(Workspace).toBeTypeOf("function");
  });

  it("does not allow a preview identity in production", () => {
    expect(isPreviewIdentityAllowed("production")).toBe(false);
    expect(isPreviewIdentityAllowed("test")).toBe(true);
  });
});
