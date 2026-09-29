import { expect, test } from "@playwright/test";

test("public navigation reaches every product page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Know what arrived/ })).toBeVisible();
  const homeFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(homeFits, "the public home page should not scroll horizontally at a phone width").toBe(true);

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  for (const route of ["Product", "Workflow", "Security", "Pricing"]) {
    const link = navigation.getByRole("link", { name: route });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${route.toLowerCase()}$`));
    await expect(navigation.getByRole("link", { name: route })).toHaveAttribute("aria-current", "page");
  }
});

test("preview overview summarizes the buyer queue and opens its next record", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("note")).toContainText("Sample records and simulated actions");
  await expect(page.getByRole("heading", { level: 1, name: "Buyer work queue" })).toBeVisible();

  const queueSummary = page.getByRole("complementary", { name: "Queue overview" });
  await expect(queueSummary.getByRole("heading", { name: "Queue summary" })).toBeVisible();
  const statusCounts = queueSummary.getByRole("list", { name: "Decisions by status" });
  await expect(statusCounts.getByText("Funded", { exact: true })).toBeVisible();
  await expect(statusCounts.getByText("Acknowledged", { exact: true })).toBeVisible();

  await queueSummary.getByRole("button", { name: /Review High-Fidelity Taq Polymerase/ }).click();
  await expect(page.getByRole("heading", { name: "High-Fidelity Taq Polymerase 5U/µL" })).toBeVisible();

  await page.getByLabel("Switch preview role").selectOption("receiving");
  await expect(page.getByRole("heading", { level: 1, name: "Work that needs your attention" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Work records" }).getByRole("button", { name: /Review High-Fidelity Taq Polymerase/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Work records" }).getByText("Record the delivery", { exact: true })).toBeVisible();
});

test("mobile workspace navigation stays in view and opens its sections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const viewportFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(viewportFits, "the workspace should not scroll horizontally at a phone width").toBe(true);
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await expect(openNavigation).toBeInViewport();
  await openNavigation.click();

  const workspaceNavigation = page.getByRole("complementary", { name: "Workspace navigation" });
  await expect(workspaceNavigation.getByRole("button", { name: "Purchase orders" })).toBeVisible();
  await expect(workspaceNavigation.getByRole("link", { name: "Public site" })).toBeVisible();
  await workspaceNavigation.getByRole("button", { name: "Purchase orders" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Purchase orders" })).toBeVisible();
});
