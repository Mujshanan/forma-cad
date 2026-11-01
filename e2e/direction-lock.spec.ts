import { expect, test } from "@playwright/test";

test("Shift locks the active segment direction until Shift is released", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });

  await page.keyboard.down("Shift");
  await canvas.hover({ position: { x: 260, y: 300 } });

  const preview = page.locator(".preview-geometry");
  await expect(preview).toBeVisible();
  const locked = await preview.evaluate((element) => {
    const line = element as SVGLineElement;
    return {
      dx: Number(line.getAttribute("x2")) - Number(line.getAttribute("x1")),
      dy: -(Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"))),
    };
  });
  expect(locked.dx).toBeGreaterThan(0);
  expect(locked.dy / locked.dx).toBeCloseTo(-0.5, 2);

  await page.keyboard.up("Shift");
  await canvas.hover({ position: { x: 260, y: 300 } });
  const released = await preview.evaluate((element) => {
    const line = element as SVGLineElement;
    return {
      dx: Number(line.getAttribute("x2")) - Number(line.getAttribute("x1")),
      dy: -(Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"))),
    };
  });
  expect(released.dy / released.dx).toBeLessThan(-1.0);
});

test("Shift direction locking remains active when object snapping is disabled", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  await page.locator("#toggle-snap").click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });

  await page.keyboard.down("Shift");
  await canvas.hover({ position: { x: 260, y: 300 } });

  const preview = page.locator(".preview-geometry");
  await expect(preview).toBeVisible();
  const slope = await preview.evaluate((element) => {
    const line = element as SVGLineElement;
    const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
    const dy = -(Number(line.getAttribute("y2")) - Number(line.getAttribute("y1")));
    return dy / dx;
  });
  expect(slope).toBeCloseTo(-0.5, 2);
  await page.keyboard.up("Shift");
});
