# Student Study Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable local PDF, Markdown, and text study packs that ground the
voice tutor and Canvas worker with source provenance.

**Architecture:** A focused study-pack repository normalizes uploads into
page- or heading-aware chunks and searches them locally with MiniSearch.
Sessions reference an optional pack ID. Realtime tools retrieve canonical
passages, while Canvas delegation resolves approved chunk IDs server-side.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, UnPDF,
`mdast-util-from-markdown`, `mdast-util-to-string`, MiniSearch, Vitest, and
Playwright.

## Global Constraints

- Keep all learning material and indexes local under `.chalkpilot`.
- Support PDF, `.md`, `.markdown`, `.txt`, and `text/plain` only.
- Limit packs to 20 sources, files to 20 MiB, and PDFs to 500 pages.
- Do not add OCR, embeddings, a vector database, authentication, or tenants.
- Keep new source files below 300 lines.
- Preserve existing sessions and setup behavior when no pack is selected.
- Never trust filenames as filesystem paths.

---

### Task 1: Study-pack domain, parsing, persistence, and search

**Files:**
- Create: `src/features/study-pack/schema.ts`
- Create: `src/features/study-pack/chunking.ts`
- Create: `src/features/study-pack/parsers.ts`
- Create: `src/features/study-pack/paths.ts`
- Create: `src/features/study-pack/repository.ts`
- Create: `src/features/study-pack/search.ts`
- Create: focused `*.test.ts` files beside each unit
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces:
  `createStudyPackRepository(root): StudyPackRepository`,
  `parseStudySource(input): Promise<ParsedStudySource>`, and
  `searchStudyChunks(chunks, query, limit): StudySearchHit[]`.

- [ ] Add failing schema and chunking tests proving identifier validation,
      page/heading locators, stable ordering, and bounded chunk length.
- [ ] Run
      `npm test -- src/features/study-pack/schema.test.ts src/features/study-pack/chunking.test.ts`;
      expect failures because the modules do not exist.
- [ ] Implement Zod schemas for pack, source, chunk, outline, search request,
      search hit, and passage response.
- [ ] Implement deterministic paragraph-aware chunking with a 1,600-character
      target and canonical locators.
- [ ] Add failing parser tests using a generated two-page PDF, nested Markdown
      headings, plain text paragraphs, and an empty/scanned-like PDF.
- [ ] Install:

```bash
npm install unpdf mdast-util-from-markdown mdast-util-to-string minisearch
```

- [ ] Implement PDF, Markdown, and text parsers. Reject unsupported types,
      invalid UTF-8, PDFs over 500 pages, and PDFs without meaningful text.
- [ ] Add failing repository tests for atomic creation, upload rollback,
      listing, source limits, canonical chunk lookup, and original-file storage.
- [ ] Implement generated-ID paths, atomic manifests, per-source JSONL chunks,
      and safe cleanup after failed ingestion.
- [ ] Add a failing search test where a rare course phrase outranks unrelated
      passages while preserving page provenance.
- [ ] Implement bounded MiniSearch indexing per query and neighboring-passage
      reads.
- [ ] Run `npm test -- src/features/study-pack`; expect all study-pack tests to
      pass.
- [ ] Commit:

```bash
git add package.json package-lock.json src/features/study-pack
git commit -m "feat(context): add local study pack repository"
```

### Task 2: Study-pack and session APIs

**Files:**
- Create: `src/features/study-pack/api.ts`
- Create: `src/features/study-pack/default-repository.ts`
- Create: `src/features/study-pack/api.test.ts`
- Create: `src/app/api/study-packs/route.ts`
- Create: `src/app/api/study-packs/[packId]/route.ts`
- Create: `src/app/api/study-packs/[packId]/sources/route.ts`
- Create: `src/app/api/sessions/[sessionId]/study-pack/route.ts`
- Create: `src/app/api/sessions/[sessionId]/study-pack/search/route.ts`
- Create:
  `src/app/api/sessions/[sessionId]/study-pack/passages/[chunkId]/route.ts`
