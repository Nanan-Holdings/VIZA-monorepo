# Marketing Admin API Guide

Scope: applies to `app/api/admin/marketing/**`.

These routes are authenticated server-only support endpoints for the marketing
operations workspace. Verify active admin membership before creating a service
role client. Never return credentials or provider account identifiers.

Public marketing assets are raster images or reviewed documents only. Enforce
the shared MIME and size allowlist in `lib/marketing/assets.ts`, use unique
object names, and keep uploads in the public `marketing-public-assets` bucket.
