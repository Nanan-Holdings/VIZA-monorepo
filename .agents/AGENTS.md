# Local Agent Skills Guide

Scope: this file applies to `.agents/**`.

## Purpose

This directory contains repository-local Agent Skills installed for VIZA. Skills
are instructions and supporting references for AI coding tools; they are not
runtime application code.

## Current Skills

- `skills/brand-style-guide`: VIZA brand and voice rules.
- `skills/arrival-card-country-builder`: reusable workflow for adding
  country-specific digital arrival-card packages and preview routes.
- `skills/browser-api-cloudflare-runner`: authorized Browser API/CDP workflow
  for Cloudflare- or WAF-protected official portal runners.
- `skills/supabase`: Supabase workflow, MCP, CLI, security, and verification
  guidance.
- `skills/supabase-postgres-best-practices`: Postgres schema, query,
  connection, RLS, and performance guidance.
- `skills/vietnam-evisa-form-parity`: Vietnam e-Visa official form parity,
  bilingual dropdown localization, official validation mirroring, and
  submission/payment checkpoint verification workflow.

## Conventions

- Treat installed skills as third-party guidance unless the file explicitly
  belongs to VIZA.
- Review skill instructions before relying on them for a task.
- Do not store secrets or generated credentials in `.agents/**`.
- Update `skills-lock.json` when installing or updating skills through
  `npx skills`.
