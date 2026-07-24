# Agent Navigation Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record semantic canvas navigation and reconstruct it in Replay Studio without storing scroll coordinates.

**Architecture:** Extend the existing recording timeline with navigation events that share `canvas-events.json` with canvas revisions. Partition both validated event types when loading replay, then give the semantic canvas the last navigation at or before playback time.

**Tech Stack:** TypeScript, Zod, React 19, Vitest, Playwright.

## Global Constraints

- Requires the contracts from `2026-07-24-agent-navigable-canvas-plan.md`.
- Store semantic target IDs and timestamps only; never store pixel positions.
- Replay navigation must not prevent manual scrolling.
- Canvas revisions without a navigation event must not move the viewport.
- Keep every authored code file below the repository's 300-line soft limit.

---

### Task 1: Record and replay navigation events

**Files:**
- Modify: `src/features/recording/schema.ts`
- Modify: `src/features/recording/recording-timeline.ts`
- Modify: `src/features/recording/recording-timeline.test.ts`
- Modify: `src/features/recording/repository.ts`
- Modify: `src/features/recording/repository-timeline-tests.ts`
- Modify: `src/features/recording/use-session-recording.ts`
- Modify: `src/components/session/session-controller.tsx`
- Modify: `src/components/replay/replay-semantic-canvas.tsx`
- Modify: `src/components/replay/replay-player.tsx`
- Modify: `src/components/replay/replay-player.test.tsx`
- Modify: `e2e/replay.spec.ts`

**Interfaces:**
- Consumes: `CanvasNavigation` and navigation-aware `PresentationCanvas`.
- Produces: `{type:"navigation", offsetMs, navigation}` and `ReplayTimeline.navigationEvents`.

- [ ] **Step 1: Write failing timeline and replay tests**

```ts
timeline.noteNavigation(navigation, 1_600);
expect(append).toHaveBeenCalledWith({
  type: "navigation", offsetMs: 600, navigation,
});
```

Assert repository partitioning keeps canvas and navigation events in
`canvas-events.json`, replay selects the last navigation at or before
`currentMs`, and later canvas revisions alone do not scroll.

- [ ] **Step 2: Run tests and confirm schema/replay failures**

Run: `mise exec node@24 -- npm test -- src/features/recording/recording-timeline.test.ts src/features/recording/repository.test.ts src/components/replay/replay-player.test.tsx`  
Expected: FAIL because navigation is not a timeline event.

- [ ] **Step 3: Implement recording and replay selection**

Add `navigationTimelineEventSchema`, include it in the append union, persist
non-transcript events in the existing canvas event file, partition validated
events in `readTimeline`, expose `noteNavigation`, call it from
SessionController for each live navigation, and pass the active timed
navigation into Replay Studio's `PresentationCanvas`.

- [ ] **Step 4: Re-run tests and E2E**

Run: `mise exec node@24 -- npm test -- src/features/recording/recording-timeline.test.ts src/features/recording/repository.test.ts src/components/replay/replay-player.test.tsx && mise exec node@24 -- npx playwright test e2e/replay.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recording src/components/session/session-controller.tsx src/components/replay e2e/replay.spec.ts
git commit -m "feat(replay): preserve canvas navigation"
```

### Task 2: Documentation and field verification

**Files:**
- Modify: `README.md`
- Modify: `e2e/live-realtime.spec.ts`

- [ ] **Step 1: Add a topic-agnostic live navigation scenario**

Have the opt-in live agent create two durable sections, manually scroll away,
request a reference to the first section, and assert an explicit navigation
tool returns the clean display to that target. Keep the provider test opt-in.

- [ ] **Step 2: Document the interaction contract**

Document the growing canvas, manual scrolling, deliberate focus/highlight
tools, repeated focus, synchronized semantic targets, and replay.

- [ ] **Step 3: Run all automated gates**

Run: `mise exec node@24 -- npm run check && mise exec node@24 -- npm run test:e2e`  
Expected: formatting, lint, typecheck, unit tests, production build, and all
non-live Playwright tests pass; the live provider test remains skipped without
its environment flag.

- [ ] **Step 4: Inspect the production build in Browser**

Start: `mise exec node@24 -- npm start -- --hostname 127.0.0.1 --port 3203`  
Verify manual scrolling, repeated and nested focus, clean-display
synchronization, reduced motion, replay seeking, and zero console errors.

- [ ] **Step 5: Commit**

```bash
git add README.md e2e/live-realtime.spec.ts
git commit -m "docs: explain agent-guided canvas navigation"
```
