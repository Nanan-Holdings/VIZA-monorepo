# Translate API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/translate/**`.

This route is a server-only translation boundary for bilingual field helpers.
It must never expose provider API keys to the browser, log applicant-entered
text, or translate official stored values such as document numbers, dates,
country codes, phone numbers, emails, or numeric amounts.
