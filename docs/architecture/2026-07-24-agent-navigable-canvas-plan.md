# Agent-Navigable Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the learner freely scroll one persistent canvas while explicit agent tools focus or highlight stable semantic targets across the main display, clean display, recording, and replay.

**Architecture:** Add a data-only navigation contract and pure target registry beside the workspace model. Realtime tools validate targets before changing semantic focus, then publish unique navigation events; each canvas surface independently resolves the target and scrolls it into view. Store navigation beside canvas revisions on the recording timeline so Replay Studio can reconstruct references without persisting pixel coordinates.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, OpenAI Agents Realtime tools, BroadcastChannel, Vitest/Testing Library, Playwright.

## Global Constraints

- Keep one vertically scrolling ordered canvas; do not add a stage, minimap, freeform positioning, or follow-mode toggle.
- Manual scrolling remains unrestricted and never changes navigation state.
- Never transmit or persist pixel coordinates, DOM selectors, or arbitrary paths.
- Repeated navigation to the same target must work through a unique `requestId`.
- Canvas updates alone must not move the viewport.
- Use registered section or nested target IDs only; fail clearly for unknown targets.
- Keep every authored code file below the repository's 300-line soft limit.
- Do not add `docs/superpowers`; project documentation stays under `docs/architecture`.

---

### Task 1: Semantic navigation and target registry

**Files:**
- Create: `src/features/canvas-navigation/schema.ts`
- Create: `src/features/canvas-navigation/targets.ts`
- Create: `src/features/canvas-navigation/targets.test.ts`
- Modify: `src/features/workspace/artifact-schemas.ts`
- Modify: `src/features/workspace/artifact-schemas.test.ts`
- Modify: `src/features/canvas-worker/canvas-snapshot.ts`
- Modify: `src/features/canvas-worker/canvas-snapshot.test.ts`

**Interfaces:**
- Produces: `CanvasNavigation`, `canvasNavigationSchema`, `CanvasTarget`, `createCanvasNavigation(input, dependencies)`, `listCanvasTargets(canvas)`, and `resolveCanvasTarget(canvas, targetId)`.
- `CanvasTarget` is `{id, sectionId, label, text}`; tool responses expose only a 240-character preview of `text`.
- Target IDs are a section ID or `<sectionId>:<nestedId>`. Nested IDs include flow nodes, sequence steps, checkpoint `prompt`, and chart annotations with explicit IDs.

- [ ] **Step 1: Write failing registry and schema tests**

```ts
expect(listCanvasTargets(canvas).map(({ id }) => id)).toEqual([
  "mechanism",
  "mechanism:pressure",
  "procedure",
  "procedure:measure",
  "prediction",
  "prediction:prompt",
  "trend",
  "trend:threshold",
]);
expect(() => resolveCanvasTarget(canvas, "missing")).toThrow(
  "Canvas target is unavailable.",
);
expect(canvasNavigationSchema.parse({
  requestId: "nav-1",
  targetId: "mechanism:pressure",
  kind: "focus",
  issuedAt: "2026-07-24T08:00:00.000Z",
})).toMatchObject({ targetId: "mechanism:pressure" });
```

- [ ] **Step 2: Run tests and confirm missing-module/schema failures**

Run: `mise exec node@24 -- npm test -- src/features/canvas-navigation/targets.test.ts src/features/workspace/artifact-schemas.test.ts src/features/canvas-worker/canvas-snapshot.test.ts`  
Expected: FAIL because the navigation modules and chart annotation IDs do not exist.

- [ ] **Step 3: Implement bounded contracts and pure discovery**

```ts
export const canvasTargetIdSchema = z.string().trim().min(1).max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)?$/);
export const canvasNavigationSchema = z.object({
  requestId: identifierSchema,
  targetId: canvasTargetIdSchema,
  kind: z.enum(["focus", "highlight"]),
  text: z.string().trim().min(1).max(240).optional(),
  issuedAt: z.iso.datetime(),
}).strict();
export function nestedTarget(sectionId: string, nestedId: string) {
  return `${sectionId}:${nestedId}`;
}
```

Add optional validated `id` to chart annotations, register only annotations that
provide it, and include `targets: Array<{id; sectionId; label}>` in the bounded
canvas-worker snapshot. `createCanvasNavigation` receives injected `createId`
and `now` functions so repeated-navigation tests remain deterministic.

- [ ] **Step 4: Re-run focused tests and typecheck**

