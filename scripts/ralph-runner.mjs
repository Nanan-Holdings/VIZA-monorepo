import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = __dirname;
const LOG = path.join(REPO, "ralph.log");
const PROMPT_FILE = path.join(REPO, ".ralph-prompt.md");
const PRD_FILE = path.join(REPO, "prd.json");

const GATEWAY_URL = "http://127.0.0.1:18789";
const GATEWAY_TOKEN = "btppbdfZO2AgMXB1SZtMj5ASHiRhnyFum1Hu9KWBv0o4qZSTRmjhnbjiCeHccis2";
const TELEGRAM_CHAT = "-1003767157934";
const TELEGRAM_TOPIC = "6874";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG, line);
  process.stdout.write(line);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function notify(msg) {
  try {
    const payload = JSON.stringify({
      tool: "message",
      args: {
        action: "send",
        channel: "telegram",
        target: TELEGRAM_CHAT,
        threadId: TELEGRAM_TOPIC,
        message: msg
      },
      sessionKey: "main"
    });
    spawnSync("node", ["-e", `
      const http = require('http');
      const data = ${JSON.stringify(payload)};
      const req = http.request({
        host: '127.0.0.1', port: 18789, path: '/tools/invoke',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${GATEWAY_TOKEN}', 'Content-Length': Buffer.byteLength(data) }
      }, r => r.resume());
      req.write(data); req.end();
    `], { timeout: 5000 });
  } catch(e) { log("notify failed: " + e.message); }
}

function getPendingStories() {
  const prd = JSON.parse(fs.readFileSync(PRD_FILE, "utf8"));
  return prd.userStories.filter(s => !s.passes);
}

function getDoneCount() {
  const prd = JSON.parse(fs.readFileSync(PRD_FILE, "utf8"));
  return prd.userStories.filter(s => s.passes).length;
}

log("=== Ralph loop resumed ===");
const MAX = 20;
let i = 0;

while (i < MAX) {
  const pending = getPendingStories();
  if (pending.length === 0) {
    log("ALL STORIES COMPLETE");
    notify("Ralph COMPLETE - all 15 VIZA stories done! Check the repo.");
    break;
  }

  const next = pending[0];
  log(`Starting ${next.id}: ${next.title}`);

  const prompt = fs.readFileSync(PROMPT_FILE, "utf8");
  const result = spawnSync("claude", [
    "--dangerously-skip-permissions",
    "--print",
    prompt
  ], {
    cwd: REPO,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 1800000,
    env: { ...process.env }
  });

  const output = ((result.stdout || "") + (result.stderr || "")).trim();
  log(`${next.id} exit=${result.status}\n${output.slice(-400)}`);

  if (result.error) {
    log(`ERROR: ${result.error.message}`);
    notify(`Ralph ERROR on ${next.id}: ${result.error.message}`);
    sleep(10000);
    continue;
  }

  // Check if story was marked done
  const doneNow = getDoneCount();
  if (doneNow > (i + 5)) { // more done than before
    const summary = output.slice(-300);
    notify(`Ralph: ${next.id} done (${doneNow}/15)\n\n${summary}`);
  } else {
    notify(`Ralph: ${next.id} done (${doneNow}/15)`);
  }

  i++;
  log(`Iteration ${i} done, next in 3s`);
  sleep(3000);
}

log("=== Ralph loop ended ===");