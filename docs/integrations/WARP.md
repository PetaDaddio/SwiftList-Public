# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository focus (current state)
SwiftList is an early-stage “core source” repo for an AI-powered product image automation SaaS.

In this repo today, most “implementation” is expressed as:
- Exported **n8n workflow JSONs** (examples + production candidates)
- A small **Node.js utils** area (not a full Node project yet)
- Product/architecture documentation in `docs/`

## Key locations (big picture)
- `n8n-workflows/examples/`
  - Reference n8n workflows (pattern library) used to learn/borrow node patterns.
- `n8n-workflows/production/`
  - Production workflow exports (currently includes `jarvis-blog-generator-v1.json`).
- `src/utils/structuredLog.js`
  - Standard log function. Produces single-line JSON for parsing by automation (e.g., n8n).
- `src/utils/DIAGNOSTIC_PROMPT.md`
  - System prompt + strict JSON-only output schema for an “infrastructure diagnostician”.
- `src/utils/n8n/Diagnostic_Workflow.json`
  - n8n “Diagnostic Middleware” workflow:
    - Webhook trigger at `POST /critical-alert`
    - Collects evidence + builds a diagnostic prompt
    - Calls Gemini (`GEMINI_API_KEY` via env)
    - Alerts Slack
- `docs/`
  - High-value planning/architecture docs. Start with:
    - `docs/BUILD_PREPARATION_ROADMAP.md` (planned repo structure + upcoming docs)
    - `docs/CTO_TECHNICAL_REVIEW.md` (scaling + DB index recommendations)
    - `docs/session-notes/SESSION_WORKFLOW.md` (how session notes are captured)

## Commonly used commands
### Docker-based diagnostic test runner
- Run:
  ```bash
  ./test_runner.sh
  ```
  This executes:
  ```bash
  docker compose up --build --abort-on-container-exit
  ```

Notes:
- `docker-compose.yml` currently runs `node tests/test_connection_leak.js` inside the container.
- `Dockerfile` expects `package.json` and `package-lock.json`.
- As of the current repo contents, `package.json`, `package-lock.json`, and `tests/` are not present, so the container will fail until those files are added or the Docker configuration is updated.

## Repo-specific rules to follow (from README / CONTRIBUTING)
When generating or modifying code for this repo:
- Access secrets/credentials exclusively via environment variables (`process.env`).
- Use `src/utils/structuredLog.js` for application logging (single-line JSON).
- Keep files/functions small; push orchestration/complexity into n8n workflows instead of large code modules.
- New production code should ship with an adjacent unit test.
- Follow the repository’s conventions:
  - Commit/PR prefixes must start with `FEAT:`, `FIX:`, or `DOCS:`.
  - Minimize and justify new dependencies.
  - Use standard JS conventions noted in `CONTRIBUTING.md` (camelCase, single quotes).

## n8n workflow development expectations (from CLAUDE.md)
- Workflows are developed in n8n (cloud in dev; exported for self-hosted/production later).
- Treat `n8n-workflows/examples/` as reference material; production-ready workflows should include robust error handling and clear inline documentation/comments within the exported workflow JSON.
