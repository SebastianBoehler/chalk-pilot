# ChalkPilot Room Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested local ChalkPilot demo that can select and rectify a room camera, converse through OpenAI Realtime, and update a fullscreen external display.

**Architecture:** One Next.js application hosts setup, controller, display, and small server Route Handlers. Browser-owned modules handle media, board processing, Realtime, and cross-window state; validated server modules persist the local workspace and mint ephemeral OpenAI credentials.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, OpenAI Agents SDK, OpenCV.js, Zod, React Markdown, KaTeX, Mermaid, Vitest, Testing Library, Playwright.

## Global Constraints

- Use npm with a committed lockfile and Node.js 22 or newer.
- Keep every maintained source file under the 300-line soft limit.
- Use Apache-2.0 and do not copy code from Tübingen's AGPL `ai-tutor`.
- Keep `OPENAI_API_KEY` server-only and `.chalkpilot/` gitignored.
- Persist transcripts and learner memory, but never raw audio, camera video, or board images.
- Do not add LiveKit, Electron, authentication, a database, mock product data, or provider fallbacks.
- One primary action per setup step; operational controls never appear on `/display`.
- Write each behavior test first, run it red, implement minimally, and run it green.

---

### Task 1: Open-source application foundation

**Files:**

- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`
- Create: `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`
- Create: `src/test/setup.ts`, `src/app/page.test.tsx`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.gitignore`, `.env.example`, `LICENSE`

**Interfaces:**

- Produces: npm scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `check`
- Produces: root page redirecting to `/setup`

- [ ] **Step 1: Add toolchain configuration**

Use exact scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Install current compatible releases and commit `package-lock.json`.

- [ ] **Step 2: Write and run the failing root-page test**

```tsx
render(<Home />);
expect(mockRedirect).toHaveBeenCalledWith("/setup");
```

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because `src/app/page.tsx` does not exist.

- [ ] **Step 3: Implement the minimal app shell**

Create a server `Home` component that calls `redirect("/setup")`, a metadata-bearing
root layout, Tailwind import, semantic color tokens, focus styles, and reduced-motion
rules.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/app/page.test.tsx && npm run lint && npm run typecheck`

Expected: all commands exit 0.

Commit: `chore: initialize ChalkPilot web application`

### Task 2: Workspace, canvas, and learner-memory core

**Files:**

- Create: `src/features/workspace/schema.ts`, `paths.ts`, `repository.ts`
- Create: `src/features/workspace/repository.test.ts`
- Create: `src/app/api/sessions/route.ts`
- Create: `src/app/api/sessions/[sessionId]/canvas/route.ts`
- Create: `src/app/api/sessions/[sessionId]/memory/route.ts`

**Interfaces:**

- Produces: `createSession(): Promise<SessionRecord>`
- Produces: `readCanvas(id): Promise<CanvasState>`
- Produces: `appendSection(id, input): Promise<CanvasState>`
- Produces: `updateSection(id, input): Promise<CanvasState>`
- Produces: `rememberLearner(input): Promise<LearnerMemory>`
- Produces: `appendTranscript(id, turn): Promise<void>`
- Produces: `appendEvent(id, event): Promise<void>`

- [ ] **Step 1: Write repository contract tests**

Test a real temporary directory:

```ts
const repository = createWorkspaceRepository(tempRoot);
const session = await repository.createSession();
await repository.appendSection(session.id, {
  id: "derivative-hint",
  kind: "markdown",
  title: "Try this",
  content: "Differentiate the outer function first.",
});
expect((await repository.readCanvas(session.id)).order).toEqual([
  "derivative-hint",
]);
```

Also assert duplicate IDs, unknown sessions, `../` identifiers, invalid media URLs,
concurrent writes are rejected or serialized, and JSONL records never contain image
or raw-audio fields.

- [ ] **Step 2: Run tests red**

Run: `npm test -- src/features/workspace/repository.test.ts`

Expected: FAIL because the repository modules do not exist.

- [ ] **Step 3: Implement schemas and filesystem repository**

Use Zod discriminated unions for `markdown`, `math`, `mermaid`, `image`, and
`youtube` sections. Store section Markdown separately from `state.json`, use
`crypto.randomUUID()`, validate every identifier, and write via temporary file plus
atomic rename. Append transcript and evidence events through the same per-session
write queue.

- [ ] **Step 4: Implement thin Route Handlers**

Handlers parse Zod input, call the repository, return explicit JSON errors, and set
`export const runtime = "nodejs"`.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/features/workspace/repository.test.ts && npm run typecheck`

Commit: `feat(workspace): persist sessions and learning canvas`