Run: `mise exec node@24 -- npm test -- src/features/canvas-navigation/targets.test.ts src/features/workspace/artifact-schemas.test.ts src/features/canvas-worker/canvas-snapshot.test.ts && mise exec node@24 -- npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas-navigation src/features/workspace/artifact-schemas* src/features/canvas-worker/canvas-snapshot*
git commit -m "feat(canvas): define semantic navigation targets"
```

### Task 2: Stable anchors, scrolling, and temporary highlighting

**Files:**
- Create: `src/features/canvas-navigation/text-range.ts`
- Create: `src/features/canvas-navigation/use-canvas-navigation.ts`
- Create: `src/features/canvas-navigation/use-canvas-navigation.test.tsx`
- Modify: `src/components/canvas/presentation-canvas.tsx`
- Modify: `src/components/canvas/canvas-section.tsx`
- Modify: `src/components/canvas/{flow,sequence,chart,checkpoint}-artifact.tsx`
- Modify: `src/components/canvas/presentation-canvas.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `CanvasNavigation` and `nestedTarget`.
- Produces: `<PresentationCanvas canvas navigation />` and `useCanvasNavigation(containerRef, navigation, onFailure?)`.

- [ ] **Step 1: Write failing viewport tests**

```tsx
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;
const view = render(<PresentationCanvas canvas={canvas} navigation={nav("nav-1", "idea")} />);
expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
view.rerender(<PresentationCanvas canvas={updatedCanvas} navigation={nav("nav-1", "idea")} />);
expect(scrollIntoView).toHaveBeenCalledTimes(1);
view.rerender(<PresentationCanvas canvas={updatedCanvas} navigation={nav("nav-2", "idea")} />);
expect(scrollIntoView).toHaveBeenCalledTimes(2);
```

Also assert nested anchors exist, unknown targets report failure without
scrolling, exact text produces a CSS Highlight range, the attention attribute
expires after 5,000 ms, and reduced motion uses `behavior: "auto"`.

- [ ] **Step 2: Run tests and confirm no scrolling occurs**

Run: `mise exec node@24 -- npm test -- src/features/canvas-navigation/use-canvas-navigation.test.tsx src/components/canvas/presentation-canvas.test.tsx`  
Expected: FAIL because `PresentationCanvas` has no navigation contract.

- [ ] **Step 3: Implement container-scoped navigation**

```ts
useEffect(() => {
  if (!navigation) return;
  const target = [...container.current!.querySelectorAll<HTMLElement>("[data-canvas-target]")]
    .find((element) => element.dataset.canvasTarget === navigation.targetId);
  if (!target) return onFailure?.("Canvas target is unavailable.");
  target.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center",
  });
  target.dataset.canvasAttention = navigation.kind;
  return clearAttentionAfter(target, 5_000);
}, [navigation?.requestId]);
```

Use `text-range.ts` to find one exact rendered-text range inside the resolved
target and register it through the CSS Custom Highlight API. Add stable
`data-canvas-target` attributes to sections and supported nested elements.

- [ ] **Step 4: Re-run focused tests and typecheck**

Run: `mise exec node@24 -- npm test -- src/features/canvas-navigation/use-canvas-navigation.test.tsx src/components/canvas/presentation-canvas.test.tsx src/components/canvas/structured-artifacts.test.tsx && mise exec node@24 -- npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas-navigation src/components/canvas src/app/globals.css
git commit -m "feat(canvas): follow deliberate semantic focus"
```

### Task 3: Realtime focus and highlight tools

**Files:**
- Modify: `src/features/realtime/tools.ts`
- Modify: `src/features/realtime/tools.test.ts`
- Modify: `src/features/realtime/session.ts`
- Modify: `src/features/realtime/session.test.ts`
- Modify: `src/features/realtime/instructions.ts`
- Modify: `src/features/realtime/instructions.test.ts`
- Modify: `src/features/canvas-worker/client.ts`
- Modify: `src/features/canvas-worker/client.test.ts`
- Modify: `src/components/setup/setup-flow.tsx`
- Modify: `src/components/session/session-controller.tsx`
- Modify: `src/components/session/session-controller.test.tsx`
- Modify: `src/components/session/learning-workspace.tsx`

**Interfaces:**
- Consumes: `resolveCanvasTarget`, `CanvasNavigation`.
- Produces: tools `list_canvas_targets()`, `focus_canvas({targetId})`, and `highlight_canvas({targetId,text})`; `ChalkPilotRealtimeOptions.onNavigation`.

- [ ] **Step 1: Write failing action and wiring tests**

```ts
expect(tools.map(({ name }) => name)).toEqual([
  "inspect_board", "list_canvas_targets", "focus_canvas", "highlight_canvas",
  "delegate_canvas_task", "remember_learner",
]);
await actions.focusCanvas({ targetId: "mechanism:pressure" });
expect(fetcher).toHaveBeenCalledWith("/api/sessions/session-1/canvas",
  expect.objectContaining({ body: JSON.stringify({ action: "focus", sectionId: "mechanism" }) }));
