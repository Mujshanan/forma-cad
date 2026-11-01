import { expect, test } from "@playwright/test";

async function canvasPoint(page: import("@playwright/test").Page, x: number, y: number) {
  const box = await page.locator("#drawing-canvas").boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  return { x: box.x + x, y: box.y + y };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("line tool previews, commits, and keeps its dimension label", async ({ page }) => {
  await page.getByRole("button", { name: /Line/ }).click();
  const a = await canvasPoint(page, 180, 160);
  const b = await canvasPoint(page, 430, 260);
  await page.mouse.click(a.x, a.y);
  await page.mouse.move(b.x, b.y);
  await expect(page.locator(".listening-dimension")).toContainText("L ");
  await page.mouse.click(b.x, b.y);

  await expect(page.locator("#world-layer line.entity")).toHaveCount(1);
  await expect(page.locator("#world-layer .persistent-dimension")).toContainText("L ");
  await expect(page.locator("#entity-count")).toHaveText("1 object");
});

test("the first clicked point stays fixed while endpoint snapping is enabled", async ({ page }) => {
  await page.getByRole("button", { name: /Line/ }).click();
  const a = await canvasPoint(page, 180, 160);
  const b = await canvasPoint(page, 430, 260);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  const line = page.locator("#world-layer line.entity").first();
  const startX = await line.getAttribute("x1");
  const startY = await line.getAttribute("y1");

  const c = await canvasPoint(page, 230, 190);
  const d = await canvasPoint(page, 435, 264);
  await page.mouse.click(c.x, c.y);
  await page.mouse.move(d.x, d.y);
  await expect(page.locator(".listening-dimension")).toBeVisible();
  await expect(line).toHaveAttribute("x1", startX!);
  await expect(line).toHaveAttribute("y1", startY!);
});

test("select and delete operate on a committed line", async ({ page }) => {
  await page.getByRole("button", { name: /Line/ }).click();
  const a = await canvasPoint(page, 180, 160);
  const b = await canvasPoint(page, 430, 260);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);

  await page.getByRole("button", { name: /Select/ }).click();
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  await page.mouse.click(middle.x, middle.y);
  await expect(page.locator("#world-layer line.entity.selected")).toHaveCount(1);
  await page.locator("#delete-selection").click();
  await expect(page.locator("#world-layer line.entity")).toHaveCount(0);
  await expect(page.locator("#entity-count")).toHaveText("0 objects");
});

test("grid is off initially and can be toggled", async ({ page }) => {
  await expect(page.locator(".canvas-background")).toHaveCSS("opacity", "0");
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.locator(".canvas-background")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.locator(".canvas-background")).toHaveCSS("opacity", "0");
});

test("Escape cancels a line preview without creating geometry", async ({ page }) => {
  await page.getByRole("button", { name: /Line/ }).click();
  const a = await canvasPoint(page, 180, 160);
  await page.mouse.click(a.x, a.y);
  await expect(page.locator(".canvas-hint")).toContainText("Click to finish");
  await page.keyboard.press("Escape");
  await expect(page.locator(".listening-dimension")).toHaveCount(0);
  await expect(page.locator("#world-layer line.entity")).toHaveCount(0);
});
