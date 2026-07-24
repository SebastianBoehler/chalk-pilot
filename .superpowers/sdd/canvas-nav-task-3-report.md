# Task 3 — Canvas navigation report

## Implementation

- Replaced the legacy `set_focus` tool with the ordered bounded tool surface:
  `inspect_board`, `list_canvas_targets`, `focus_canvas`,
  `highlight_canvas`, `delegate_canvas_task`, and `remember_learner`.
- Canvas actions resolve targets from a current canvas accessor before a focus
  persistence request. They persist the owning section only and emit fresh
  validated navigation after persistence succeeds.
- Target listing returns ordered semantic `id`, `label`, and 240-character
  whitespace-normalized previews. Highlight mismatch deliberately focuses and
  returns the required unavailable-text result.
- Realtime now carries navigation callbacks outward. SetupFlow owns the latest
  navigation state; SessionController retains the latest canvas in an effect
  backed ref and forwards navigation to LearningWorkspace and PresentationCanvas.
- Successful worker jobs emit an explicit fresh focus navigation for their
  required focus target while preserving background completion messaging.
- Updated agent instructions to use registered targets only for material,
  topic-agnostic teaching moves and never claim UI navigation without a result.

## TDD evidence

- RED: `mise exec node@24 -- npm test -- src/features/realtime/tools.test.ts src/features/realtime/session.test.ts src/components/session/session-controller.test.tsx src/features/canvas-worker/client.test.ts src/features/realtime/instructions.test.ts src/components/session/learning-workspace.test.tsx`
  failed as expected with 9 failures: legacy `set_focus` still present, the
  new actions and callbacks absent, and instructions lacking target guidance.
- GREEN focused suite: same targeted areas passed with 37 tests.
- Final full suite: `mise exec node@24 -- npm test` passed: 73 files, 333 tests.
- Typecheck: `mise exec node@24 -- npm run typecheck` passed.
- Lint: `mise exec node@24 -- npm run lint` passed.

## Files changed

- `src/features/realtime/tools.ts`, `tools.test.ts`, `session.ts`,
  `session.test.ts`, `session-test-harness.ts`, `instructions.ts`, and
  `instructions.test.ts`
- `src/features/realtime/canvas-completion.ts`
- `src/features/canvas-worker/client.ts` and `client.test.ts`
- `src/components/setup/setup-flow.tsx`
- `src/components/session/session-controller.tsx`,
  `session-controller.test.tsx`, `learning-workspace.tsx`, and
  `learning-workspace.test.tsx`

## Self-review and concerns

- Verified no remaining `set_focus` references and no navigation synthesized
  by canvas updates alone.
- Preserved API error propagation: failed focus persistence cannot emit a
  navigation event.
- Kept every authored source and test file below 300 lines. The pre-existing
  realtime session was near that limit, so its private completion sender moved
  into a narrowly scoped helper.
- No blocking concerns. A worker response without `focusId` is treated as an
  error because worker jobs are contractually required to focus their result;
  it therefore cannot emit an invalid navigation event.
