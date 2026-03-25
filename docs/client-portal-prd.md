# VIZA - Product Requirements Document (Internal Client Portal)
## Demo System: Indonesian Tourist Visa (B211A)

**Version:** 0.5
**Status:** Draft
**Scope:** Full system demo, scoped to Indonesian tourist visa only. Build as production-grade - not a toy MVP.

---

## 1. Product Overview

VIZA is an AI-powered visa application platform that guides Chinese nationals through the tourist visa application process. The product handles everything: collecting applicant information, gathering and validating documents, and submitting the application on the client''s behalf via browser automation.

The client-facing interface is an internal management portal - a web app where clients log in, interact with the AI visa assistant, track their application, and upload documents.

**Demo scope:** Indonesian tourist visa (B211A), via e-visa portal at evisa.imigrasi.go.id. Full system, one visa type.

**Target user:** Chinese nationals applying for Indonesian tourist visas. Limited English, limited familiarity with bureaucratic processes.

---

## 1b. Technical Foundation

### Frontend (viza-fe/internal-website)

Next.js app with the following /client route subtree:

- home/           -> Application dashboard (/home)
- application/    -> Visa application step flow + status
- chat/           -> AI chatbot (/chat)
- documents/      -> Document tracker (/documents)
- onboarding/     -> Applicant onboarding (/onboarding)
- services/       -> Visa packages page
- settings/       -> Profile & account settings
- (auth)/         -> Supabase auth

### Backend (viza-be/agent-backend)

Express + Socket.io + RAG chatbot backend. Claude-powered visa assistant with domain-specific tools and pgvector knowledge base.

### Core Infrastructure

| Component               | Details                               |
|-------------------------|---------------------------------------|
| Supabase auth           | Email/password + magic link           |
| Socket.io streaming     | Real-time chat + component events     |
| pgvector RAG pipeline   | Visa knowledge semantic search        |
| Drizzle ORM             | Type-safe DB queries                  |
| Shadcn UI components    | Radix + Tailwind component library    |

---

## 2. Core User Journey

Sign up / Log in
-> Onboarding (passport, nationality, travel dates)
-> VIZA Chatbot guides through document collection
   - Inline components: upload cards, date pickers, forms
   - RAG knowledge base validates completeness
-> ConfirmationCard review
-> Browser automation submits to evisa.imigrasi.go.id
-> Dashboard shows status: Submitted

---

## 3. System Architecture

CLIENT BROWSER
  Next.js 16 + React 19 (/client subtree only)
  Pages: /home | /application | /chat | /documents | /settings
        |
        | HTTPS + Socket.io
        v
CHATBOT BACKEND                         SUBMISSION SERVICE
  Express.js + TypeScript               Node.js + Playwright
  Claude (Anthropic SDK)                Watches Supabase queue
  Socket.io server                      Submits to evisa.imigrasi.go.id
  Domains: knowledge, application,      Writes confirmation back
           submission, escalation,
           conversation
        |
        v
SUPABASE (viza-production)
  PostgreSQL + pgvector + Auth + Storage
        ^
SCRAPING PIPELINE (Michael workflows)

---

## 4. Services Breakdown

### 4.1 Knowledge Base Layer

Scalable multi-layer structure:
- Layer 1: Country (indonesia)
- Layer 2: Visa Type (tourist_b211a)
- Layer 3: Doc Type (requirements | process | faq | form_fields | common_mistakes)
- Layer 4: Chunks - pgvector embeddings (OpenAI text-embedding-3-small, 1536 dim)

Database schema:

  create table visa_documents (
    id            uuid primary key default gen_random_uuid(),
    country       text not null,
    visa_type     text not null,
    document_type text not null,
    title         text,
    source_url    text,
    raw_content   text,
    created_at    timestamptz default now()
  );

  create table visa_chunks (
    id            uuid primary key default gen_random_uuid(),
    document_id   uuid references visa_documents(id) on delete cascade,
    country       text not null,
    visa_type     text not null,
    document_type text not null,
    section_title text,
    content       text not null,
    embedding     vector(1536),
    created_at    timestamptz default now()
  );

  create index on visa_chunks using ivfflat (embedding vector_cosine_ops);

Scraping pipeline:
- Use Michael workflows scraper
- Targets: evisa.imigrasi.go.id, imigrasi.go.id, embassy sites
- Ingest script: knowledge-base/scripts/ingest-indonesia-tourist.ts
- Run: npm run ingest:visa-indonesia

---

### 4.2 Frontend - Client Portal

Stack: Next.js 16, React 19, Shadcn UI (Radix + Tailwind), Supabase auth, Socket.io client

Typography:
- Switzer (variable woff2): headings only (h1-h6). CSS var: --font-switzer. Tailwind: font-heading.
- Inter (variable ttf): body, labels, buttons. CSS var: --font-inter. Default sans.
- Files: public/fonts/switzer/ and public/fonts/inter/
- Declared in app/fonts.ts via next/font/local.

