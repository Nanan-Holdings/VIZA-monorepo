import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import {
  assertRecoveredDs160Application,
  rewindRecoveredDs160ApplicationToPersonalInformation1,
} from "../recovered-application";

const APPLICATION_ID = "AA00TEST1234";

async function openOfficialMockPage(
  page: import("@playwright/test").Page,
  laterPage: string,
  personalInfo1Page: string = laterPage,
): Promise<void> {
  await page.route("https://ceac.state.gov/**", async (route) => {
    const body = /complete_personal\.aspx(?:$|[?#])/i.test(route.request().url())
      ? personalInfo1Page
      : laterPage;
    await route.fulfill({ status: 200, contentType: "text/html", body });
  });
  await page.goto("https://ceac.state.gov/GenNIV/General/complete_personalcont.aspx");
}

test("waits through a transient unknown DOM before checking the recovered Application ID", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2 id="heading">Loading recovered application</h2>
      <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
      <script>
        setTimeout(() => {
          document.querySelector("#heading").textContent = "Personal Information 1";
        }, 80);
      </script>
    `);

    const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
      timeoutMs: 1_000,
      pollIntervalMs: 20,
    });

    assert.equal(pageId, "personal_information_1");
  } finally {
    await browser.close();
  }
});

test("waits for an Application ID rendered after the recovered heading", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2>Personal Information 2</h2>
      <span id="lblAppID"></span>
      <script>
        setTimeout(() => {
          document.querySelector("#lblAppID").textContent = "Application ID ${APPLICATION_ID}";
        }, 120);
      </script>
    `);

    const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
      timeoutMs: 1_000,
      pollIntervalMs: 20,
    });

    assert.equal(pageId, "personal_information_2");
  } finally {
    await browser.close();
  }
});

test("rejects a recovered page whose Application ID does not match the checkpoint", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2>Personal Information 1</h2>
      <span id="lblAppID">Application ID AA00OTHER1234</span>
    `);

    await assert.rejects(
      assertRecoveredDs160Application(page, APPLICATION_ID, {
        timeoutMs: 500,
        pollIntervalMs: 20,
      }),
      /different or missing CEAC Application ID/,
    );
  } finally {
    await browser.close();
  }
});

test("rejects a wrong Application ID immediately even if the DOM later changes", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2>Personal Information 2</h2>
      <span id="lblAppID">Application ID AA00OTHER1234</span>
      <script>
        setTimeout(() => {
          document.querySelector("#lblAppID").textContent = "Application ID ${APPLICATION_ID}";
        }, 250);
      </script>
    `);

    await assert.rejects(
      assertRecoveredDs160Application(page, APPLICATION_ID, {
        timeoutMs: 1_000,
        pollIntervalMs: 20,
      }),
      /different or missing CEAC Application ID/,
    );

    await page.waitForTimeout(350);
    assert.match((await page.locator("#lblAppID").textContent()) ?? "", new RegExp(APPLICATION_ID));
  } finally {
    await browser.close();
  }
});

test("never treats start, retrieve, or confirmation surfaces as recovered form pages", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const heading of ["Start an Application", "Retrieve an Application", "Confirmation"]) {
      await page.setContent(`
        <h2>${heading}</h2>
        <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
        <button>Print Confirmation</button>
        <button>Print Application</button>
        <button>Email Confirmation</button>
      `);

      await assert.rejects(
        assertRecoveredDs160Application(page, APPLICATION_ID, {
          timeoutMs: 120,
          pollIntervalMs: 20,
        }),
        /Timed out waiting for CEAC page/,
      );
    }
  } finally {
    await browser.close();
  }
});

test("does not navigate when a captured resume already lands on Personal Information 1", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const pageHtml = `
      <h2>Personal Information 1</h2>
      <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
    `;
    await openOfficialMockPage(page, pageHtml, pageHtml);
    const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    await rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
      currentPageId: pageId,
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    assert.match(page.url(), /complete_personalcont\.aspx$/i);
  } finally {
    await browser.close();
  }
});

test("rejects a Personal Information 1 no-op when its current Application ID is wrong", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const pageHtml = `
      <h2>Personal Information 1</h2>
      <span id="lblAppID">Application ID AA00OTHER1234</span>
    `;
    await openOfficialMockPage(page, pageHtml, pageHtml);
    await assert.rejects(
      rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
        currentPageId: "personal_information_1",
        timeoutMs: 500,
        pollIntervalMs: 20,
      }),
      /different or missing CEAC Application ID/,
    );
  } finally {
    await browser.close();
  }
});

test("rewinds a later captured resume through the visible same-origin sidebar link", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await openOfficialMockPage(
      page,
      `<h2>Personal Information 2</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
       <a href="/GenNIV/General/complete_personal.aspx">Personal Information 1</a>`,
      `<h2>Personal Information 1</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>`,
    );
    const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    await rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
      currentPageId: pageId,
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    assert.match(page.url(), /complete_personal\.aspx(?:\?|$)/i);
  } finally {
    await browser.close();
  }
});

