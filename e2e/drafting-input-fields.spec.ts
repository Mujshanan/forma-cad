import { expect, test } from "@playwright/test";

test("Tab switches listening dimensions and commits exact length and angle", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });

  const dimension = page.locator(".dimension-label");
  await page.keyboard.type("450");
  await page.keyboard.press("Tab");
  await expect(dimension).toContainText("L 450 mm");
  await page.keyboard.type("30");
  await expect(dimension).toContainText("∠ 30°");
  await page.keyboard.press("Enter");

  const line = page.locator("#world-layer line.entity");
  await expect(line).toHaveCount(1);
  const dx = Number(await line.getAttribute("x2")) - Number(await line.getAttribute("x1"));
  const dy = -(Number(await line.getAttribute("y2")) - Number(await line.getAttribute("y1")));
  expect(Math.hypot(dx, dy)).toBeCloseTo(450, 5);
  expect(Math.atan2(dy, dx) * 180 / Math.PI).toBeCloseTo(30, 5);
  await expect(page.locator("#drafting-inputs")).toHaveCount(0);
});

test("Shift+Tab edits the length field without changing the angle", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });
  const dimension = page.locator(".dimension-label");

  await page.keyboard.type("450");
  await page.keyboard.press("Tab");
  await page.keyboard.type("30");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Backspace");
  await expect(dimension).toContainText("L 45 mm");
  await expect(dimension).toContainText("∠ 30°");
});