Brand color: #03346E (navy). Scale in tailwind.config.ts under brand. Primary action: brand-500.
Border radius: --radius 0.25rem (4px). lg=4px, md=3px, sm=2px.
Language: English only. No i18n, no next-intl. zh-CN is Phase 2.

Pages:

/login - Supabase auth. Email/password + magic link. VIZA branded.

/onboarding
- Step 1: name, DOB, nationality
- Step 2: passport number, issue date, expiry, issuing country
- Step 3: travel dates, purpose
- Step 4: email, phone, WeChat
Stored in applicant_profiles. Skipped if done.

/home - Application Dashboard
- Active application card with status badge
- Progress bar: docs collected vs required
- Quick actions: Continue with AI, Upload documents, View application
- Activity feed, empty state CTA

/application - Visa Application Steps + Status (new page)
Mirrors evisa.imigrasi.go.id flow exactly. Step progress bar at top.

- Step 1 PersonalInfoStep: name, DOB, place of birth, gender, nationality, occupation, address
- Step 2 PassportStep: passport number, issue/expiry dates, issuing country + authority
- Step 3 TravelInfoStep: arrival/departure dates, port of entry, purpose, accommodation
- Step 4 DocumentUploadStep: passport bio page, photo, flight, hotel, bank statement, itinerary
- Step 5 ReviewStep: read-only summary, edit buttons per section
- Step 6 StatusStep: confirmation number, timestamp, processing time, receipt download

State sync: Both /application and /chat read/write same DB tables. Supabase is source of truth.
Chatbot loads current state at session start via get-application-status.

Component reuse:
  components/application-steps/
    PersonalInfoStep.tsx   <- /application step 1 + chat inline
    PassportStep.tsx       <- /application step 2 + chat inline
    TravelInfoStep.tsx     <- /application step 3 + chat inline
    DocumentUploadStep.tsx <- /application step 4 + chat inline
    ReviewStep.tsx         <- /application step 5 + chat inline
    StatusStep.tsx         <- /application step 6 + post-submission display

/chat - VIZA AI Chatbot
- Socket.io streaming, English only, markdown rendering
- Inline components rendered mid-thread
- Session history sidebar

Chat flow:
1. Greet, confirm Indonesia tourist visa
2. Load applicant profile, fill gaps
3. Explain docs needed (from RAG)
4. For each doc: emit DocumentUploadStep, wait, confirm
5. Emit DocumentChecklistCard (all green)
6. Emit ReviewStep / ConfirmationCard
7. On confirm: trigger submission queue, emit StatusStep

/documents - Document Tracker
- Grid with thumbnails/icons, status per doc, upload for missing docs

/settings - Profile edit, password, notifications. Language toggle is Phase 2.

---

### 4.3 Chatbot Inline Component Protocol

Bot -> Client (Socket.io component event):
  { type: "component", component: "PassportStep", componentId: "uuid",
    props: { prefill: { passportNumber: "G123" }, applicationId: "uuid" } }

Client -> Bot (Socket.io component_complete event):
  { type: "component_complete", componentId: "uuid",
    result: { passportNumber: "G123", expiryDate: "2030-01-01" } }

Step components: PersonalInfoStep, PassportStep, TravelInfoStep, DocumentUploadStep, ReviewStep, StatusStep

Primitive components:
- FileUploadCard: drag-drop, type validation, progress. Returns storagePath + filename.
- DatePickerCard: inline calendar. Returns ISO date.
- FormCard: configurable inline form. Returns field values.
- DocumentChecklistCard: status icons per doc. Display only.
- ConfirmationCard: full summary + "Confirm and Submit". Returns confirmed boolean.
- StatusCard: post-submission success + confirmation number. Display only.

All components English only (Phase 1).

---

### 4.4 Chatbot Backend

Stack: Express.js + TypeScript, Socket.io, Claude claude-sonnet-4-5 (Anthropic SDK),
       Supabase + Drizzle, OpenAI text-embedding-3-small
Hosting: Railway

Agent persona (src/agent/soul.md):
VIZA visa assistant. English only Phase 1. Warm and practical.
Guides applicants through an overwhelming process. Does not make users feel stupid.

Domains:

knowledge:
- VisaKnowledgeService: pgvector + OpenAI embeddings semantic search
- query-visa-requirements { country, visa_type, query }
- get-document-checklist { country, visa_type }

application:
- get-application-status { applicationId }
- update-application-field { applicationId, field, value }
- check-document-completeness { applicationId }
- mark-document-received { applicationId, documentType, storagePath }

submission:
- trigger-submission { applicationId } -> inserts into submission_queue

escalation: escalate-to-agent

conversation: visa_chat_sessions, visa_chat_messages

AI: Anthropic SDK (@anthropic-ai/sdk). claude-sonnet-4-5 for chat. OpenAI text-embedding-3-small for embeddings.

---

### 4.5 Browser Automation Submission Service

Stack: Node.js + Playwright, separate Railway service