test("waits for the current Application ID before rewinding a later page", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await openOfficialMockPage(
      page,
      `<h2>Personal Information 2</h2>
       <span id="lblAppID"></span>
       <a href="/GenNIV/General/complete_personal.aspx">Personal Information 1</a>
       <script>
         setTimeout(() => {
           document.querySelector("#lblAppID").textContent = "Application ID ${APPLICATION_ID}";
         }, 120);
       </script>`,
      `<h2>Personal Information 1</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>`,
    );

    await rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
      currentPageId: "personal_information_2",
      timeoutMs: 1_000,
      pollIntervalMs: 20,
    });

    assert.match(page.url(), /complete_personal\.aspx(?:\?|$)/i);
  } finally {
    await browser.close();
  }
});

test("waits for the refreshed Application ID after rewinding", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await openOfficialMockPage(
      page,
      `<h2>Personal Information 2</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
       <a href="/GenNIV/General/complete_personal.aspx">Personal Information 1</a>`,
      `<h2>Personal Information 1</h2>
       <span id="lblAppID"></span>
       <script>
         setTimeout(() => {
           document.querySelector("#lblAppID").textContent = "Application ID ${APPLICATION_ID}";
         }, 120);
       </script>`,
    );

    await rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
      currentPageId: "personal_information_2",
      timeoutMs: 1_000,
      pollIntervalMs: 20,
    });

    assert.match(page.url(), /complete_personal\.aspx(?:\?|$)/i);
  } finally {
    await browser.close();
  }
});

test("rewinds Personal Information 2 through the observed Back: Personal 1 control", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await openOfficialMockPage(
      page,
      `<h2>Personal Information 2</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
       <form method="get" action="/GenNIV/General/complete_personal.aspx">
         <input type="submit" value="Back: Personal 1" />
       </form>`,
      `<h2>Personal Information 1</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>`,
    );
    const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    await rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
      currentPageId: pageId,
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    assert.match(page.url(), /complete_personal\.aspx(?:\?|$)/i);
  } finally {
    await browser.close();
  }
});

test("rejects a rewind when the refreshed Personal Information 1 page has a different Application ID", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await openOfficialMockPage(
      page,
      `<h2>Personal Information 2</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
       <a href="/GenNIV/General/complete_personal.aspx">Personal Information 1</a>`,
      `<h2>Personal Information 1</h2>
       <span id="lblAppID">Application ID AA00OTHER1234</span>`,
    );
    const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    await assert.rejects(
      rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
        currentPageId: pageId,
        timeoutMs: 500,
        pollIntervalMs: 20,
      }),
      /different or missing CEAC Application ID/,
    );
  } finally {
    await browser.close();
  }
});

test("rejects foreign and missing Personal Information 1 sidebar links", async () => {
  for (const link of [
    `<a href="https://example.com/GenNIV/General/complete_personal.aspx">Personal Information 1</a>`,
    "",
  ]) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await openOfficialMockPage(
        page,
        `<h2>Personal Information 2</h2>
         <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
         ${link}`,
      );
      const pageId = await assertRecoveredDs160Application(page, APPLICATION_ID, {
        timeoutMs: 500,
        pollIntervalMs: 20,
      });
      await assert.rejects(
        rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
          currentPageId: pageId,
          timeoutMs: 500,
          pollIntervalMs: 20,
        }),
        /(?:not same-origin|no visible Personal Information 1 sidebar link)/,
      );
    } finally {
      await browser.close();
    }
  }
});

test("rewinds an unsubmitted Sign and Submit landing through its observed Personal Information 1 link", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await openOfficialMockPage(
      page,
      `<h2>Sign and Submit</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>
       <a href="/GenNIV/General/complete_personal.aspx">Personal Information 1</a>`,
      `<h2>Personal Information 1</h2>
       <span id="lblAppID">Application ID ${APPLICATION_ID}</span>`,
    );
    await rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
      currentPageId: "sign_and_submit",
      timeoutMs: 500,
      pollIntervalMs: 20,
    });
    assert.match(page.url(), /complete_personal\.aspx(?:\?|$)/i);
  } finally {
    await browser.close();
  }
});

test("rejects unsafe confirmation and unknown recovered surfaces", async () => {
  const surfaces = [
    "<h2>Confirmation</h2><span id=\"lblAppID\">Application ID ${APPLICATION_ID}</span>",
    "<h2>Unexpected Surface</h2><span id=\"lblAppID\">Application ID ${APPLICATION_ID}</span>",
  ];
  for (const surface of surfaces) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setContent(surface);
      await assert.rejects(
        rewindRecoveredDs160ApplicationToPersonalInformation1(page, APPLICATION_ID, {
          timeoutMs: 120,
          pollIntervalMs: 20,
        }),
        /unsafe CEAC page/,
      );
    } finally {
      await browser.close();
    }
  }
});
