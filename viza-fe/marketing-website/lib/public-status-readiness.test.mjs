import assert from "node:assert/strict";
import test from "node:test";
import {
  hasFreshPublicStatusEvidence,
  publicStatusHttpStatus,
  resolvePublicStatusBaseUrl,
} from "./public-status-readiness.ts";

function snapshot(summary = {}) {
  return {
    version: 1,
    generatedAt: "2026-09-09T00:00:00.000Z",
    probeIntervalSeconds: 300,
    staleAfterSeconds: 900,
    summary: { status: "operational", monitored: 1, operational: 1, activeIncidents: 0, uptime90d: 100, ...summary },
    monitors: [{
      id: "platform",
      type: "platform",
      code: null,
      name: { en: "VIZA", "zh-CN": "VIZA" },
      description: { en: "Portal", "zh-CN": "Portal" },
      status: "ok",
      lastCheckedAt: "2026-09-09T00:00:00.000Z",
      latencyMs: 20,
      uptime90d: 100,
      days: [],
    }],
    incidents: [],
  };
}

test("production status requires an explicit HTTPS backend", () => {
  assert.equal(resolvePublicStatusBaseUrl({ NODE_ENV: "production" }), null);
  assert.equal(resolvePublicStatusBaseUrl({ NODE_ENV: "production", AGENT_BACKEND_URL: "http://localhost:3002" }), null);
  assert.equal(resolvePublicStatusBaseUrl({ NODE_ENV: "production", AGENT_BACKEND_URL: "https://status.viza.it.com/" }), "https://status.viza.it.com");
  assert.equal(resolvePublicStatusBaseUrl({ NODE_ENV: "development" }), "http://localhost:3002");
});

test("readiness requires fresh monitored evidence and maps missing evidence to 503", () => {
  const now = Date.parse("2026-09-09T00:10:00.000Z");
  assert.equal(hasFreshPublicStatusEvidence(snapshot(), now), true);
  assert.equal(hasFreshPublicStatusEvidence(snapshot({ monitored: 0 }), now), false);
  assert.equal(hasFreshPublicStatusEvidence(snapshot({ status: "unknown" }), now), false);
  assert.equal(hasFreshPublicStatusEvidence({ ...snapshot(), monitors: [{ ...snapshot().monitors[0], lastCheckedAt: "2026-09-08T23:00:00.000Z" }] }, now), false);
  assert.equal(publicStatusHttpStatus(true), 200);
  assert.equal(publicStatusHttpStatus(false), 503);
});
