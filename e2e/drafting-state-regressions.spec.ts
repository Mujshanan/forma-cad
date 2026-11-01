import { expect, test } from "@playwright/test";

test("pressing Shift refreshes the preview immediately without pointer movement", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");
  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.hover({ position: { x: 260, y: 220 } });

  const preview = page.locator(".preview-geometry");
  const readSlope = () => preview.evaluate(element => {
    const line = element as SVGLineElement;
    const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
    const dy = -(Number(line.getAttribute("y2")) - Number(line.getAttribute("y1")));
    return dy / dx;
  });
  const before = await readSlope();
  await page.keyboard.down("Shift");
  const after = await readSlope();

  expect(before).not.toBeCloseTo(-0.5, 2);
  expect(after).toBeCloseTo(-0.5, 2);
  await page.keyboard.up("Shift");
});

test("F3 immediately removes a stale snap from the drafting preview", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");

  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.click({ position: { x: 280, y: 180 } });
  await canvas.click({ position: { x: 280, y: 280 } });
  await canvas.hover({ position: { x: 284, y: 180 } });

  const snapPoint = page.locator(".snap-point");
  const before = Number(await snapPoint.getAttribute("cx"));
  await page.keyboard.press("F3");
  const after = Number(await snapPoint.getAttribute("cx"));

  expect(after).toBeGreaterThan(before);
  await expect(page.locator("#snap-readout")).toContainText("SNAP: OFF");
});