### Task 3: Display protocol and presentation canvas

**Files:**

- Create: `src/features/display/protocol.ts`, `display-reducer.ts`
- Create: `src/features/display/display-reducer.test.ts`
- Create: `src/features/display/use-display-channel.ts`
- Create: `src/components/canvas/canvas-section.tsx`, `presentation-canvas.tsx`
- Create: `src/components/canvas/presentation-canvas.test.tsx`
- Create: `src/app/display/page.tsx`

**Interfaces:**

- Produces: `DisplayMessage` version `1`
- Produces: `reduceDisplayState(state, message): DisplayState`
- Produces: `useDisplayChannel(role, state?)`

- [ ] **Step 1: Write reducer and renderer tests**

```ts
expect(
  reduceDisplayState(emptyDisplayState, {
    version: 1,
    type: "snapshot",
    payload: { canvas, agentState: "listening" },
  }).canvas,
).toEqual(canvas);
```

Render each safe block type and assert a script-bearing Markdown link or invalid
YouTube host is not emitted as executable content.

- [ ] **Step 2: Run tests red**

Run: `npm test -- src/features/display src/components/canvas`

Expected: FAIL because protocol and renderer modules do not exist.

- [ ] **Step 3: Implement display synchronization and rendering**

Use `BroadcastChannel("chalkpilot-display-v1")`. The display sends `ready`; the
controller answers with a full snapshot. Dynamically load Mermaid with
`securityLevel: "strict"` and render mathematics through KaTeX.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/display src/components/canvas && npm run typecheck`

Commit: `feat(display): add synchronized presentation canvas`

### Task 4: Camera calibration and bounded board observation

**Files:**

- Create: `src/features/board/types.ts`, `geometry.ts`, `change-detector.ts`
- Create: `src/features/board/geometry.test.ts`, `change-detector.test.ts`
- Create: `src/features/board/camera.ts`, `frame.ts`
- Create: `src/features/board/opencv.worker.ts`, `worker-client.ts`
- Create: `src/components/setup/camera-step.tsx`, `calibration-step.tsx`
- Create: `src/components/setup/calibration-step.test.tsx`

**Interfaces:**

- Produces: `orderCorners(points): BoardCorners`
- Produces: `measureBoardChange(previous, current): number`
- Produces: `BoardWorkerClient.detect(imageData): Promise<DetectionResult>`
- Produces: `BoardWorkerClient.warp(imageData, corners): Promise<ImageData>`

- [ ] **Step 1: Write pure board tests**

Assert corner ordering for shuffled points, rejection of duplicate or out-of-bounds
corners, zero difference for identical grayscale frames, material difference for
changed writing, and debounce state that requires two stable changed samples.

- [ ] **Step 2: Run tests red**

Run: `npm test -- src/features/board`

Expected: FAIL because board modules do not exist.

- [ ] **Step 3: Implement pure geometry and change detection**

Use normalized corner coordinates and a 96x54 grayscale sample. Keep the default
material threshold in one exported constant and return the measured score to the UI.

- [ ] **Step 4: Implement camera and worker boundary**

Request video with ideal 3840x2160 constraints, enumerate cameras only after
permission, never silently switch devices, and stop every track on cleanup. Load
`@techstark/opencv-js` only inside the worker; use contours for the proposal and
`getPerspectiveTransform` plus `warpPerspective` for the confirmed crop.

- [ ] **Step 5: Implement and test calibration controls**

Render proposal corners as keyboard-accessible draggable controls, corrected preview,
explicit confirmation, stale-crop warning, and recalibration.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/features/board src/components/setup/calibration-step.test.tsx && npm run typecheck`

Commit: `feat(board): calibrate and observe the physical board`

### Task 5: OpenAI Realtime agent and tools

**Files:**

- Create: `src/features/realtime/client-secret.ts`, `client-secret.test.ts`
- Create: `src/app/api/realtime-token/route.ts`
- Create: `src/features/realtime/instructions.ts`, `tools.ts`, `session.ts`
- Create: `src/features/realtime/tools.test.ts`, `session.test.ts`

**Interfaces:**

- Produces: `createClientSecret(apiKey, fetcher): Promise<string>`
- Produces: `createChalkPilotAgent(toolContext): RealtimeAgent`
- Produces: `ChalkPilotSession.connect(ephemeralKey): Promise<void>`
- Produces: `ChalkPilotSession.addBoardImage(dataUrl, triggerResponse): void`

- [ ] **Step 1: Write token and tool tests**

