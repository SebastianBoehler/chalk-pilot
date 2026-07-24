# Agent-Navigable Learning Canvas

**Status:** Proposed and conversation-approved  
**Date:** 2026-07-24

## Goal

Keep ChalkPilot's learning canvas as one persistent, vertically scrolling
document while letting the learner and agent navigate it naturally.

The learner may scroll anywhere at any time. The agent moves the viewport only
through an explicit tool call that references a stable semantic target. Canvas
updates alone must never unexpectedly move the learner.

The design applies across subjects. Navigation targets learning artifacts and
their meaningful internal elements rather than topic-specific UI.

## Selected approach

ChalkPilot will use a persistent scrolling document with deliberate,
tool-driven navigation.

This approach preserves the visible history of a learning session, supports
connections between earlier and later work, and matches LecturePilot's useful
focus and highlight behavior. It is preferable to:

- a single-artifact stage, which hides context and makes comparison harder; and
- a freeform spatial canvas, which adds zoom, placement, accessibility,
  recording, and navigation complexity without improving the first field test.

There is no persistent follow mode. Manual scrolling does not change whether a
future agent focus command will work.

## Canvas behavior

The canvas remains an ordered list of durable sections.

- Continue updating an existing section while the learning goal and
  representation remain the same.
- Append a section for a new durable learning goal, representation, or learner
  checkpoint.
- Do not append a new section merely to restate the current voice response.
- Do not model notebook cells as separate canvas sections. A notebook is one
  section with nested cell targets.
- Never store or synchronize raw pixel scroll positions.

Every rendered section receives its existing stable section ID as a DOM anchor.
Structured artifacts may register stable nested anchors:

- flow nodes;
- sequence steps;
- chart annotations;
- checkpoint prompts;
- notebook cells; and
- explicitly identified Markdown blocks.

The current canvas snapshot exposes only valid registered target IDs to the
agent. The agent must not invent selectors, DOM paths, or text offsets.

## Agent tools

The Realtime voice agent receives direct navigation tools. Navigation does not
require a canvas-worker generation request.

```ts
focus_canvas({
  targetId: "stopping-distance-chart",
});

highlight_canvas({
  targetId: "notebook-cell-velocity-model",
  text: "distance = reaction + braking",
});
```

`focus_canvas`:

- accepts one registered target ID;
- scrolls the target near the visual center;
- marks the owning section as the current semantic focus; and
- emits a new navigation request even when the target equals the previous
  target.

`highlight_canvas`:

- accepts one registered target ID;
- may include a short exact text value inside that target;
- scrolls to the target before highlighting it; and
- applies a temporary, non-destructive attention treatment.

Canvas-generation tools may continue to focus a newly created or updated
artifact, but they must do so explicitly. Upserting content alone does not
navigate.

## Navigation contract

Semantic focus and navigation intent are related but distinct:

```ts
type CanvasNavigation = {
  requestId: string;
  targetId: string;
  kind: "focus" | "highlight";
  text?: string;
  issuedAt: string;
};
```

The persisted canvas retains its current `focusId`. Each deliberate navigation
also carries a unique `requestId`. The request ID ensures that two consecutive
focus calls for the same target both trigger movement.

The display protocol gains a versioned navigation message. Each receiving
surface resolves the semantic target within its own DOM and viewport:

- the main learning workspace;
- the clean room display; and
- Replay Studio's semantic canvas.

The protocol never transmits coordinates. Different displays may have
different sizes and independent manual scroll positions.

## Viewport behavior

On a valid navigation request:

1. Resolve the registered target.
2. Use smooth scrolling and center alignment.
3. Apply a visible focus treatment for five seconds.
4. Preserve the persistent current-focus styling on the owning section.
5. Respect `prefers-reduced-motion` by using immediate scrolling.

Manual scrolling is never prevented or automatically reversed. A later
explicit agent navigation is a new intent and may move the viewport again.

The agent should navigate only when the target materially supports its current
teaching move. It must not focus a section on every conversational turn.

## Notebook integration

A notebook registers its section ID and stable cell IDs with the canvas target
registry.

- Focusing the notebook section reveals the notebook workspace.
- Focusing a cell scrolls the outer document to the notebook and the notebook's
  internal viewport to the cell.
- Editing or executing a cell does not automatically navigate.
- An explicit agent focus or highlight command may navigate to a result or
  error after execution.

This contract is independent of whether the first notebook runtime uses
browser-based Python or a later remote sandbox.

## Persistence and replay

Canvas content and current semantic focus remain persisted as they are now.
Navigation requests are session events rather than permanent layout state.

Recording stores each navigation event with its session timestamp. Replay can
therefore reconstruct:

- which target the agent referenced;
- when the display moved;
- which temporary highlight appeared; and
- how that navigation aligned with voice, transcript, and canvas revisions.

Seeking in Replay Studio restores the latest canvas revision and navigation
event at or before the selected timestamp. The viewer may still scroll
manually; replay applies a later recorded navigation only when playback crosses
that event.

## Error handling

- Reject an unknown or malformed target before broadcasting navigation.
- Return a structured tool error so the agent can recover without claiming the
  display moved.
- If a target was valid when issued but is absent on one display, keep the
  canvas usable, log the local failure, and do not fall back to a guessed
  selector.
- If highlighted text is not an exact match inside the registered target,
  focus the target but report the highlight mismatch.
- One navigation failure must not hide or replace any canvas content.

## Accessibility

- Semantic focus uses `aria-current` on the owning section.
- Temporary highlights do not move keyboard focus automatically.
- Target elements remain reachable through normal document navigation.
- Motion follows the user's reduced-motion preference.
- Focus and highlight treatments must remain distinguishable without relying
  only on color.

## Verification

Focused tests must prove:

- a focus request scrolls the matching stable target;
- repeated requests for the same target both scroll;
- an artifact update without navigation does not scroll;
- unknown targets return a structured error and do not move the viewport;
- main and clean displays receive the same semantic navigation request;
- different viewport sizes resolve the same target without shared coordinates;
- nested artifact navigation works inside an independently scrolling surface;
- reduced-motion mode disables smooth animation;
- highlights expire without changing persisted content; and
- replay restores navigation events at the correct session time.

The production browser check must cover manual scrolling, agent focus after
manual scrolling, repeated focus, clean-display synchronization, and absence of
console errors.

When notebook support is implemented, its own plan must add the corresponding
outer-document and inner-cell navigation regression.

## Deferred work

This design does not add:

- freeform card positioning or zooming;
- a persistent follow-agent toggle;
- agent-controlled pixel scrolling;
- a minimap or outline rail;
- arbitrary DOM selectors; or
- notebook execution itself.

An outline may be added later if real sessions show that long canvases are
difficult to browse manually.
