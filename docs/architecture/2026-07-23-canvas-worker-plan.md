# Canvas Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add an asynchronous, provider-selectable canvas specialist beside the
existing OpenAI Realtime tutor.

**Architecture:** The Realtime tool starts a background browser request and
returns a job ID immediately. A server-side Vercel AI SDK agent receives bounded
context and mutates the existing canvas through typed repository actions.

**Tech Stack:** Next.js 16, TypeScript, Zod 4, Vercel AI SDK 7,
`@ai-sdk/openai`, `@openrouter/ai-sdk-provider`, Vitest, Playwright.

## Global Constraints

- Keep the current Realtime voice connection on OpenAI.
- Do not execute model-generated application code.
- Do not silently fall back between providers.
- Keep new source files below 300 lines.
- Preserve the current local persistence and display protocol.

---

### Task 1: Canvas job contracts and actions

**Files:**

- Create: `src/features/canvas-worker/schema.ts`
- Create: `src/features/canvas-worker/actions.ts`
- Create: `src/features/canvas-worker/actions.test.ts`

**Interfaces:**

- Produces: `canvasJobRequestSchema`, `CanvasJobRequest`,
  `createCanvasWorkerActions(repository, sessionId)`.
- Actions: `readCanvas()`, `upsertSection(section)`, and
  `focusSection({ sectionId })`.

- [x] Write a failing test that creates a temporary workspace, upserts a new
      section, upserts the same ID again, focuses it, and asserts one updated
      section remains.
- [x] Run `npm test -- src/features/canvas-worker/actions.test.ts` and confirm
      it fails because the module does not exist.
- [x] Implement the Zod job schemas and minimal repository-backed actions.
- [x] Run the focused test and confirm it passes.

### Task 2: Provider registry and bounded agent

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/features/canvas-worker/provider.ts`
- Create: `src/features/canvas-worker/provider.test.ts`
- Create: `src/features/canvas-worker/agent.ts`

**Interfaces:**

- Consumes: the actions and request schema from Task 1.
- Produces: `createCanvasModel(env)` and
  `runCanvasAgent({ model, request, canvas, actions })`.

- [x] Write failing provider tests for the OpenAI default, explicit OpenRouter,
      missing credentials, and unsupported providers.
- [x] Run the focused provider test and confirm the missing module failure.
- [x] Install `ai@^7`, `@ai-sdk/openai@^4`, and
      `@openrouter/ai-sdk-provider@^3`.
- [x] Implement provider selection with explicit validation. Configure
      OpenRouter with `sort: "throughput"`, `require_parameters: true`,
      `data_collection: "deny"`, and `zdr: true`.
- [x] Implement a maximum six-step `ToolLoopAgent` with only read, upsert, and
      focus tools and a concise structured completion summary.
- [x] Run the provider tests and `npm run typecheck`.

### Task 3: Serialized worker API

**Files:**

- Create: `src/features/canvas-worker/queue.ts`
- Create: `src/features/canvas-worker/queue.test.ts`
- Create: `src/features/canvas-worker/service.ts`
- Create: `src/features/canvas-worker/api.ts`
- Create: `src/features/canvas-worker/api.test.ts`
- Create: `src/app/api/sessions/[sessionId]/canvas-jobs/route.ts`

**Interfaces:**

- Produces: `createCanvasWorkerService(dependencies)` and
  `createCanvasWorkerApi(service)`.
- Route response:
  `{ jobId: string, summary: string, canvas: CanvasState }`.

- [x] Write a failing queue test proving two jobs for one session finish in
      order while jobs for different sessions may overlap.
- [x] Implement the smallest keyed promise queue and make the test pass.
- [x] Write failing API tests for a successful injected worker, invalid input,
      missing session, and provider failure.
- [x] Implement the service, error mapping, and Node.js route.
- [x] Run the focused queue and API tests.

### Task 4: Asynchronous Realtime delegation

**Files:**

- Modify: `src/features/realtime/tools.ts`
- Modify: `src/features/realtime/tools.test.ts`
- Modify: `src/features/realtime/session.ts`
- Modify: `src/features/realtime/session.test.ts`
- Modify: `src/features/realtime/instructions.ts`

**Interfaces:**

- Adds: `delegate_canvas_task`.
- Adds callbacks:
  `onCanvasJobState(state)` and `onCanvasJobError(message)`.

- [x] Write failing tool tests proving delegation returns a job ID and direct
      append/update tools are no longer exposed to the voice agent.
- [x] Write a failing session test proving the tool returns before the worker
      request completes, then applies the returned canvas and adds a private
      completion item without creating a spoken response.
- [x] Implement background job dispatch, completion context, and independent
      error reporting.
- [x] Update the tutor instructions to delegate durable artifacts.
- [x] Run the realtime tool and session tests.

### Task 5: Visible worker state and documentation

**Files:**

- Modify: `src/components/session/session-controller.tsx`
- Modify: `src/components/session/learning-workspace.tsx`
- Modify: `src/components/session/learning-workspace.test.tsx`
- Modify: `README.md`

**Interfaces:**

- Adds a `Canvas worker` status pill and concise sidebar status/error copy.

- [x] Write a failing component test that renders the `building` state and
      expects `Canvas worker` plus `Building visual context…`.
- [x] Thread worker state from the session controller into the workspace and
      make the test pass.
- [x] Document provider configuration, asynchronous behavior, and the updated
      privacy boundary.
- [x] Run `npm test`.

### Task 6: End-to-end verification

**Files:**

- Modify: `e2e/room-flow.spec.ts` only if the user-visible status needs browser
  coverage.

- [x] Run `npm run format`.
- [x] Run `npm run check` under Node 24.
- [x] Run `npm run test:e2e`.
- [x] Start the worktree app on a non-conflicting port and verify one live
      canvas-worker job through the browser flow.
- [x] Review the diff for generated files, credentials, and files over 300
      lines before finishing the branch.