expect(onNavigation).toHaveBeenCalledWith(expect.objectContaining({
  targetId: "mechanism:pressure", kind: "focus",
}));
```

Assert unknown targets reject before persistence and repeated calls receive
different request IDs. A highlight mismatch must still focus the target and
return `{focused: true, highlighted: false, error: "Highlight text is unavailable."}`.

- [ ] **Step 2: Run tests and confirm old `set_focus` behavior fails**

Run: `mise exec node@24 -- npm test -- src/features/realtime/tools.test.ts src/features/realtime/session.test.ts src/components/session/session-controller.test.tsx`  
Expected: FAIL because the new tools and callbacks are absent.

- [ ] **Step 3: Implement validated navigation emission**

Replace `set_focus`; resolve nested target ownership against a current canvas
ref, persist only the owning section as `focusId`, then emit a unique navigation
event. Keep canvas generation asynchronous and instruct the voice agent to
navigate only when a target materially supports the current teaching move.
The read-only listing tool returns bounded IDs, labels, and previews. A
successful canvas job explicitly navigates to its required focused section.
SetupFlow owns the latest navigation; SessionController forwards it to
LearningWorkspace.

- [ ] **Step 4: Re-run focused tests and typecheck**

Run: `mise exec node@24 -- npm test -- src/features/realtime/tools.test.ts src/features/realtime/session.test.ts src/features/realtime/instructions.test.ts src/features/canvas-worker/client.test.ts src/components/session/session-controller.test.tsx src/components/session/learning-workspace.test.tsx && mise exec node@24 -- npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/realtime src/features/canvas-worker/client* src/components/setup/setup-flow.tsx src/components/session
git commit -m "feat(agent): navigate the learning canvas"
```

### Task 4: Synchronize semantic navigation across displays

**Files:**
- Modify: `src/features/display/protocol.ts`
- Modify: `src/features/display/protocol.test.ts`
- Modify: `src/features/display/display-reducer.ts`
- Modify: `src/features/display/display-reducer.test.ts`
- Modify: `src/features/display/use-display-channel.ts`
- Modify: `src/components/canvas/display-surface.tsx`
- Modify: `e2e/display.spec.ts`

**Interfaces:**
- Consumes: `CanvasNavigation`.
- Produces: display message `{version: 1, type: "navigation", payload}` and snapshot field `navigation: CanvasNavigation | null`.

- [ ] **Step 1: Write failing protocol, reducer, and display E2E assertions**

Assert parsing preserves navigation, reducer stores it without changing canvas,
same-target requests with new IDs survive BroadcastChannel, and the clean
display centers and pulses the registered target without setup controls.

- [ ] **Step 2: Run tests and confirm navigation messages are rejected**

Run: `mise exec node@24 -- npm test -- src/features/display/protocol.test.ts src/features/display/display-reducer.test.ts && mise exec node@24 -- npx playwright test e2e/display.spec.ts`  
Expected: FAIL on the missing navigation message.

- [ ] **Step 3: Extend transport without coordinates**

Include latest navigation in ready snapshots, publish incremental navigation
messages, reduce them into display state, and pass state navigation to
`PresentationCanvas`. Keep each surface's manual scroll position independent.

- [ ] **Step 4: Re-run focused tests and commit**

Run: `mise exec node@24 -- npm test -- src/features/display/protocol.test.ts src/features/display/display-reducer.test.ts && mise exec node@24 -- npx playwright test e2e/display.spec.ts`  
Expected: PASS.

```bash
git add src/features/display src/components/canvas/display-surface.tsx e2e/display.spec.ts
git commit -m "feat(display): synchronize canvas navigation"
```

Recording and Replay Studio integration are implemented by the companion plan
`docs/architecture/2026-07-24-agent-navigation-replay-plan.md` after this live
navigation plan is green. A future notebook renderer registers cell targets
through this same contract; this plan does not add a placeholder notebook.
