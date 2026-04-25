import { config } from "dotenv";
import * as path from "node:path";
config({ path: path.join(__dirname, "../../.env") });

async function main() {
  const { startCeacSession } = await import("./session");
  for (let i = 1; i <= 2; i++) {
    const t0 = Date.now();
    try {
      const s = await startCeacSession({ headless: true, runId: `run-${i}` });
      const ms = Date.now() - t0;
      console.log(`run ${i}: SUCCESS in ${ms}ms | url=${s.page.url()} | captcha attempts=${s.captchaSolve?.telemetry.length ?? 0}`);
      await s.close();
    } catch (err) {
      const ms = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`run ${i}: FAILED in ${ms}ms | ${msg.slice(0, 200)}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
