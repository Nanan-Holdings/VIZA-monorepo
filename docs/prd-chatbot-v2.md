# PRD: VIZA Chatbot v2 — Persistent Visa-Aware AI Assistant

**Version:** 1.0
**Date:** 2026-04-04
**Author:** Michael (AI)
**For:** Ralph (autonomous dev agent)
**Status:** Ready for implementation

---

## 1. Overview

The VIZA chatbot is an AI assistant embedded in the client portal (`/chat`). The current implementation is broken: the agent backend is deployed on Google Cloud Run and either times out or fails the Socket.IO handshake, causing the frontend to hang on "connecting" indefinitely.

This PRD covers a full rebuild of the chatbot:

1. **Fix the broken connection** — move the agent backend to Render, fix the Socket.IO connection reliability
2. **Persistent single session** — one continuous conversation per user (not multiple historical sessions), stored in Supabase
3. **Visa-type-aware agent** — system prompt and knowledge dynamically scoped to the user's active visa package
4. **Interactive application blocks** — the agent can detect missing fields and send inline React components directly in the chat for the user to fill in; saves directly to DB and syncs to `/application` in real time
5. **Free step navigation on `/application`** — remove the linear lock; all steps freely accessible and editable

---

## 2. Current State

### What is broken
- `companion-chat.tsx` connects to `https://agent-backend-staging-kxvsjusria-as.a.run.app` (Google Cloud Run, spins down on free tier)
- Socket.IO `status` stays `connecting` — messages never send — UI stuck on loading
- Agent in `src/agent/index.ts` is Indonesia-only, no tool use, no application data awareness
- Multiple sessions model is confusing and unnecessary

### What exists and works (keep it)
- Socket.IO `/visa` namespace architecture in `agent-backend` — solid, just needs the backend deployed reliably
- `companion-chat.tsx` UI — keep the design, chat view, session sidebar (repurpose as conversation history)
- `use-agent-socket.ts` hook — keep, minor changes only
- `visa_chat_messages` + `visa_chat_sessions` tables — keep for message storage
- `/application` page structure — keep layout, just remove the step lock

---

## 3. Scope

**In scope:**
- Render deployment of `agent-backend`
- Persistent single-session chat model
- Visa-type-aware agent with dynamic system prompt
- Application block messages (inline form cards in chat)
- Real-time DB save + `/application` page sync when user fills blocks
- Free step navigation on `/application`

**Out of scope:**
- Care Team chat (already shows "coming soon")
- DS-160 Playwright automation (separate PRD)
- Payment/billing
- Mobile push notifications

---

## 4. Backend Deployment — Move to Render

### 4.1 Why Render
Google Cloud Run free tier spins down after inactivity, breaking the persistent WebSocket connection. Render free web services also spin down but have better WebSocket support and a more predictable wake-up.

### 4.2 render.yaml
Create `viza-be/agent-backend/render.yaml`:

```yaml
services:
  - type: web
    name: viza-agent-backend
    runtime: node
    region: singapore
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: CORS_ORIGINS
        sync: false
```

### 4.3 Frontend env fix
Remove the hardcoded GCP fallback URL in `companion-chat.tsx`:

```ts
// Before:
const AGENT_BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "https://agent-backend-staging-kxvsjusria-as.a.run.app";
// After:
const AGENT_BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "http://localhost:3002";
```

Add to `viza-fe/internal-website/.env.example`:
```
NEXT_PUBLIC_AGENT_BACKEND_URL=https://viza-agent-backend.onrender.com
```

---

## 5. Persistent Single Session Model

### 5.1 New table: user_chat_sessions

Migration `0008_user_chat_sessions.sql`:

```sql
CREATE TABLE IF NOT EXISTS user_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visa_package_id UUID REFERENCES visa_packages(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auth_user_id)
);

ALTER TABLE user_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_chat_sessions_select" ON user_chat_sessions
  FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);

CREATE POLICY "user_chat_sessions_service" ON user_chat_sessions
  FOR ALL TO service_role USING (true);
```