Flow:
1. Poll submission_queue
2. Load applicant profile + docs from Supabase
3. Download docs to temp dir
4. Playwright -> evisa.imigrasi.go.id
5. Fill all form fields
6. Upload docs
7. Submit, capture confirmation number + screenshot
8. Write back: status=submitted, confirmation_number, submitted_at
9. Store receipt in Supabase Storage
10. Mark queue item done

Errors: retry 3x exponential backoff. After 3 fails: Resend alert + manual queue.
CAPTCHA: 2captcha first, manual fallback.

---

## 5. Database Schema

  create table applicant_profiles (
    id               uuid primary key references auth.users(id),
    full_name        text,
    date_of_birth    date,
    nationality      text,
    passport_number  text,
    passport_expiry  date,
    phone            text,
    wechat_id        text,
    language_pref    text default ''en'',
    onboarding_done  boolean default false,
    created_at       timestamptz default now(),
    updated_at       timestamptz default now()
  );

  create table applications (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid references auth.users(id),
    country              text not null default ''indonesia'',
    visa_type            text not null default ''tourist_b211a'',
    status               text default ''draft'',
    travel_date_from     date,
    travel_date_to       date,
    confirmation_number  text,
    submitted_at         timestamptz,
    receipt_storage_path text,
    created_at           timestamptz default now(),
    updated_at           timestamptz default now()
  );

  create table application_documents (
    id               uuid primary key default gen_random_uuid(),
    application_id   uuid references applications(id) on delete cascade,
    document_type    text not null,
    storage_path     text,
    filename         text,
    status           text default ''uploaded'',
    rejection_reason text,
    uploaded_at      timestamptz default now()
  );

  create table submission_queue (
    id              uuid primary key default gen_random_uuid(),
    application_id  uuid references applications(id),
    status          text default ''pending'',
    attempts        int default 0,
    last_error      text,
    created_at      timestamptz default now(),
    processed_at    timestamptz
  );

  create table visa_chat_sessions (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid references auth.users(id),
    application_id  uuid references applications(id),
    created_at      timestamptz default now(),
    last_active_at  timestamptz default now()
  );

  create table visa_chat_messages (
    id          uuid primary key default gen_random_uuid(),
    session_id  uuid references visa_chat_sessions(id) on delete cascade,
    role        text not null,
    content     text,
    components  jsonb,
    created_at  timestamptz default now()
  );

  -- See Section 4.1 for visa_documents and visa_chunks

Supabase project: viza-production (https://oyjxdzsoejraedqghndi.supabase.co)
Enable pgvector extension. Keys in .env.
Storage bucket: application-documents (private, RLS scoped to owner).

---

## 6. Tech Stack

| Layer              | Tech                                            |
|--------------------|-------------------------------------------------|
| Frontend           | Next.js 16, React 19, Shadcn UI, Socket.io      |
| Language           | English only (zh-CN Phase 2)                    |
| Chatbot backend    | Express.js, TypeScript, Socket.io               |
| AI model           | claude-sonnet-4-5 (Anthropic SDK)               |
| Embeddings         | OpenAI text-embedding-3-small (1536d)           |
| Knowledge base     | Supabase pgvector                               |
| Auth + DB          | Supabase (PostgreSQL + Auth + Storage)          |
| ORM                | Drizzle                                         |
| Submission service | Node.js, Playwright                             |
| Hosting            | Railway (2 separate services)                   |
| Scraping           | Michael workflows pipeline                      |

---

---

## 8. Indonesian Tourist Visa B211A - Required Documents

1. Passport bio page scan (valid min. 6 months from travel, all 4 corners visible)
2. Passport-size photo (white background, 3.5x4.5cm, within 6 months)
3. Return / onward flight booking confirmation
4. Hotel booking confirmation (covers entire stay)
5. Travel itinerary
6. Bank statement (last 3 months, min. USD 1,500 equivalent recommended)

Optional: travel insurance, proof of employment.

---

## 9. Knowledge Base Scraping Targets

Sources:
- https://evisa.imigrasi.go.id
- https://www.imigrasi.go.id
- Indonesian embassy websites
- Reliable visa aggregators

Extract: requirements, accepted formats, form fields, processing times (3-5 days), fees (USD 35 single entry), eligibility, rejection reasons, FAQs.

---

## 10. Out of Scope

- Payment gateway
- Other countries / visa types
- Mobile app
- Automated post-submission status polling
- Admin / staff portal
- Multi-applicant / group applications

---

## 10b. Database Migration Strategy

Drizzle migrations for all VIZA tables listed in Section 5.

Future tables to anticipate in architecture (not built yet):
- visa_requirements (structured rows per country/visa type)
- supported_countries (country registry)
- visa_types (per-country visa type registry)
- application_events (audit log)

---

## 11. Resolved Decisions

- State sync: Supabase single source of truth
- AI: Claude (Anthropic SDK) + OpenAI text-embedding-3-small
- Supabase: viza-production (oyjxdzsoejraedqghndi.supabase.co)
- language_pref default: en
- Schema: Drizzle migrations
- Railway: 2 separate services (chatbot backend + submission service)
- CAPTCHA: 2captcha then manual fallback
