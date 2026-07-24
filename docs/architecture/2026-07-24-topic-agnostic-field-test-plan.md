# Topic-Agnostic Field-Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox syntax for tracking.

**Goal:** Add a safe topic-agnostic flow artifact, learning-move routing, and an
accurate field-test preflight without expanding the runtime or session
lifecycle.

**Architecture:** Extend the existing discriminated canvas schema with one
validated data-only artifact and render it through an owned React component.
Keep orchestration in the existing voice/canvas prompts and keep setup
readiness derived from the existing setup state machine.

**Tech stack:** TypeScript, React 19, Next.js 16, Zod 4, Vitest, Testing
Library, Playwright, Tailwind CSS.

## Global constraints

- Artifact selection is based on the learning move, never a subject template.
- Raw HTML, JavaScript, CSS, React, and SVG remain unsupported.
- The flow graph is bounded, acyclic, and fully validated before persistence.
- No new runtime dependency or hidden fallback is allowed.
- Source files should remain below the repository's 300-line soft limit.
- Tests must fail for the missing behavior before production code is changed.

---

### Task 1: Validated flow artifact contract

**Files:**

- Modify: `src/features/workspace/artifact-schemas.test.ts`
- Modify: `src/features/workspace/artifact-schemas.ts`
- Modify: `src/features/workspace/schema.ts`
- Modify: `src/features/workspace/section-storage.test.ts`

**Interfaces:**

- Produces `flowArtifactDataSchema` and `FlowArtifactData`.
- Adds `{ kind: "flow"; data: FlowArtifactData }` to `CanvasSectionInput`.

- [ ] Add a failing schema test that accepts a small directed graph and rejects
      duplicate node IDs, unknown endpoints, self-edges, cycles, excessive
      bounds, and executable fields.
- [ ] Run
      `npm test -- src/features/workspace/artifact-schemas.test.ts src/features/workspace/section-storage.test.ts`
      and confirm the flow imports or parses fail because the contract is
      missing.
- [ ] Implement strict node, edge, and graph schemas plus an acyclic-graph
      refinement. Add flow to input, stored, and hydrated canvas unions.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit as `feat(canvas): define trusted flow artifacts`.

### Task 2: Trusted flow renderer

**Files:**

- Create: `src/components/canvas/flow-artifact.tsx`
- Modify: `src/components/canvas/canvas-section.tsx`
- Modify: `src/components/canvas/structured-artifacts.test.tsx`

**Interfaces:**

- Consumes `FlowArtifactData`.
- Produces `<FlowArtifact data={data} />` with `aria-label="Concept flow"`.

- [ ] Add failing renderer tests for horizontal and vertical graphs, active
      nodes, edge labels, concise node details, and absence of raw markup.
- [ ] Run
      `npm test -- src/components/canvas/structured-artifacts.test.tsx` and
      confirm no flow renderer exists.
- [ ] Implement deterministic topological layers and a responsive trusted
      renderer using semantic HTML and owned connector SVG.
- [ ] Re-run the renderer tests and confirm they pass.
- [ ] Commit as `feat(canvas): render trusted concept flows`.

### Task 3: Learning-move orchestration

**Files:**

- Modify: `src/features/canvas-worker/artifact-playbook.test.ts`
- Modify: `src/features/canvas-worker/artifact-playbook.ts`
- Modify: `src/features/realtime/instructions.test.ts`
- Modify: `src/features/realtime/instructions.ts`

**Interfaces:**

- Adds a generic flow example to `curatedArtifactExamples`.
- Keeps `chalkPilotInstructions` as the single voice-agent policy string.

- [ ] Add failing assertions that artifact selection distinguishes mechanisms
      from procedures and that the voice loop explicitly uses attempt, board
      evidence, concise cue, focal artifact, and transfer/checkpoint.
- [ ] Run the two focused test files and confirm the new assertions fail.
- [ ] Replace topic-led examples with cross-domain learning-move examples,
      document the flow/sequence distinction, and add the attempt-first loop to
      the voice instructions without making it a rigid state machine.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit as `feat(agent): route visuals by learning move`.

### Task 4: Accurate field-test readiness

**Files:**

- Modify: `src/components/setup/ready-step.test.tsx`
- Modify: `src/components/setup/ready-step.tsx`
- Modify: `README.md`

**Interfaces:**

- Keeps the existing `ReadyStepProps` API.
- Presents camera, microphone, board frame, and voice configuration statuses
  without room-specific claims.

- [ ] Add failing UI assertions for device-neutral labels, accurate
      configuration language, and disabled start when any readiness input is
      false.
- [ ] Run `npm test -- src/components/setup/ready-step.test.tsx` and confirm
      the copy assertions fail.
- [ ] Update the ready screen and document the guided-then-free field-test
      protocol.
- [ ] Re-run the focused setup test and confirm it passes.
- [ ] Commit as `fix(setup): clarify field readiness`.

### Task 5: Synchronized display verification

**Files:**

- Modify: `e2e/display.spec.ts`

**Interfaces:**

- Uses the existing `chalkpilot-display-v1` protocol without protocol changes.

- [ ] Add a persisted flow section to the real session fixture and assertions
      for nodes, edges, active state, and an incremental update without reload.
- [ ] Run `npm run test:e2e -- e2e/display.spec.ts` and confirm it fails before
      the flow contract is complete.
- [ ] Make only integration fixes required by the failing E2E.
- [ ] Re-run the display E2E and confirm it passes.
- [ ] Commit as `test(display): verify topic-agnostic flows`.

### Task 6: Final verification

**Files:** No planned production changes.

- [ ] Run `npm run check`.
- [ ] Run `npm run test:e2e`.
- [ ] Inspect the production setup, display, and replay routes in the bundled
      Browser.
- [ ] Confirm the worktree contains no `docs/superpowers` directory and no
      unrelated changes.
- [ ] Review the final diff against the design and report any deferred item
      explicitly.
