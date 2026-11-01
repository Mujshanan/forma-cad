import { expect, test } from "@playwright/test";

test("line drafting is orthogonal by default and F8 toggles it off", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });
  const line = page.locator(".preview-geometry");
  const read = () => line.evaluate(el => {
    const node = el as SVGLineElement;
    return { x1: Number(node.getAttribute("x1")), y1: Number(node.getAttribute("y1")), x2: Number(node.getAttribute("x2")), y2: Number(node.getAttribute("y2")) };
  });
  const orthogonal = await read();
  expect(orthogonal.x2 - orthogonal.x1).toBeCloseTo(1000, 3);
  expect(orthogonal.y2 - orthogonal.y1).toBeCloseTo(0, 3);
  await page.keyboard.press("F8");
  await canvas.hover({ position: { x: 270, y: 240 } });
  const free = await read();
  expect(Math.abs(free.x2 - free.x1) > 0.01 && Math.abs(free.y2 - free.y1) > 0.01).toBeTruthy();
  await expect(page.locator("#ortho-readout")).toContainText("ORTHO: OFF");
});

test("temporary dimension HUD no longer covers the drafting canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#drafting-inputs")).toHaveCount(0);
});

test("Auto Fit adjusts the view after committing a new object", async ({ page }) => {
  await page.goto("/");
  await page.locator("#toggle-auto-fit").click();
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.click({ position: { x: 260, y: 180 } });
  await expect(page.locator("#entity-count")).toContainText("1 object");
  const zoom = Number((await page.locator("#zoom-readout").textContent())?.replace("%", ""));
  expect(zoom).toBeGreaterThan(8);
});