Update `visa_chat_messages` to reference the new table (add FK if missing):
```sql
ALTER TABLE visa_chat_messages ADD COLUMN IF NOT EXISTS block_data JSONB;
```
The `block_data` column stores the block descriptor JSON when `role = 'block'`.

### 5.2 Session resolution on page load
In `companion-sessions.ts`, new action `getOrCreateUserSession(userId)`:
1. Query `user_chat_sessions` where `auth_user_id = userId`
2. If exists: return session + load all `visa_chat_messages` for it (last 100, ordered by `created_at` asc)
3. If not: INSERT into `user_chat_sessions`, return empty session

### 5.3 Frontend changes in companion-chat.tsx
- Remove `sessions` state array, `setSessions`, `handleSessionSelect`, `handleNewLabsAiChat`
- Replace with single `session` object from `getOrCreateUserSession`
- Remove sidebar entirely (SessionSidebar component, Sheet mobile sidebar, all related state)
- On mount: call `getOrCreateUserSession` instead of `getUserSessions`
- No "new conversation" button

---

## 6. Visa-Type-Aware Agent

### 6.1 Dynamic system prompt in agent/index.ts

```ts
export function buildSystemPrompt(context: {
  visaPackage: { name: string; country: string; visa_type: string } | null;
  applicationSummary: string;
}): string {
  const visaContext = context.visaPackage
    ? `The user is applying for: ${context.visaPackage.name} (${context.visaPackage.country}).`
    : `The user has not selected a visa package yet.`;

  return `You are VIZA, a friendly AI concierge that helps users complete their visa application.

${visaContext}

Current application status:
${context.applicationSummary}

Your job:
- Answer questions about their visa application
- Proactively spot missing fields and use the send_application_block tool to send inline form cards
- Once a block is filled, acknowledge it and guide the user to the next step
- Keep responses concise. Use short paragraphs.
- Never fabricate visa requirements. If unsure, say so.
- Respond in the same language the user writes in.`;
}
```

### 6.2 Application context builder in agent/index.ts

```ts
export async function buildApplicationContext(userId: string): Promise<string>
```

Queries (via Supabase service role client):
- `applicant_profiles` where `auth_user_id = userId`
- `applications` where `applicant_id = profile.id` (latest)
- `application_documents` where `application_id = application.id`
- `user_packages` where `auth_user_id = userId` and `status = 'active'` (join `visa_packages`)

Returns formatted string:
```
Visa: Indonesia B211A Tourist Visa
Application status: in_progress

Personal Info [COMPLETE]: Zhang Zehua, DOB 1999-04-15, Chinese national
Passport [COMPLETE]: AD232123, expires 2027-03-30
Travel Info [INCOMPLETE]: arrival_date MISSING, departure_date MISSING, port_of_entry MISSING, accommodation MISSING
Documents [0/6 uploaded]: passport_copy MISSING, photo MISSING, financial_proof MISSING, accommodation_proof MISSING, flight_booking MISSING, insurance MISSING
```

### 6.3 Context injection in visa-namespace.ts
On each `visa_chat_message` event:
1. Fetch visa package + application context
2. Build system prompt with context
3. Prepend context as a hidden system message in chat history
4. Pass to `streamChat`

---

## 7. Interactive Application Blocks

### 7.1 Block descriptor format
When the agent calls `send_application_block`, the tool result contains:

```ts
interface ApplicationBlock {
  messageId: string;
  blockType: "field_group" | "single_field" | "document_upload";
  title: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "date" | "select" | "textarea" | "file";
    required: boolean;
    currentValue: string | null;
    options?: string[];
    placeholder?: string;
  }>;
  saveTarget: "personal_info" | "passport_info" | "travel_info" | `visa_answer_${string}` | `document_${string}`;
  applicationId: string | null;
}
```

