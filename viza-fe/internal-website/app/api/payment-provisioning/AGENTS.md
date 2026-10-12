# Payment Provisioning API Agent Guide

Scope: this file applies to `app/api/payment-provisioning/**`.

## Purpose

This API owns authenticated worker entry points for durable post-payment
account, application, inbox, and access provisioning.

## Contracts

- Vercel Cron calls `GET /api/payment-provisioning/worker` with
  `Authorization: Bearer CRON_SECRET`.
- Manual recovery calls `POST /api/payment-provisioning/worker` with the
  separate `PAYMENT_PROVISIONING_WORKER_TOKEN`.
- The cron path runs the bounded worker before reconciling provisioning alerts.
- Alerts use one `admin_work_items` row per provisioning job. Do not enqueue an
  applicant notification or external message from this route.
- A 100%-off beta payment uses provider `free` and follows the same durable job
  and alert path as paid providers.

## Validation

Run the adjacent route test, checkout provisioning alert tests, frontend type
check, and lint after changing this module.
