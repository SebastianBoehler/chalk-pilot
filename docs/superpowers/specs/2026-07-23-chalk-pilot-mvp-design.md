# ChalkPilot MVP Design

**Status:** Proposed for implementation · **Date:** 2026-07-23 · **Repository:** `chalk-pilot`

## 1. Product intent

ChalkPilot turns a room with a physical chalkboard, a rear camera, a laptop,
and an external display into a conversational learning workspace.

The physical board remains the learner's active surface. Voice coordinates the
session. The external display supplies durable explanations, cues, formulas,
diagrams, and references. The laptop is a compact controller rather than the
place where learning happens.

The MVP is successful when one person can take a fresh local checkout to the
Cyber Valley lecture room, connect the room camera and external display,
calibrate the board, complete one or two spoken learning turns, and see the
agent react to new board work with a short spoken reply and a useful display
update.

## 2. Design principles

1. **Learning before interface.** The board and learning task dominate the
   learner's attention. Operational controls stay on the laptop.
2. **Attempt before assistance.** The agent asks for an attempt, diagnosis, or
   self-explanation before giving a complete solution unless safety or the
   learner's explicit request requires otherwise.
3. **Voice is brief; the display is durable.** Spoken responses default to one
   or two sentences. Longer explanations belong on the presentation surface.
4. **Context is bounded and visible.** Camera processing is local and
   continuous, but images reach OpenAI only at explicit, visible trigger
   points.
5. **One clear next action.** Each setup step and recoverable error presents
   one primary call to action.
6. **A small owned core.** Use platform capabilities and narrow dependencies.
   Do not carry over the unrelated infrastructure of the earlier projects.

## 3. MVP user experience

### 3.1 Setup

The `/setup` route is a four-step flow:

1. **Camera permission and selection**
   - Explain why the camera is needed before requesting access.
   - Request permission, enumerate labeled video devices, and show the selected
     high-resolution live preview.
2. **Board calibration**
   - Detect the largest plausible rectangular board.
   - Draw four draggable corner handles over the preview.
   - Show the perspective-corrected result beside the source preview.
   - Require confirmation before continuing.
3. **Presentation display**
   - Open `/display` in a separate window.
   - Ask the learner to move it to the external monitor and enter fullscreen.
   - Confirm that the display window is connected.
4. **Session start**
   - Show camera, board, microphone, display, and OpenAI readiness.
   - Start the realtime session from one primary button.

The setup flow preserves confirmed calibration between steps and never silently substitutes another camera or guessed board crop.

### 3.2 Laptop controller

The `/session` route contains:

- a small rectified-board preview;
- microphone, camera, display, and realtime connection status;
- the current state: listening, thinking, speaking, paused, or error;
- a primary pause/resume control;
- an explicit **Inspect board now** action;
- recalibrate, reopen display, and end-session secondary actions;
- a collapsed transcript/history panel for inspection, not constant attention.

There is no dashboard, course sidebar, chat composer, or artifact gallery in
the MVP.

### 3.3 Presentation surface

The `/display` route contains no setup controls or chat chrome. It renders:

- one clearly emphasized current section;
- earlier sections in a calm vertical canvas;
- readable Markdown;
- KaTeX mathematics;
- sanitized Mermaid diagrams;
- sanitized image or YouTube media blocks;
- a small non-distracting listening/thinking/speaking indicator.

The visual system uses warm neutral surfaces, near-black text, and one
high-contrast blue primary color. It avoids gradients, decorative blobs,
nested cards, and unnecessary motion. Keyboard focus, contrast, reduced-motion
preferences, and large-room type sizes are first-class requirements.

## 4. Board observation

### 4.1 Calibration pipeline

The camera requests the highest practical resolution, preferring 3840x2160 and accepting the device's supported result.

An isolated Web Worker uses OpenCV.js to:

1. downsample a frame for analysis;
2. convert it to grayscale;
3. detect edges and contours;
4. score plausible four-corner contours by area, convexity, and rectangularity;
5. return the best corner proposal;
6. compute the confirmed perspective transform; and
7. render a front-facing board crop.

Automatic detection accelerates setup; manual corner confirmation is part of the normal calibration contract, not a hidden recovery path.

### 4.2 Change and transmission policy

- The browser maintains a continuous local camera preview.
- The worker samples locally at a low rate for board-change detection.
- A downsampled grayscale difference score marks the board as changed only
  after a debounced material-change threshold.
- When the user's spoken turn is finalized, the latest corrected board is
  attached only if it materially differs from the last model-visible board.
- The agent can call `inspect_board` when visual context is needed.
- The learner can press **Inspect board now** at any time.
- The UI always indicates when a board image is being sent.
- No autonomous camera-driven interruption occurs in the MVP.
- Raw camera frames and transmitted board images are not persisted by default.

## 5. Realtime agent

ChalkPilot uses the official OpenAI Agents SDK for JavaScript with a
`RealtimeAgent`, `RealtimeSession`, WebRTC transport, semantic turn detection,
and short-lived client secrets minted by the server.

The first technical spike must prove that a corrected board image can be added
to a realtime turn and understood by the selected model. If the public Agents
SDK surface cannot perform that operation cleanly, the implementation will use
the raw OpenAI Realtime WebRTC protocol as the single adapter. ChalkPilot will
not ship two parallel realtime implementations.

