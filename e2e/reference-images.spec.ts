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

  const imageBox = await image.boundingBox();
  if (!imageBox) throw new Error("Reference image is not visible");
  const initialPosition = await page.locator("#reference-layer g").first().getAttribute("transform");
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(imageBox.x + imageBox.width / 2 + 80, imageBox.y + imageBox.height / 2 + 40);
  await page.mouse.up();
  await expect(page.locator("#reference-layer g").first()).not.toHaveAttribute("transform", initialPosition!);

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

test("saved project JSON preserves reference image placement and display settings", async ({ page }) => {
  await page.goto("/");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n7sAAAAASUVORK5CYII=", "base64");
  await page.locator("#reference-file-input").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png });
  await page.locator("#reference-x").fill("1250");
  await page.locator("#reference-x").dispatchEvent("change");
  await page.locator("#reference-width").fill("8400");
  await page.locator("#reference-width").dispatchEvent("change");
  await page.locator("#reference-opacity").fill("35");
  await page.locator("#reference-opacity").dispatchEvent("change");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#save-project").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Project download was not created");
  await page.locator("#file-input").setInputFiles(path);
  await expect(page.locator("#reference-x")).toHaveValue("1250");
  await expect(page.locator("#reference-width")).toHaveValue("8400");
  await expect(page.locator("#reference-opacity")).toHaveValue("35");
});


test("two-point calibration scales the image and survives undo, redo and save/load", async ({ page }) => {
  await page.goto("/");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADElEQVQImWP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
  await page.locator("#reference-file-input").setInputFiles({
    name: "calibration-plan.png", mimeType: "image/png", buffer: png,
  });
  await page.locator("#calibrate-reference").click();

  const image = page.locator("#reference-layer image");
  const bounds = await image.boundingBox();
  if (!bounds) throw new Error("Reference image is not visible");
  const pickY = bounds.y + bounds.height * 0.5;
  await page.mouse.click(bounds.x + bounds.width * 0.1, pickY);
  await page.mouse.click(bounds.x + bounds.width * 0.9, pickY);

  await expect(page.locator("#calibration-distance")).toBeVisible();
  await expect(page.locator(".calibration-editor")).toContainText("Measured distance on current image scale");
  await page.locator("#calibration-distance").fill("6000");
  await page.locator("#apply-calibration").click();

   expect(Number(await page.locator("#reference-width").inputValue())).toBeCloseTo(7500, 0);
  await expect(page.locator(".calibration-saved")).toContainText("6000");

  await page.locator("#undo-action").click();
  await expect(page.locator("#reference-width")).toHaveValue("10000");
  await page.locator("#redo-action").click();
  expect(Number(await page.locator("#reference-width").inputValue())).toBeCloseTo(7500, 0);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#save-project").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Project download was not created");
  await page.locator("#file-input").setInputFiles(path);
  expect(Number(await page.locator("#reference-width").inputValue())).toBeCloseTo(7500, 0);
  await expect(page.locator(".calibration-saved")).toContainText("6000");
});
