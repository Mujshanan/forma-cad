import { expect, test, type Page } from "@playwright/test";

async function startLinePreview(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });
}

test("typed length updates the canvas preview and Enter commits exact geometry", async ({ page }) => {
  await startLinePreview(page);
  await page.keyboard.type("450");

  await expect(page.locator(".dimension-label")).toContainText("450 mm");
  await page.keyboard.press("Enter");

  const line = page.locator("#world-layer line.entity");
  await expect(line).toHaveCount(1);
  const startX = Number(await line.getAttribute("x1"));
  const endX = Number(await line.getAttribute("x2"));
  const startY = Number(await line.getAttribute("y1"));
  const endY = Number(await line.getAttribute("y2"));
  expect(Math.hypot(endX - startX, endY - startY)).toBeCloseTo(450, 5);
  await expect(page.locator(".dimension-label")).toHaveCount(0);
});

test("typed angle immediately constrains the preview and commits at that angle", async ({ page }) => {
  await startLinePreview(page);
  await page.keyboard.type("30deg");

  await expect(page.locator(".dimension-label")).toContainText("30°");
  await page.keyboard.press("Enter");

  const line = page.locator("#world-layer line.entity");
  await expect(line).toHaveCount(1);
  const dx = Number(await line.getAttribute("x2")) - Number(await line.getAttribute("x1"));
  const dy = -(Number(await line.getAttribute("y2")) - Number(await line.getAttribute("y1")));
  expect(Math.atan2(dy, dx) * 180 / Math.PI).toBeCloseTo(30, 5);
});

test("Escape cancels the in-progress preview without creating geometry", async ({ page }) => {
  await startLinePreview(page);
  await page.keyboard.type("450");
  await expect(page.locator(".dimension-label")).toContainText("450 mm");

  await page.keyboard.press("Escape");

  await expect(page.locator("#world-layer .entity")).toHaveCount(0);
  await expect(page.locator(".preview-geometry")).toHaveCount(0);
  await expect(page.locator(".dimension-label")).toHaveCount(0);
});
