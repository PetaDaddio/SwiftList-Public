# SwiftList Security Documentation Index

## Project Overview
SwiftList is an AI-powered product image automation SaaS for makers in the creator economy (Etsy sellers, jewelry makers, small e-commerce businesses).

## Tech Stack
- **Frontend:** SvelteKit, Svelte 5, TailwindCSS
- **Backend:** SvelteKit server routes (+server.ts), Supabase (PostgreSQL + Auth + Storage)
- **Job Processing:** BullMQ + Railway workers
- **Image APIs:** Replicate (RMBG, upscaling), Google Gemini 3 (Imagen), fal.ai (Bria RMBG 2.0)
- **AI/LLM:** Claude API (Haiku for classification, Sonnet for Lifeguard error monitoring)
- **Deployment:** Railway (app + workers), Cloudflare (CDN/WAF/DDoS)

## Security Documentation
- **Primary security protocol:** `/.claude/CLAUDE.md` (v1.7+)
- **Security audit (Jan 2026):** `/docs/security/SECURITY-AUDIT-2026-01-14.md`
- **Agentic AI security:** `/docs/security/AGENTIC-AI-SECURITY-PROTOCOL.md`
- **Debugging log:** `/DEBUGGING-LOG.md`

## Key Security Principles
1. Row Level Security (RLS) on all database tables
2. Server-side authentication + authorization on all API routes
3. Input validation with Zod schemas
4. Rate limiting on public endpoints
5. Secrets via `$env/dynamic/private` (never `process.env`)
6. BullMQ job validation before queue insertion
7. Signed URLs for file uploads with expiration

See `/.claude/CLAUDE.md` for the complete security-first development protocol.
