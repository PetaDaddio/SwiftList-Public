# Contribution Guidelines for SwiftList

These guidelines apply to AI code generation (Claude Code) and any human developer. A commit that violates these rules is **rejected.**

---

## 1. Security-First Mentality

SwiftList is an AI-powered SaaS built with significant LLM assistance. This makes us a prime target for the attack vectors that plague "vibe-coded" applications — the very patterns that lead to leaked API keys, open admin endpoints, and $82K surprise bills. Every contributor must think like an attacker before writing a single line.

**Before every change, ask:**
- Can a malicious user manipulate this input to access other users' data?
- Could this expose an API key, token, or internal error to the client?
- If this endpoint were called 10,000 times in a minute, what happens?
- Does this trust anything from the client that should be verified server-side?

### Mandatory Security Checklist (Every Backend Route)

- [ ] `supabase.auth.getUser(token)` at the top — never `getSession()`
- [ ] Authorization check — can this user access this specific resource?
- [ ] Zod schema validation on the request body
- [ ] Rate limiting applied via `@upstash/ratelimit`
- [ ] Try-catch with safe error messages — no stack traces, no internal details
- [ ] CORS whitelist enforced (swiftlist.app only)

### Common Vibe-Code Vulnerabilities to Watch For

| Vulnerability | How It Happens | Our Defense |
|--------------|----------------|-------------|
| **Exposed API keys** | Keys in client bundles, `.env` committed to git, keys in markdown docs | Server-side only (`$env/dynamic/private`), pre-commit hook blocks secrets, no `VITE_PUBLIC_` secrets |
| **Broken auth** | Using `getSession()` (client-forgeable) instead of `getUser()` (server-validated) | All routes use `getUser()`, never trust client-provided user_id |
| **Missing RLS** | `USING (true)` policies, no policies on new tables | Deny-by-default, `auth.uid()` on every policy, audit after DDL changes |
| **Prompt injection** | User input passed directly to LLM without sanitization | `sanitizeAIPrompt()` on all 12 LLM integration points |
| **Trusting the client** | Client sends credits_balance, pricing, or user role | All business logic server-side, credits are atomic DB transactions |
| **No rate limiting** | Attacker brute-forces auth or floods expensive AI endpoints | Multi-tier rate limiting on all public endpoints |
| **Verbose errors** | Stack traces, SQL errors, or file paths leaked in API responses | Generic error messages only, details go to Pino logs + Sentry |

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for the full security protocol.

---

## 2. Code Standards

### Language & Framework
- **TypeScript only** — no JavaScript files in production code
- **Svelte 5 runes** — use `$state`, `$derived`, `$props`. Never legacy `$:` reactive syntax
- **SvelteKit patterns** — API routes in `+server.ts`, use `json()` and `error()` from `@sveltejs/kit`
- **String literals over enums** — `type Status = 'pending' | 'active'`

### Environment Variables
- **Secrets in server routes:** `$env/dynamic/private` — never `process.env`
- **Never prefix secrets with `VITE_PUBLIC_`** — this bundles them into client JS
- **Shared lib needs a secret?** Pass it as a function parameter. Shared files cannot import private env.

### Package Manager
- **npm only** — not bun, not yarn, not pnpm

### Styling
- **Mobile-first** — Tailwind breakpoints: base (mobile) → `sm:` → `md:` → `lg:` → `xl:`
- **Touch targets** — minimum 44px on interactive elements
- **Test at** 375px, 768px, and 1024px+

### Logging
- **Pino structured logging** — never `console.log` or `console.warn` in production code
- Exceptions: test files and build scripts

---

## 3. Commit & PR Requirements

### Commit Message Format
```
Add: [what] for [why]
Fix: [what was broken] causing [impact]
Refactor: [what changed] to improve [benefit]
```

### Testing
- Every feature or bug fix must include corresponding tests
- Tests run via `npm test` (Vitest)
- CI enforces: type checking, test suite, dependency audit, and secret scanning on every push
- A failing CI pipeline blocks the merge

### Dependencies
- All new dependencies must be justified — minimize third-party packages to reduce attack surface and bundle size
- Run `npm audit` after adding any dependency
- No packages with known high/critical vulnerabilities

---

## 4. Locked Files

The following files are a proven A-grade background removal recipe and have been accidentally broken 6+ times by well-meaning refactors. **Do not modify** unless explicitly working on CleanEdge or background removal quality:

- `src/lib/agents/background-removal/agents/refine-edges.ts`
- `src/lib/agents/background-removal/agents/jewelry-specialist.ts`
- `src/lib/agents/background-removal/engines/jewelry-engine.ts`
- `src/lib/agents/background-removal/utils/edge-detection.ts`
- `src/lib/utils/shadow.ts`

Regression guard tests in `refine-edges.test.ts` will catch unauthorized changes in CI.

---

## 5. API Provider Policy

- **Never use Photoroom** — direct competitor
- **Image generation:** Google Gemini 3 (Imagen)
- **Background removal:** Replicate RMBG v1.4 or fal.ai Bria RMBG 2.0
- **Text generation:** Anthropic Claude
- **Vision analysis:** Google Gemini 2.5 Flash