### 7.2 Agent tool definition
Add to `agent/index.ts` (Anthropic tool use):

```ts
const tools: Anthropic.Tool[] = [
  {
    name: "send_application_block",
    description: "Send an inline application form card into the chat when you detect missing or incomplete fields. The user fills it in directly in the chat and it saves to the database automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Card title, e.g. 'Travel Information'" },
        description: { type: "string", description: "Message shown above the card" },
        blockType: { type: "string", enum: ["field_group", "single_field", "document_upload"] },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: ["text", "date", "select", "textarea", "file"] },
              required: { type: "boolean" },
              currentValue: { type: ["string", "null"] },
              options: { type: "array", items: { type: "string" } },
              placeholder: { type: "string" }
            },
            required: ["key", "label", "type", "required"]
          }
        },
        saveTarget: { type: "string" },
        applicationId: { type: ["string", "null"] }
      },
      required: ["title", "description", "blockType", "fields", "saveTarget"]
    }
  }
];
```

When tool use is detected in the stream:
1. Emit `application_block` socket event with the block data
2. Save to `visa_chat_messages` with `role: 'block'`, `content: description`, `block_data: blockJson`
3. Continue streaming the agent's text response (the tool result feeds back naturally)

### 7.3 BlockMessage component
New file: `viza-fe/internal-website/components/client/companion/block-message.tsx`

```tsx
// Props
interface BlockMessageProps {
  block: ApplicationBlock;
  onSaved: (blockId: string) => void;
}
```

Renders as a white card with subtle border inside the chat, below the agent's description text.

Field rendering:
- `text` / `textarea` → Input / Textarea component
- `date` → DatePicker (reuse existing date-picker-card pattern)
- `select` → Select with options array
- `file` → FileUpload card (reuse existing file-upload-card.tsx pattern)

Save button calls `POST /api/chat/save-block`.

After successful save:
- Card border turns green
- Fields become read-only
- Show green checkmark + "Saved" label
- Emit `block_saved` socket event: `{ blockId, saveTarget, savedValues }`

### 7.4 Chat message rendering update
In `chat-message.tsx` (or inline in `companion-chat.tsx`):
- When `msg.role === 'block'`, render `<BlockMessage block={JSON.parse(msg.content)} />`
- All other roles render as before

In `use-agent-socket.ts`:
- Handle new `application_block` socket event
- Add block messages to the messages array with `role: 'block'`

---

## 8. Save-Block API Endpoint

### POST /api/chat/save-block

File: `viza-be/agent-backend/src/routes/chat-save-block.routes.ts`

```ts
// Request
{
  userId: string;        // auth_user_id
  applicationId: string | null;
  saveTarget: string;
  values: Record<string, string>;
}

// Response
{ success: true, updatedFields: string[] }
```

Routing logic:
```
saveTarget === "personal_info"
  → upsert applicant_profiles (full_name, date_of_birth, gender, nationality, occupation, address, place_of_birth)

saveTarget === "passport_info"
  → upsert applicant_profiles (passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, passport_issuing_authority)

saveTarget === "travel_info"
  → upsert applications (arrival_date, departure_date, port_of_entry, purpose, accommodation_name, accommodation_address)

saveTarget starts with "visa_answer_"
  → upsert visa_application_answers (field_name = saveTarget.replace("visa_answer_", ""), value_text = values[key])

saveTarget starts with "document_"
  → insert application_documents row with document_type = saveTarget.replace("document_", "")
```

Register in `app.ts`:
```ts
import chatSaveBlockRouter from './routes/chat-save-block.routes.js';
app.use('/api/chat', chatSaveBlockRouter);
```

---

## 9. Realtime Sync on /application

Add to `application/page.tsx` in the main `ApplicationPage` component:

```ts
useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel('application-realtime')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'applicant_profiles'
    }, () => loadData())
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'applications'
    }, () => loadData())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [loadData]);
```

---

## 10. Free Step Navigation

### Changes to application/page.tsx

