import { expect, test } from "@playwright/test";

test("alignment references persist briefly after moving away from the source endpoint", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tool="line"]').click();
  const canvas = page.locator("#drawing-canvas");

  await canvas.click({ position: { x: 180, y: 180 } });
  await canvas.click({ position: { x: 280, y: 180 } });
  await expect(page.locator("#world-layer line.entity")).toHaveCount(1);

  await canvas.click({ position: { x: 180, y: 300 } });
  await canvas.hover({ position: { x: 280, y: 180 } });
  await canvas.hover({ position: { x: 280, y: 210 } });

  await expect.poll(() => page.locator(".snap-guide").evaluateAll(lines =>
    lines.some(element => {
      const line = element as SVGLineElement;
      return line.getAttribute("x1") === line.getAttribute("x2");
    }),
  )).toBe(true);
});
