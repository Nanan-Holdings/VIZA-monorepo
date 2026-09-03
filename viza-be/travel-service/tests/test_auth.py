"""Regression tests for the internal-auth dependency and CORS allowlist.

These cover the security contract without exercising the paid upstream calls:
the mutating routes must reject callers when a shared secret is configured, and
health/readiness probes must stay public.
"""

from __future__ import annotations

import importlib
import unittest

import auth as auth_module


def _reload_auth():
    """Reload the module so env changes are re-read and the warn flag resets."""

    return importlib.reload(auth_module)


class AllowedOriginsTests(unittest.TestCase):
    def tearDown(self):
        # Leave the process env clean for other tests.
        import os

        os.environ.pop("TRAVEL_ALLOWED_ORIGINS", None)
        _reload_auth()

    def test_defaults_to_known_portal_origins(self):
        import os

        os.environ.pop("TRAVEL_ALLOWED_ORIGINS", None)
        mod = _reload_auth()
        self.assertEqual(
            mod.allowed_origins(),
            ["https://app.viza.it.com", "https://viza.it.com"],
        )
        self.assertNotIn("*", mod.allowed_origins())

    def test_env_override_is_split_and_trimmed(self):
        import os

        os.environ["TRAVEL_ALLOWED_ORIGINS"] = " https://a.example , https://b.example "
        mod = _reload_auth()
        self.assertEqual(
            mod.allowed_origins(), ["https://a.example", "https://b.example"]
        )


class InternalAuthDependencyTests(unittest.TestCase):
    def setUp(self):
        import os

        os.environ.pop("TRAVEL_SERVICE_TOKEN", None)

    def tearDown(self):
        import os

        os.environ.pop("TRAVEL_SERVICE_TOKEN", None)
        _reload_auth()

    @staticmethod
    def _build_client():
        from fastapi import Depends, FastAPI
        from fastapi.testclient import TestClient

        mod = _reload_auth()
        app = FastAPI()

        @app.get("/health")
        async def health():
            return {"status": "ok"}

        @app.post("/generate", dependencies=[Depends(mod.require_internal_auth)])
        async def generate():
            return {"ok": True}

        return TestClient(app)

    def test_health_is_public(self):
        client = self._build_client()
        self.assertEqual(client.get("/health").status_code, 200)

    def test_unconfigured_token_fails_open(self):
        # No TRAVEL_SERVICE_TOKEN set: the route stays reachable so an
        # unconfigured deployment keeps serving the existing proxy.
        client = self._build_client()
        self.assertEqual(client.post("/generate").status_code, 200)

    def test_configured_token_rejects_missing_header(self):
        import os

        os.environ["TRAVEL_SERVICE_TOKEN"] = "s3cret"
        client = self._build_client()
        self.assertEqual(client.post("/generate").status_code, 401)

    def test_configured_token_rejects_wrong_header(self):
        import os

        os.environ["TRAVEL_SERVICE_TOKEN"] = "s3cret"
        client = self._build_client()
        response = client.post("/generate", headers={"x-internal-token": "nope"})
        self.assertEqual(response.status_code, 401)

    def test_configured_token_accepts_matching_header(self):
        import os

        os.environ["TRAVEL_SERVICE_TOKEN"] = "s3cret"
        client = self._build_client()
        response = client.post("/generate", headers={"x-internal-token": "s3cret"})
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
