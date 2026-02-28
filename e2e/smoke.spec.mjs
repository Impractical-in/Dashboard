import { expect, test } from "@playwright/test";

const pages = [
  "/index.html",
  "/todo.html",
  "/projects.html",
  "/calendar.html",
  "/hobbies.html",
  "/journal.html",
  "/links.html",
  "/pomodoro.html",
  "/sync.html",
  "/resume.html",
];

test("home header keeps time and theme controls visible", async ({ page }) => {
  await page.goto("/index.html");

  const timeToggle = page.locator("#timeToggle");
  const localDateTime = page.locator("#localDateTime");
  const themeToggle = page.locator("#themeToggle");
  const headerVersion = page.locator("#headerVersion");

  await expect(timeToggle).toBeVisible();
  await expect(themeToggle).toBeVisible();
  await expect(localDateTime).toHaveText(/.+/);
  await expect(headerVersion).toHaveText(/^v\d+\.\d+\.\d+$/);
});

test("theme toggle changes visual mode", async ({ page }) => {
  await page.goto("/index.html");
  const themeToggle = page.locator("#themeToggle");

  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator("body")).toHaveClass(/theme-light/);
  await expect(themeToggle).toHaveText(/Theme:\s*Light/);

  await themeToggle.click();
  await expect(page.locator("body")).not.toHaveClass(/theme-light/);
  await expect(themeToggle).toHaveText(/Theme:\s*Dark/);
});

for (const route of pages) {
  test(`header controls are visible on ${route}`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator(".dashboard-home")).toBeVisible();
    await expect(page.locator("#headerVersion")).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(page.locator("#themeToggle")).toBeVisible();
  });
}