- Modify: `src/features/workspace/schema.ts`
- Modify: `src/features/workspace/repository.ts`
- Modify: `src/features/workspace/api.ts`
- Modify: `src/app/api/sessions/route.ts`
- Modify: corresponding workspace tests

**Interfaces:**
- Consumes: `StudyPackRepository`.
- Produces: session records with `studyPackId: string | null` and the HTTP
  contracts described in the design.

- [ ] Write failing workspace tests proving old session JSON defaults to a null
      pack and new sessions persist a requested pack ID.
- [ ] Extend `sessionRecordSchema` and `createSession({ studyPackId })` without
      breaking no-body session creation.
- [ ] Write failing API tests for create/list/read packs, multipart source
      upload, `400/404/413/422` errors, session-bound outline/search/passage
      reads, and cross-pack chunk rejection.
- [ ] Implement the study-pack API adapter and route files. Parse each request
      with Zod before calling a repository.
- [ ] Change session creation to validate a supplied pack before persisting its
      ID.
- [ ] Run:

```bash
npm test -- src/features/study-pack/api.test.ts src/features/workspace
```

Expected: all tests pass.

- [ ] Commit:

```bash
git add src/app/api src/features/study-pack src/features/workspace
git commit -m "feat(context): expose study pack session APIs"
```

### Task 3: Reusable study-pack setup stage

**Files:**
- Create: `src/features/study-pack/client.ts`
- Create: `src/components/setup/study-pack-step.tsx`
- Create: `src/components/setup/study-pack-step.test.tsx`
- Modify: `src/features/setup/setup-machine.ts`
- Modify: `src/features/setup/setup-machine.test.ts`
- Modify: `src/components/setup/setup-flow.tsx`
- Modify: `src/components/setup/setup-stage.tsx` only if required for the new
  first stage

**Interfaces:**
- Produces:
  `StudyPackClient.list/create/upload/read` and
  `StudyPackStep({ selectedId, onSelect, onContinue })`.
- Passes the selected pack ID to `POST /api/sessions`.

- [ ] Write failing setup-reducer tests for the new first `context` step,
      select, skip, forward, and back transitions.
- [ ] Add the context state and actions while leaving `setupReady` independent
      of a pack selection.
- [ ] Write failing component tests for an empty library, creating a pack,
      uploading accepted files, rejecting unsupported files visibly, selecting
      an existing pack, skipping context, and retrying a failed request.
- [ ] Implement the typed browser client and a minimal study-pack step with one
      clear primary action.
- [ ] Keep `setup-flow.tsx` below 300 lines by moving all pack loading and upload
      behavior into the new component/client.
- [ ] Update session creation to send either `{ studyPackId }` or
      `{ studyPackId: null }`.
- [ ] Run:

```bash
npm test -- src/features/setup src/components/setup/study-pack-step.test.tsx
```

Expected: all tests pass.

- [ ] Commit:

```bash
git add src/features/setup src/features/study-pack/client.ts src/components/setup
git commit -m "feat(setup): add reusable study pack stage"
```

### Task 4: Course-first Realtime retrieval tools

**Files:**
- Create: `src/features/study-pack/realtime-tools.ts`
- Create: `src/features/study-pack/realtime-tools.test.ts`
- Modify: `src/features/realtime/tools.ts`
- Modify: `src/features/realtime/instructions.ts`
- Modify: `src/features/realtime/openai-session.ts`
- Modify: `src/features/realtime/session.ts`
- Modify: `src/components/session/session-controller.tsx`
- Modify: related Realtime tests

**Interfaces:**
- Produces `createStudyPackTools({ sessionId, fetcher })`.
- Extends `CanvasDelegationInput` with `sourceChunkIds?: string[]`.
- Passes `{ title, sources }` into the Realtime instruction builder.