Inject a recording `fetcher` and assert the server sends model
`gpt-realtime-2.1`, voice `marin`, and never returns the standard API key. Execute
canvas tools against a real temporary workspace and assert actual file mutations.

- [ ] **Step 2: Run tests red**

Run: `npm test -- src/features/realtime`

Expected: FAIL because realtime modules do not exist.

- [ ] **Step 3: Implement server-side client-secret creation**

POST to `https://api.openai.com/v1/realtime/client_secrets` with a server-only
Bearer key and return only the `ek_` value. Missing credentials and upstream
non-2xx responses become explicit sanitized errors.

- [ ] **Step 4: Implement the browser Realtime adapter**

Create `RealtimeAgent` and `RealtimeSession`, register the `inspect_board`,
`set_focus`, `append_section`, `update_section`, and `remember_learner` Zod tools,
connect with the ephemeral key, map connected/disconnected/history events, and add
corrected board data URLs using:

```ts
session.addImage(boardDataUrl, { triggerResponse: false });
```

Configure semantic VAD to preserve turn detection while disabling automatic response
creation. At finalized user turns, attach a dirty board and then create the response;
manual inspection uses `triggerResponse: true`. Append transcript and tool evidence
events without persisting image data.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/features/realtime && npm run typecheck`

Commit: `feat(agent): connect the room-aware realtime tutor`

### Task 6: Setup and live-session vertical slice

**Files:**

- Create: `src/features/setup/setup-machine.ts`, `setup-machine.test.ts`
- Create: `src/features/session/session-machine.ts`, `session-machine.test.ts`
- Create: `src/components/ui/button.tsx`, `status-pill.tsx`, `error-panel.tsx`
- Create: `src/components/setup/setup-flow.tsx`
- Create: `src/components/session/session-controller.tsx`
- Create: `src/app/setup/page.tsx`, `src/app/session/page.tsx`

**Interfaces:**

- Consumes: board worker, workspace routes, display channel, Realtime adapter
- Produces: complete four-step setup and controller state machines

- [ ] **Step 1: Write state-machine tests**

Assert that setup cannot advance without camera permission, confirmed calibration,
connected display, and token readiness. Assert camera loss pauses board sending,
display loss exposes reopen, and Realtime loss preserves the local session.

- [ ] **Step 2: Run tests red**

Run: `npm test -- src/features/setup src/features/session`

Expected: FAIL because state machines do not exist.

- [ ] **Step 3: Implement the state machines and pages**

Keep browser objects outside serializable reducers. The UI exposes one primary
action, visible privacy status, compact controller preview, collapsed transcript,
manual inspect, recalibrate, reopen display, pause/resume, and end session.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Commit: `feat: deliver the ChalkPilot room-learning flow`

### Task 7: End-to-end readiness, documentation, and public release

**Files:**

- Create: `playwright.config.ts`, `e2e/setup.spec.ts`, `e2e/display.spec.ts`
- Create: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Create: `.github/workflows/ci.yml`
- Modify: `docs/superpowers/specs/2026-07-23-chalk-pilot-mvp-design.md`

**Interfaces:**

- Produces: documented fresh-clone path and reproducible room checklist

- [ ] **Step 1: Write and run failing browser flows**

Use Chromium's fake media flags with a committed non-sensitive board fixture. Test
camera permission, calibration confirmation, display popup handshake, session
readiness, visible errors, and canvas updates.

Run: `npm run test:e2e`

Expected: FAIL on any still-missing integration.

- [ ] **Step 2: Fix only observed integration gaps**

For each failure, add the narrowest regression test, watch it fail, implement the
fix, and rerun the affected test before continuing.

- [ ] **Step 3: Complete open-source documentation**

Document prerequisites, `npm install`, `.env.local`, `npm run dev`, room setup,
privacy boundaries, camera troubleshooting, external-display steps, architecture,
test commands, license, and the exact two-turn smoke script.

- [ ] **Step 4: Run full automated verification**

Run: `npm ci && npm run check && npm run test:e2e && npm audit --audit-level=high`

Expected: every command exits 0 with no high-severity vulnerabilities.

- [ ] **Step 5: Run live and Browser verification**

Start the production build locally with a real OpenAI key. In the explicitly
requested in-app Browser, verify setup, permission/error UI, camera enumeration if
available, calibration, popup display synchronization, responsive layout, session
connection, one spoken or typed diagnostic turn, one board image submission, and
one canvas tool mutation. Record exact hardware or permission limits.

- [ ] **Step 6: Commit and publish**

Commit: `docs: prepare ChalkPilot for the first room trial`

After all checks pass, create a public GitHub repository named `chalk-pilot`, push
`main`, and verify the public README and CI status.
