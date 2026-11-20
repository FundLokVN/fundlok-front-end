import { test, expect, type Page } from "@playwright/test";

import { t } from "../support/i18n";

/**
 * The business (borrower) tab of /rate: a five-question quiz that shows an
 * ILLUSTRATIVE rate, computed in the browser by lib/rate-quiz.ts, with name
 * and phone on the same screen as the result. The lead is stored only when
 * the visitor sends it, with consent (Decree 13/2023).
 *
 * Spec: backend repo docs/specs/rates/sme-rate-quiz.md.
 */

const panel = (page: Page) => page.locator("#rate-panel-sme");
const choose = (page: Page, name: string) =>
  panel(page).getByRole("button", { name, exact: true }).click();
const heading = (page: Page, key: string) =>
  panel(page).getByRole("heading", { name: t(key) });

/** Q1–Q4 by tapping; Q5 by tapping a revenue chip, which moves on. */
async function answer(
  page: Page,
  {
    amount = "50 tr",
    term = "6 tháng",
    band = t("ratePage.quiz.bandY1_3"),
    industry = t("projectApplication.industries.retailTrade"),
    revenue = "100 tr",
  } = {},
) {
  await expect(heading(page, "ratePage.quiz.q1")).toBeVisible();
  await choose(page, amount);
  await expect(heading(page, "ratePage.quiz.q2")).toBeVisible();
  await choose(page, term);
  await expect(heading(page, "ratePage.quiz.q3")).toBeVisible();
  await choose(page, band);
  await expect(heading(page, "ratePage.quiz.q4")).toBeVisible();
  await choose(page, industry);
  await expect(heading(page, "ratePage.quiz.q5")).toBeVisible();
  await choose(page, revenue);
}

const send = (page: Page) =>
  panel(page).getByRole("button", { name: t("ratePage.quiz.send") });

test("opens on the first of five questions, with no contact fields", async ({
  page,
}) => {
  await page.goto("/rate?for=sme");
  await expect(heading(page, "ratePage.quiz.q1")).toBeVisible();
  await expect(
    panel(page).getByText(t("ratePage.quiz.progress", { n: 1, total: 5 })),
  ).toBeVisible();
  await expect(panel(page).getByLabel(t("ratePage.phone"))).toHaveCount(0);
});

test("shows the illustrative rate with name and phone on the same screen", async ({
  page,
}) => {
  await page.goto("/rate?for=sme");
  await answer(page);

  // 14.5% + retail 0.5% − 0.5% (burden 8.3%) = 14.50%/năm = 1,21%/tháng.
  await expect(panel(page).getByText("1,21%")).toBeVisible();
  await expect(panel(page).getByText(/14,50%/)).toBeVisible();
  await expect(
    panel(page).getByText(t("ratePage.quiz.disclaimer")),
  ).toBeVisible();
  await expect(panel(page).getByLabel(t("ratePage.fullName"))).toBeVisible();
  await expect(panel(page).getByLabel(t("ratePage.phone"))).toBeVisible();
  await expect(send(page)).toBeVisible();
});

test("back returns to the previous question", async ({ page }) => {
  await page.goto("/rate?for=sme");
  await choose(page, "50 tr");
  await expect(heading(page, "ratePage.quiz.q2")).toBeVisible();
  await panel(page)
    .getByRole("button", { name: t("ratePage.quiz.back") })
    .click();
  await expect(heading(page, "ratePage.quiz.q1")).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "50 tr", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a reload resumes on the result", async ({ page }) => {
  await page.goto("/rate?for=sme");
  await answer(page);
  await expect(panel(page).getByText("1,21%")).toBeVisible();
  await page.reload();
  await expect(panel(page).getByText("1,21%")).toBeVisible();
});

test("will not send without a name, a valid phone and consent", async ({
  page,
}) => {
  await page.goto("/rate?for=sme");
  await answer(page);

  let sent = false;
  page.on("request", (r) => {
    if (r.url().includes("/rates/sme/quiz-leads")) sent = true;
  });

  await send(page).click();
  await expect(
    panel(page).getByText(t("ratePage.error.fullName")),
  ).toBeVisible();
  await expect(panel(page).getByText(t("ratePage.error.phone"))).toBeVisible();
  await expect(
    panel(page).getByText(t("ratePage.error.consent")),
  ).toBeVisible();

  await panel(page).getByLabel(t("ratePage.fullName")).fill("Nguyễn Văn Chủ");
  await panel(page).getByLabel(t("ratePage.phone")).fill("1234");
  await panel(page).getByText(t("ratePage.consent")).click();
  await send(page).click();
  await expect(panel(page).getByText(t("ratePage.error.phone"))).toBeVisible();
  expect(sent).toBe(false);
});

test("sends the answers, the rate shown and the ad tracking", async ({
  page,
}) => {
  await page.goto(
    "/rate?for=sme&utm_source=facebook&utm_medium=paid&utm_campaign=sme-test&fbclid=IwE2E",
  );
  await answer(page);
  await panel(page).getByLabel(t("ratePage.fullName")).fill("Nguyễn Văn Chủ");
  await panel(page).getByLabel(t("ratePage.phone")).fill("0901 234 567");
  await panel(page).getByText(t("ratePage.consent")).click();

  const request = page.waitForRequest(
    (r) => r.url().includes("/rates/sme/quiz-leads") && r.method() === "POST",
  );
  await send(page).click();
  const body = (await request).postDataJSON();
  expect(body).toMatchObject({
    requested_amount: 50_000_000,
    tenor_months: 6,
    operating_band: "Y1_3",
    industry: "Retail Trade",
    monthly_revenue: 100_000_000,
    quiz_params_version: "sme-quiz-v1",
    outcome: "QUOTED",
    monthly_rate_pct: 1.21,
    full_name: "Nguyễn Văn Chủ",
    phone: "0901 234 567",
    consent_contact: true,
    tracking: {
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "sme-test",
      fbclid: "IwE2E",
    },
  });

  await expect(
    panel(page).getByText(t("ratePage.quiz.sentTitle")),
  ).toBeVisible();
  await expect(panel(page).getByLabel(t("ratePage.phone"))).toHaveCount(0);
});

test("a declined result suggests a smaller amount or a longer term", async ({
  page,
}) => {
  await page.goto("/rate?for=sme");
  // 100 tr over 2 months on 100 tr a month: burden 50%, over 30%.
  await answer(page, { amount: "100 tr", term: "2 tháng" });
  await expect(
    panel(page).getByText(t("ratePage.quiz.declinedTitle")),
  ).toBeVisible();
  // Still asks for a phone number.
  await expect(panel(page).getByLabel(t("ratePage.phone"))).toBeVisible();

  // The shortest term that passes is 4 months (burden 25%):
  // 14.5 + retail 0.5 + 0.5 = 15.50%/năm = 1,29%/tháng.
  await panel(page)
    .getByRole("button", {
      name: t("ratePage.quiz.tryTerm", {
        term: t("ratePage.quiz.monthsMany", { n: 4 }),
      }),
    })
    .click();
  await expect(panel(page).getByText("1,29%")).toBeVisible();
});