**VerticalStepSidebar**: wrap each step card in a button that calls `onStepClick(i)`:
```tsx
// Add prop:
onStepClick: (index: number) => void;

// Each step card:
<button onClick={() => onStepClick(i)} className="w-full text-left ...">
  {/* existing card content */}
</button>
```

**MobileStepBar**: same — make each circle clickable.

**Remove LockedStepCard** entirely. Replace with the same step form but always shown (not locked).

**Remove lock logic**:
```ts
// Remove this check in step rendering:
if (i > completedUpTo) return <LockedStepCard />

// Replace with: always render the step form
```

**Keep completedUpTo** only to determine whether to show `CompletedStepSummary` (green summary card) vs the full form. If `i < completedUpTo` → show summary with Edit button. If `i >= completedUpTo` → show full form.

---

## 11. User Stories for Ralph

### US-033: Render deployment config
Create `render.yaml` at `viza-be/agent-backend/`. Fix hardcoded GCP URL in `companion-chat.tsx`. Add `NEXT_PUBLIC_AGENT_BACKEND_URL` to `internal-website/.env.example`.
Scope: `viza-be/agent-backend/render.yaml`, `companion-chat.tsx`, `internal-website/.env.example`
Priority: 33

### US-034: Persistent single session — backend
Migration `0008_user_chat_sessions.sql`. Add `block_data JSONB` column to `visa_chat_messages`. Add `getOrCreateUserSession` server action. Update Drizzle schema.
Scope: `viza-be/agent-backend/drizzle/`, `viza-fe/internal-website/app/actions/companion-sessions.ts`
Priority: 34

### US-035: Persistent single session — frontend
Update `ChatPage` and `CompanionChat` to use single session model. Remove session switcher. Sidebar shows visa package + history only.
Scope: `companion-chat.tsx`, `app/client/chat/page.tsx`
Priority: 35

### US-036: Visa-type-aware agent + application context
Replace static system prompt with `buildSystemPrompt`. Add `buildApplicationContext(userId)`. Inject context into each chat request in `visa-namespace.ts`.
Scope: `agent/index.ts`, `socket/visa-namespace.ts`
Priority: 36

### US-037: Agent tool use — send_application_block
Add Anthropic tool use to `streamChat`. Define `send_application_block` tool. On tool call: emit `application_block` socket event, save block to `visa_chat_messages` with `role: block`.
Scope: `agent/index.ts`, `socket/visa-namespace.ts`
Priority: 37

### US-038: BlockMessage frontend component
Create `block-message.tsx`. Handle field types (text, date, select, file). Save via `POST /api/chat/save-block`. Saved/error states. Emit `block_saved` socket event. Update `use-agent-socket.ts` to handle `application_block` event. Update message rendering to show block cards.
Scope: `components/client/companion/block-message.tsx`, `chat-message.tsx`, `use-agent-socket.ts`, `companion-chat.tsx`
Priority: 38

### US-039: Save-block API endpoint
Create `POST /api/chat/save-block`. Route by `saveTarget` to correct DB table (personal_info, passport_info, travel_info, visa_answer_*, document_*). Register in `app.ts`.
Scope: `routes/chat-save-block.routes.ts`, `app.ts`
Priority: 39

### US-040: Realtime sync on /application
Add Supabase Realtime subscription in `application/page.tsx` on `applicant_profiles` and `applications`. Call `loadData()` on change.
Scope: `app/client/application/page.tsx`
Priority: 40

### US-041: Free step navigation on /application
Make all sidebar step cards clickable. Remove `LockedStepCard`. Remove lock logic from step rendering. Keep `completedUpTo` for visual summary vs form toggle only.
Scope: `app/client/application/page.tsx`
Priority: 41

---

## 12. Out of Scope
- DS-160 block type
- Care Team chat
- Push notifications when agent sends a block while user is on another page
- Passport OCR prefill
- Agent memory summarisation for very long sessions (load last 100 messages for now)

