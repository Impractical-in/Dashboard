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

test("overview calendar patch shows required text and exactly 8 slots", async ({ page }) => {
  await page.goto("/index.html");

  await expect(page.locator(".calendar-dash-meta")).toHaveText(
    "Top 8 tasks sorted by priority and due date."
  );
  await expect(page.locator(".calendar-dash-help")).toHaveText(
    "P1 is highest. Empty slots keep alignment stable."
  );
  await expect(page.locator(".calendar-dash-link")).toHaveCount(2);
  await expect(page.locator(".calendar-patch-grid .calendar-patch-card")).toHaveCount(8);
});

test("overview calendar patch sorts tasks by priority and due date", async ({ page }) => {
  await page.addInitScript(() => {
    const tasks = [
      { id: "t1", title: "P2 later", priority: "P2", due: "2026-03-05T10:00", done: false },
      { id: "t2", title: "P1 no due", priority: "P1", done: false },
      { id: "t3", title: "P1 early", priority: "P1", due: "2026-03-01T09:00", done: false },
      { id: "t4", title: "P1 earliest", priority: "P1", due: "2026-02-28T09:00", done: false },
      { id: "t5", title: "P3 item", priority: "P3", due: "2026-02-20T09:00", done: false },
    ];
    localStorage.setItem("todoTasks", JSON.stringify(tasks));
  });

  await page.goto("/index.html");

  const titles = page.locator(
    ".calendar-patch-grid .calendar-patch-card:not(.calendar-patch-empty) .calendar-patch-title"
  );
  await expect(titles).toHaveCount(5);
  await expect(titles.nth(0)).toHaveText("P1 earliest");
  await expect(titles.nth(1)).toHaveText("P1 early");
  await expect(titles.nth(2)).toHaveText("P1 no due");
  await expect(titles.nth(3)).toHaveText("P2 later");
  await expect(titles.nth(4)).toHaveText("P3 item");
});

test("todo page exposes 10 preset neon/pastel colors and applies selection", async ({ page }) => {
  await page.goto("/todo.html");
  await page.locator("#taskFormToggle").click();

  const swatches = page.locator("#taskColorPalette .color-swatch");
  await expect(swatches).toHaveCount(10);

  await swatches.nth(2).click();
  await expect(page.locator("#taskColor")).toHaveValue("#06d6a0");
});

for (const route of pages) {
  test(`header controls are visible on ${route}`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator(".dashboard-home")).toBeVisible();
    await expect(page.locator("#headerVersion")).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(page.locator("#themeToggle")).toBeVisible();
  });
}
