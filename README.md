# ProcureScope — SAM Project RAG Studio

> 2026-08-30 extension: authenticated `POST /api/notifications/sam-alerts` now evaluates opportunity subscriptions against SAM notices using keyword, agency, NAICS, value and deadline criteria. Matching is deterministic, creates stable alert IDs, and never makes an automatic bid/no-bid decision. External scheduling and delivery require deployment configuration.

ProcureScope is a separate, end-to-end SAM.gov opportunity-to-submission workspace. Every opportunity owns a private RAG namespace, authoritative sources, requirement matrix, capture plan, proposal history, reviews, and release controls. It does not depend on or modify `government_contracts_v2`.

## Product behavior

- Every project is created with an initial SAM metadata source, so no project exists without RAG evidence.
- Retrieval authorizes the owner and filters by project namespace before ranking.
- Solicitation files, amendments, Q&A, SOW/PWS/SOO, pricing instructions, and evaluation criteria can be indexed.
- PDF pages preserve page-level citation locators. DOCX and text-based files are also supported.
- Non-AI evidence search, requirement extraction, evidence outlines, audit history, CSV export, and DOCX export work without an AI provider.
- SAM.gov discovery supports filters, reusable watchlists, exact-notice import, deliberate resynchronization, change history, and independently retryable attachments.
- Document workflows include original-file storage, preview, page locators, text-table detection, download, protected deletion, deterministic reprocessing, amendment precedence, and optional OpenRouter semantic embeddings.
- A separately governed company library holds profiles, capabilities, past performance, resumes, certifications, and reusable proposal templates. Only verified, explicitly AI-shareable company records are sent to OpenRouter.
- Sixteen governed AI actions cover bid/no-bid, eligibility, opportunity fit, win themes, requirements, evaluation mapping, amendment impact, risk, capture strategy, clarification questions, pricing, section drafting, color-team review, citation verification, executive summary, and controlled rewrite.
- Every AI action is schema-validated, citation-checked, persisted with its evidence IDs and model metadata, professionally rendered, and advisory until a human approves it.
- Proposal generation runs in a background worker, is section-based and resumable, and never requires the browser to remain open. “Open saved draft” never calls AI.
- Proposal content is editable and versioned, with comments, assignments, version comparison APIs, review stages, approval invalidation, deterministic pricing, submission checklists, package blockers, manifests, and outcome records.
- Workspace roles, notifications, global/project search, durable jobs, and material-action audit history are built in.
- Every non-AI business collection opens a centered record workspace with complete details, guarded editing, explicit deletion confirmation, and Cancel/Save controls. Provenance-critical system records open read-only with the protection reason visible.
- Generated content is never inserted into the authoritative project RAG.

## Local setup

1. Copy `.env.example` to `.env.local` or configure equivalent local secrets.
2. Add `SAM_GOV_API_KEY` for live SAM.gov import.
3. Add `OPENROUTER_API_KEY` for real AI review, governed actions, proposal generation, OCR-ready processing, and semantic embeddings.
4. Optionally set `OPENROUTER_MODEL` and `OPENROUTER_EMBEDDING_MODEL`; the app uses the configured chat model and `openai/text-embedding-3-small` by default for embeddings.
5. Run `./start.sh`.

The app uses Cloudflare D1 for structured state and R2 for original source files. Local Sites development provisions local equivalents automatically.

## Validation

Run `npm run check` for linting, TypeScript validation, unit tests, and the production build.
