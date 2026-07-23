# Typed Learning Artifacts Implementation Plan

**Goal:** Replace prose-shaped canvas output with safe, visibly distinct
learning artifacts, eliminate Mermaid's leaked global error page, and make home
Continuity Camera use a first-class setup path.

**Architecture:** Keep the existing voice-agent to canvas-worker delegation.
The worker submits validated section data to the workspace repository; trusted
React renderers turn that data into visual artifacts. Text sections remain
Markdown files, structured artifacts become JSON files, and the existing
display protocol continues to carry the complete validated canvas state. No
model-authored HTML, JavaScript, CSS, React, or SVG is executed.

**Stack:** Next.js 16, React 19, TypeScript, Zod, Vercel AI SDK, Tailwind CSS,
Vitest, Testing Library, Playwright, Mermaid 11.

## Task 1: Keep camera selection generic and presenter tracking optional

**Files:**

- Modify: `src/components/setup/camera-step.tsx`
- Modify: `src/components/setup/camera-step.test.tsx`

**Steps:**

- [ ] Add a failing component test proving the generic heading, camera-source
      guidance, and presenter-tracking checkbox are visible.
- [ ] Rename the heading to “Connect a camera”.
- [ ] Let the browser camera picker remain the source of truth: a room camera,
      webcam, or iPhone Continuity Camera is simply a selectable system camera.
- [ ] Replace exposed “room-wide” and “board-focused” categories with one
      “Track a presenter” checkbox, disabled by default.
- [ ] When tracking is disabled, use the fixed camera as the speaker recording;
      when enabled, keep the existing presenter-confirmation and tracking flow.
- [ ] Make the device-selection hint neutral rather than always asking for the
      rear room camera.
- [ ] Run
      `npm test -- src/components/setup/camera-step.test.tsx`.

## Task 2: Contain Mermaid parse and render failures

**Files:**

- Modify: `src/components/canvas/mermaid-block.tsx`
- Create: `src/components/canvas/mermaid-block.test.tsx`

**Steps:**

- [ ] Add failing tests proving invalid Mermaid never leaves a global
      `#d<render-id>` error node and that invalid-to-valid updates recover.
- [ ] Reset local SVG and error state whenever the source changes.
- [ ] Preflight with `mermaid.parse(source, { suppressErrors: true })` and show
      the local section error without calling `render` when parsing returns false.
- [ ] Remove only Mermaid's exact temporary node for this render ID when a
      render rejects or the effect is cleaned up.
- [ ] Preserve `securityLevel: "strict"` and keep the error isolated inside the
      artifact card.
- [ ] Run
      `npm test -- src/components/canvas/mermaid-block.test.tsx`.

## Task 3: Define the structured artifact contract

**Files:**

- Create: `src/features/workspace/artifact-schemas.ts`
- Modify: `src/features/workspace/schema.ts`
- Create: `src/features/workspace/artifact-schemas.test.ts`

**Steps:**

- [ ] Write schema tests for valid and invalid `chart`, `comparison`,
      `sequence`, and `checkpoint` sections.
- [ ] Define strict bounded schemas:
  - `chart`: `line | bar | scatter`, one to four series, one to 100 finite
    points per series, labels, and bounded annotations;
  - `comparison`: two to four columns with short summaries, points, and
    semantic emphasis;
  - `sequence`: two to eight stable steps with a valid active step and reveal
    policy;
  - `checkpoint`: bounded prompt, optional choices/hint/answer/feedback,
    learning mode, state, and explicit reveal booleans.
- [ ] Extend `CanvasSectionInput` and `CanvasSection` as discriminated unions:
      text/media kinds use `content`, structured kinds use `data`.
- [ ] Keep unknown fields rejected so model-authored styling or executable
      payloads cannot cross the boundary.
- [ ] Run
      `npm test -- src/features/workspace/artifact-schemas.test.ts`.

## Task 4: Persist structured artifacts without breaking existing sessions

**Files:**

- Create: `src/features/workspace/section-storage.ts`
- Modify: `src/features/workspace/repository.ts`
- Modify: `src/features/workspace/repository.test.ts`
- Modify: `src/features/workspace/api.ts`
- Modify: `src/features/workspace/api.test.ts`
- Modify: `src/features/canvas-worker/actions.ts`
- Modify: `src/features/canvas-worker/actions.test.ts`

**Steps:**

- [ ] Add failing repository tests proving legacy text sections still read from
      `<id>.md` and structured sections append/update through `<id>.json`.
- [ ] Add a focused storage helper that chooses `.md` or `.json` from the
      validated kind and serializes only the section payload.
- [ ] Update repository reads and atomic writes to use that helper.
- [ ] Replace the text-only partial update input with a full validated section
      upsert/update contract so a structured artifact can change state safely.
