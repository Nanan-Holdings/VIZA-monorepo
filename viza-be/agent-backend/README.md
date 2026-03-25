# Agent Backend

AI-powered companion agent for weight loss service support and user engagement.

## Overview

The VIZA Agent provides:

- **Emotional Support** — Warm, non-judgmental encouragement
- **Progress Tracking** — Check-ins, profile data, goal monitoring
- **Item Management** — SOP-based guidance within internal boundaries
- **In-Chat Refills** — Seamless service renewal
- **Safety Escalation** — Automatic red-flag detection and internal alerts

## Architecture

```
User Message → MW_IN → MW_CTX → AGENT → MW_OUT → Response
               ↓         ↓         ↓        ↓
            Intent &   State    LLM +    Output
            Safety    Loader    Tools    Safety
```

**Key Components**:
- **Protocol Engine** — SOPs as machine-readable service roadmaps
- **Med Knowledge Base** — RAG over item SOPs (pgvector)
- **Agentic Layer** — LangChain-based agent with middleware
- **Evaluation** — RAGAS (offline) + TruLens (online)

## Tech Stack

- **Framework**: Express.js with TypeScript
- **AI**: LangChain, OpenAI/Anthropic
- **Database**: Supabase (PostgreSQL + pgvector)
- **ORM**: Drizzle
- **Embeddings**: Google AI

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Supabase account
- API keys (OpenAI/Anthropic, Google AI)

### Installation

```bash
cd agent-backend
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Configure your `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
```

### Database Setup

```bash
# Enable pgvector in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

# Test connection
npm run test:db

# Apply migrations
npm run db:generate
npm run db:migrate
```

### Development

```bash
npm run dev
```

## Project Structure

```
agent-backend/
├── src/
│   ├── config/           # Configuration
│   ├── db/               # Database connections
│   ├── models/           # Drizzle schema
│   ├── services/         # Business logic
│   │   ├── agent.service.ts
│   │   ├── protocol-engine.service.ts
│   │   └── med-knowledge.service.ts
│   ├── middleware/       # MW_IN, MW_CTX, MW_OUT
│   ├── tools/            # LangChain tools
│   └── scripts/          # Utilities
├── docs/
│   ├── research/         # Research documents
│   └── implementation-plan/
└── package.json
```

## Database Schema

### Core Tables
- `sessions` — Conversation sessions
- `messages` — Chat messages
- `memories` — Long-term memory with embeddings

### Protocol Engine
- `service_protocols` — Protocol definitions
- `protocol_steps` — Individual steps
- `protocol_instances` — Per-user tracking

### Med Knowledge (RAG)
- `med_documents` — SOP documents
- `med_chunks` — Chunked content with embeddings

## Scripts

```bash
npm run dev           # Development server
npm run build         # Build for production
npm start             # Production server
npm run db:generate   # Generate migrations
npm run db:migrate    # Apply migrations
npm run test:db       # Test database
npm test              # Run tests
npm run ingest-sops   # Ingest SOP documents
```

## Documentation

- [Research Document](docs/research/viza-visa-agent-research.md)
- [Implementation Plan](docs/implementation-plan/viza-visa-agent-implementation-plan.md)

## Related Projects

- [`admin-website`](../admin-website) — Staff CMS
- [`viza-chatbot`](../viza-chatbot) — User chatbot UI
- [`viza-mobile`](../viza-mobile) — Mobile app
- [`database`](../database) — Shared schemas

## License

Proprietary — VIZA
