import "dotenv/config";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { redactOfficialUrl } from "../src/appointment-free-smoke";
import {
  classifyFranceVisasBrowserState,
  launchFvBrowser,
} from "../src/france-visas/browser";
import { detectPage } from "../src/france-visas/pages";
import {
  FV_LOGIN_SELECTORS,
  FV_REGISTRATION_SELECTORS,
} from "../src/france-visas/selectors";

const ENTRY_URL = "https://application-form.france-visas.gouv.fr/fv-fo-dde/";

async function screenshotPath(): Promise<string> {
  const configuredRoot = process.env.SUBMISSION_ARTIFACTS_DIR?.trim();
  const root = configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(os.tmpdir(), "viza-submission-artifacts");
  const directory = path.join(root, "france-visas-recon");
  await fs.mkdir(directory, { recursive: true });
  return path.join(directory, `${Date.now()}-login-registration.png`);
}

async function visibleCount(page: import("@playwright/test").Page, selector: string): Promise<number> {
  return page.locator(selector).evaluateAll((elements) => elements.filter((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }).length).catch(() => 0);
}

async function main(): Promise<void> {
  const session = await launchFvBrowser({ headless: true });
  try {
    await session.page.goto(ENTRY_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await session.page.waitForTimeout(3_000);

    const loginState = classifyFranceVisasBrowserState({
      url: session.page.url(),
      title: await session.page.title().catch(() => ""),
      bodyText: await session.page.locator("body").innerText({ timeout: 10_000 }).catch(() => ""),
    });
    const loginPage = await detectPage(session.page);
    const loginUrl = redactOfficialUrl(session.page.url());
    const loginSelectors = {
      email: await visibleCount(session.page, FV_LOGIN_SELECTORS.email),
      password: await visibleCount(session.page, FV_LOGIN_SELECTORS.password),
      submit: await visibleCount(session.page, FV_LOGIN_SELECTORS.submit),
    };

    const registrationLink = session.page
      .getByRole("link", { name: /create\s+(?:an\s+)?account|register|cr[ée]er\s+un\s+compte/i })
      .or(session.page.getByRole("button", { name: /create\s+(?:an\s+)?account|register|cr[ée]er\s+un\s+compte/i }))
      .first();
    const registrationOpened = await registrationLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (registrationOpened) {
      await registrationLink.click({ timeout: 10_000 });
      await session.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await session.page.waitForTimeout(2_000);
    }

    const registrationPage = await detectPage(session.page);
    const registrationSelectors = Object.fromEntries(await Promise.all(
      Object.entries(FV_REGISTRATION_SELECTORS).map(async ([key, selector]) => [
        key,
        await session.page.locator(selector).count().catch(() => 0),
      ]),
    ));
    const screenshot = await screenshotPath();
    await session.page.screenshot({ path: screenshot, fullPage: true, timeout: 20_000 });

    const loginReady = loginPage.id === "login"
      && loginSelectors.email > 0
      && loginSelectors.password > 0
      && loginSelectors.submit > 0;
    const registrationReady = registrationOpened
      && registrationPage.id === "registration"
      && Object.keys(FV_REGISTRATION_SELECTORS)
        .every((key) => Number(registrationSelectors[key] ?? 0) > 0);

    console.log(JSON.stringify({
      status: loginReady && registrationReady ? "login_and_registration_verified" : "recon_incomplete",
      provider: session.provider ?? "unknown",
      source: session.source ?? "unknown",
      login: {
        checkpoint: loginState.checkpoint,
        page: loginPage.id,
        url: loginUrl,
        selectors: loginSelectors,
      },
      registration: {
        opened: registrationOpened,
        page: registrationPage.id,
        selectors: registrationSelectors,
      },
      finalUrl: redactOfficialUrl(session.page.url()),
      screenshot,
      stopPoint: "No credentials or applicant data were entered, and no form was submitted.",
    }, null, 2));

    if (!loginReady || !registrationReady) process.exitCode = 2;
  } finally {
    await session.context.close().catch(() => undefined);
    await session.browser.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    status: "france_visas_recon_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }));
  process.exit(1);
});
