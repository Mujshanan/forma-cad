import { expect, test } from "@playwright/test";

test("reference image placement, scale, opacity, visibility and lock controls work", async ({ page }) => {
  await page.goto("/");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADElEQVQImWP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
  await page.locator("#reference-placement").selectOption("center");
  await page.locator("#reference-file-input").setInputFiles({
    name: "architectural-plan.png", mimeType: "image/png", buffer: png,
  });

  await expect(page.locator("#reference-content")).toContainText("architectural-plan.png");
  const image = page.locator("#reference-layer image");
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute("width", "10000");
  await expect(page.locator("#reference-anchor")).toHaveValue("center");

  await page.locator("#reference-width").fill("12000");
  await page.locator("#reference-width").dispatchEvent("change");
  await expect(image).toHaveAttribute("width", "12000");
  await expect(image).toHaveAttribute("height", "6000");

  await page.locator("#reference-opacity").fill("25");
  await page.locator("#reference-opacity").dispatchEvent("change");
  await expect(page.locator("#reference-layer g").first()).toHaveAttribute("opacity", "0.25");

  await page.locator("#reference-visible").uncheck();
  await expect(image).toHaveCount(0);
  await page.locator('[data-reference-toggle="REF1"]').click();
  await expect(image).toHaveCount(1);

  await page.locator("#reference-locked").check();
  await expect(page.locator("#reference-layer image")).toHaveAttribute("pointer-events", "none");
});