- [ ] Write failing action tests for outline, search, and passage endpoints,
      including provenance and a bounded generic error.
- [ ] Implement the three study-pack tools in a separate file and spread them
      into the existing tool array.
- [ ] Write failing instruction tests for course-first search, explicit
      supplemental-context wording, and prohibition on unsupported source
      claims.
- [ ] Replace the static-only prompt with
      `buildChalkPilotInstructions(studyPack?)` while preserving the exported
      base instructions.
- [ ] Thread the selected pack summary from setup through `SessionController`
      into `createOpenAiSession`.
- [ ] Extend delegation parsing to accept at most five canonical chunk IDs.
- [ ] Run:

```bash
npm test -- src/features/study-pack/realtime-tools.test.ts src/features/realtime src/components/session
```

Expected: all tests pass.

- [ ] Commit:

```bash
git add src/features/study-pack src/features/realtime src/components/session
git commit -m "feat(tutor): ground sessions in selected study packs"
```

### Task 5: Grounded Canvas citations

**Files:**
- Modify: `src/features/workspace/schema.ts`
- Modify: `src/components/canvas/canvas-section.tsx`
- Create: `src/components/canvas/source-citations.tsx`
- Modify: `src/components/canvas/presentation-canvas.test.tsx`
- Modify: `src/features/canvas-worker/schema.ts`
- Modify: `src/features/canvas-worker/service.ts`
- Modify: `src/features/canvas-worker/agent.ts`
- Modify: `src/features/canvas-worker/canvas-job-actions.ts`
- Modify: focused Canvas worker tests
- Modify: `src/app/api/sessions/[sessionId]/canvas-jobs/route.ts`

**Interfaces:**
- Adds optional `citations: SourceCitation[]` to every typed canvas section.
- Resolves `sourceChunkIds` into canonical `StudyEvidence[]` before model work.
- Rejects any model citation outside that evidence set.

- [ ] Write failing schema/rendering tests for a compact `Source: title,
      locator` footer and backward-compatible uncited sections.
- [ ] Add the bounded citation schema and renderer.
- [ ] Write failing Canvas action tests proving canonical citations succeed and
      invented chunk/source combinations fail.
- [ ] Resolve requested chunks from the session-selected pack in the worker
      service and pass canonical evidence into the agent.
- [ ] Add `search_study_pack` and `read_study_passage` evidence to the Canvas
      worker message and require citations when evidence is supplied.
- [ ] Validate citations before the one allowed upsert.
- [ ] Run:

```bash
npm test -- src/components/canvas src/features/canvas-worker
```

Expected: all tests pass.

- [ ] Commit:

```bash
git add src/components/canvas src/features/canvas-worker src/features/workspace src/app/api
git commit -m "feat(canvas): cite grounded study material"
```

### Task 6: End-to-end verification and documentation

**Files:**
- Modify: `e2e/setup.spec.ts`
- Modify: `README.md`
- Modify: `.env.example` only if a new environment variable was introduced

**Interfaces:**
- Verifies all prior task contracts together without adding a production-only
  test endpoint.

- [ ] Add an E2E fixture that creates a pack, uploads a distinctive text source,
      selects it in setup, finishes the existing device flow, and confirms the
      session search endpoint returns that source and locator.
- [ ] Update README with the study-pack flow, supported formats and limits,
      local storage layout, course-first policy, and no-OCR limitation.
- [ ] Run focused E2E:

```bash
npm run test:e2e -- e2e/setup.spec.ts
```

Expected: all non-credential-gated setup tests pass.

- [ ] Run the full verification:

```bash
npm run check
npm run test:e2e
git diff --check
```

Expected: formatting, lint, typecheck, unit tests, production build, and all
non-credential-gated E2E tests pass.

- [ ] Commit:

```bash
git add e2e/setup.spec.ts README.md
git commit -m "docs: document student study packs"
```

- [ ] Push the completed `main` branch:

```bash
git push origin main
```