The initial agent tools are:

- `inspect_board`: supply the newest confirmed corrected board image;
- `set_focus`: choose the canvas section emphasized on the display;
- `append_section`: append a typed display section;
- `update_section`: replace the content of an existing section;
- `remember_learner`: persist an evidence-linked learner observation.

Learning events such as independent attempts, hints, board inspections, and
canvas mutations are recorded automatically rather than exposed as a general
agent tool.

Agent instructions require it to:

- diagnose from the learner's attempt before explaining;
- prefer prompts, cues, comparison, and self-explanation;
- avoid completing work that the learner can productively attempt;
- move detailed content to the canvas;
- keep normal speech to one or two sentences;
- state uncertainty when the board is unreadable;
- avoid claiming that the board changed without inspecting it;
- never modify setup, calibration, credentials, or camera permissions.

## 6. Technical architecture

The project is one Next.js App Router application using React, TypeScript, and
Tailwind CSS. It uses npm and Node.js; there is no monorepo or separate backend.

Client modules own:

- setup and session state machines;
- media-device access;
- board preview and calibration controls;
- the OpenCV worker boundary;
- board-change decisions;
- the realtime session adapter;
- agent tool dispatch;
- controller/display synchronization.

Server Route Handlers own:

- creation of short-lived OpenAI realtime client secrets;
- validated local workspace reads and writes;
- session creation and completion.

The controller and display communicate through a versioned `BroadcastChannel`
protocol. When the display announces readiness, the controller sends a complete
state snapshot before incremental updates resume.

React context plus reducers is sufficient for shared state. A global state
library is not included unless implementation evidence demonstrates a concrete
need.

## 7. Local persistence

Runtime data lives in a gitignored `.chalkpilot/` directory:

```text
.chalkpilot/
  learner.md
  sessions/<session-id>/
    session.json
    transcript.jsonl
    events.jsonl
    canvas/
      state.json
      sections/<section-id>.md
    assets/
```

Canvas sections are Markdown files with typed metadata in `state.json`. Tool
handlers validate identifiers and content with Zod, serialize writes, and
reject path traversal or unknown block types.

`learner.md` stores concise observations with evidence, scope, and confidence.
It does not become an unqualified profile of the learner. The MVP stores text
transcripts but not raw audio, full camera video, or board images.

## 8. Error behavior

- Camera or microphone denial explains the missing permission and provides a
  retry action.
- Camera disconnection pauses board observation and never switches devices
  silently.
- Lost board tracking marks the crop stale and requires recalibration.
- A closed display window is visible in the controller and can be reopened.
- Realtime disconnection preserves the local session and offers reconnect.
- Failed canvas writes do not optimistically appear successful.
- Invalid agent tool calls return structured errors and make no partial write.
- Missing API credentials stop at setup with an actionable server-side error;
  secrets never enter browser source or persisted state.

No mock content, silent fallback provider, or offline substitute is included in
the product.

## 9. Repository and open-source standard

ChalkPilot will use the Apache-2.0 license for a permissive license with an
explicit patent grant. The repository will include:

- a task-oriented README with concept, room setup, local setup, privacy model,
  architecture summary, screenshots added only after the real UI exists, and
  troubleshooting;
- `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`;
- `.env.example` containing names but no credentials;
- dependency licenses and attribution where required;
- GitHub Actions for lint, formatting, types, unit tests, and production build;
- small modules with a 300-line soft limit and no duplicated contracts.

The README will distinguish the original ChalkPilot code from ideas learned
from the author's earlier projects. No source code is copied from Tübingen's
AGPL-licensed `ai-tutor`.

## 10. Verification

Automated checks cover:

- corner ordering and perspective-transform inputs;
- board-change scoring and debounce behavior;
- setup and session state transitions;
- display-protocol snapshots and updates;
- validated canvas and learner-memory mutations;
- workspace path containment and serialized writes;
- realtime event handling from captured protocol fixtures;
- server rejection of absent credentials;
- lint, formatting, type checking, tests, and production build.

Playwright covers the setup flow with browser-provided fake media capture, the
controller/display handshake, recalibration, and visible error recovery. A
manual live smoke test uses a real camera, microphone, external window, OpenAI
Realtime connection, board image, tool call, and canvas mutation.

The implementation is not complete until a fresh clone can follow the README
and reproduce the local smoke test without undocumented setup.

## 11. Explicit non-goals

The first room-test release does not include:

- LiveKit, Electron, authentication, accounts, or a database;
- course ingestion, university APIs, collaboration, or multi-user editing;
- automatic display placement through experimental browser APIs;
- web search, autonomous YouTube discovery, or image generation;
- arbitrary generated HTML, JavaScript, or React components;
- proactive camera-triggered agent interruptions;
- analytics dashboards, spaced-repetition scheduling, or research sensors;
- cloud deployment or synchronization.

These can be evaluated only after the physical-room interaction works.

## 12. Implementation order

1. Establish the open-source repository, quality gates, and typed contracts.
2. Prove the OpenAI Realtime audio, image, and tool vertical slice.
3. Build setup, camera selection, calibration, and corrected-board preview.
4. Build change detection and the bounded board-send policy.
5. Build persistent canvas tools and controller/display synchronization.
6. Apply the learning policy, learner memory, and session event trail.
7. Complete error handling, accessibility, tests, README, and live smoke test.