- [ ] Extend API and canvas-worker action tests for structured append and
      update while preserving existing response shapes.
- [ ] Run
      `npm test -- src/features/workspace/repository.test.ts src/features/workspace/api.test.ts src/features/canvas-worker/actions.test.ts`.

## Task 5: Render four genuinely different trusted artifact types

**Files:**

- Create: `src/components/canvas/artifact-error-boundary.tsx`
- Create: `src/components/canvas/chart-artifact.tsx`
- Create: `src/components/canvas/comparison-artifact.tsx`
- Create: `src/components/canvas/sequence-artifact.tsx`
- Create: `src/components/canvas/checkpoint-artifact.tsx`
- Create: `src/components/canvas/structured-artifacts.test.tsx`
- Modify: `src/components/canvas/canvas-section.tsx`
- Modify: `src/components/canvas/presentation-canvas.test.tsx`

**Steps:**

- [ ] Add failing accessible-rendering tests for each artifact and progressive
      disclosure states.
- [ ] Render charts with trusted application-generated SVG axes, marks,
      legends, and annotations; never inject model-authored SVG.
- [ ] Render comparisons as an actual responsive matrix with semantic
      emphasis, sequences as a spatial connected progression, and checkpoints as
      a prominent prompt with controlled hint/answer/feedback areas.
- [ ] Isolate unexpected renderer failures to the affected card through an
      error boundary.
- [ ] Register the structured renderers in `CanvasSection` and preserve the
      existing Markdown, math, image, YouTube, and Mermaid paths.
- [ ] Run
      `npm test -- src/components/canvas/structured-artifacts.test.ts src/components/canvas/presentation-canvas.test.ts`.

## Task 6: Teach the canvas worker to choose artifacts for learning impact

**Files:**

- Create: `src/features/canvas-worker/artifact-playbook.ts`
- Create: `src/features/canvas-worker/artifact-playbook.test.ts`
- Modify: `src/features/canvas-worker/agent.ts`
- Modify: `src/features/canvas-worker/agent.test.ts`
- Modify: `src/features/canvas-worker/schema.ts`

**Steps:**

- [ ] Add tests proving the worker receives the full structured tool schema,
      an update-before-append rule, and curated positive and negative examples.
- [ ] Add compact positive examples:
  - tokenization as a spatial sequence with meaningful step content;
  - word/subword/character distinctions as a comparison matrix;
  - embedding coordinates as a real scatter chart;
  - a prediction checkpoint before revealing the answer.
- [ ] Add negative examples that explicitly reject renamed prose cards,
      decorative charts without quantities, duplicate sections, giant text dumps,
      premature answer reveal, invented URLs, and invalid Mermaid.
- [ ] Tell the worker to create or update one focal artifact per job, choose the
      simplest representation that enables the next learner action, and reuse a
      stable ID when the concept already exists.
- [ ] Keep the voice agent responsible for dialogue and the canvas worker
      responsible for durable visual output.
- [ ] Run
      `npm test -- src/features/canvas-worker/artifact-playbook.test.ts src/features/canvas-worker/agent.test.ts`.

## Task 7: Verify display transport, end-to-end creation, and documentation

**Files:**

- Modify: `src/features/display/display-reducer.test.ts`
- Modify: `e2e/session.spec.ts`
- Modify: `README.md`

**Steps:**

- [ ] Add a display-protocol test carrying a structured artifact through a
      snapshot and canvas update.
- [ ] Add an end-to-end fixture that renders at least one real chart, one
      progressive sequence, and one checkpoint without raw HTML execution or a
      Mermaid global error overlay.
- [ ] Document the supported artifact catalog, the explicit HTML/JavaScript
      exclusion, generic browser/system camera selection, and the optional
      presenter-tracking setting.
- [ ] Run the complete Node 24 gate:
      `mise exec node@24 -- npm run check`.
- [ ] Run:
      `mise exec node@24 -- npm run test:e2e`.
- [ ] Start the production build and verify `/setup`, `/session`, `/display`,
      and `/replay` in the in-app browser. Record that physical camera,
      microphone, Continuity Camera, and system-audio permission flows remain
      user-assisted hardware checks.

## Completion Criteria

- Invalid Mermaid produces only a contained card-level error.
- The canvas visibly distinguishes charts, comparisons, sequences, and
  checkpoints from Markdown.
- The worker uses curated learning scenarios and rejects prose disguised as a
  visualization.
- Raw HTML and executable model-authored code remain unsupported.
- Any system camera can feed board calibration; presenter tracking is an
  independent opt-in setting.
- Existing sessions and replay recordings remain readable.
- Node 24 checks and browser-visible routes pass.
