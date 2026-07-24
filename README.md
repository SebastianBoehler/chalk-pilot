<div align="center">
  <h1>ChalkPilot</h1>
  <p><strong>Turn a physical board into a voice-first AI learning workspace.</strong></p>
  <p>
    A room camera gives the learning agent context while a separate display
    becomes its interactive teaching canvas.
  </p>
  <p>
    <a href="https://github.com/SebastianBoehler/chalk-pilot/actions/workflows/ci.yml"><img src="https://github.com/SebastianBoehler/chalk-pilot/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
    <a href="https://github.com/SebastianBoehler/chalk-pilot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/SebastianBoehler/chalk-pilot" alt="Apache 2.0 license"></a>
    <img src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24">
  </p>
  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#camera-setup">Camera setup</a> ·
    <a href="#learning-canvas">Learning canvas</a> ·
    <a href="#replay-studio">Replay Studio</a> ·
    <a href="#architecture">Architecture</a>
  </p>
</div>

You work with your hands at the board. A short-spoken OpenAI learning agent can
inspect the perspective-corrected board at visible turn boundaries and place
durable explanations, formulas, diagrams, images, or videos on a separate
presentation canvas.

## What the MVP does

- selects any camera exposed to the browser, including a room camera or an
  iPhone exposed through macOS Continuity Camera;
- keeps **Track a presenter** off by default and can locally track a confirmed
  presenter when a wide camera view makes that useful;
- detects a likely board and provides four manual corner controls;
- rectifies an angled camera view into a front-facing board image with
  OpenCV.js;
- detects material board changes locally;
- connects an OpenAI Realtime voice agent through WebRTC;
- delegates durable visual work to a separate background canvas specialist so
  voice remains responsive;
- sends no board image until a completed turn or explicit inspection;
- makes the agent-created learning canvas the primary post-onboarding
  workspace, with board context and transcript in a collapsible sidebar;
- optionally opens a clean presentation window for a separate room display;
- durably records board, speaker, canvas, microphone, and desktop audio as five
  synchronized, independent local tracks;
- provides a local Replay Studio with view switching, transcript seeking,
  independent audio controls, track downloads, and a portable ZIP export;
- lets the canvas specialist append or update Markdown, math, Mermaid, image,
  YouTube, chart, comparison, sequence, and checkpoint sections;
- stores canvas sections, text transcripts, events, and evidence-linked learner
  notes locally.

The full selected-camera feed stays on the Mac. Live microphone audio is sent
to OpenAI Realtime for the conversation, and corrected board images are sent
at completed turns or when you explicitly ask the agent to inspect the board.
Starting a recording additionally persists five local tracks as described
below; it does not upload those recording files. ChalkPilot does not require a
touch display, a separate backend, LiveKit, or a monitor-selection screen.

## Quick start

Prerequisites:

- Node.js 24 (the repository includes `.nvmrc`);
- npm;
- a Chromium-based browser;
- an OpenAI API key with access to `gpt-realtime-mini`;
- a camera and microphone.

```bash
git clone https://github.com/sebastianboehler/chalk-pilot.git
cd chalk-pilot
nvm use
npm ci
cp .env.example .env.local
```

`npm ci` runs `npm run prepare:mediapipe` automatically. That command copies
the pinned pose model and WASM runtime into the generated
`public/vendor/mediapipe/` directory; those assets stay out of Git. Run it
manually if you reuse an existing `node_modules` directory or remove the
generated assets.

Set the server-only key in `.env.local`:

```dotenv
OPENAI_API_KEY=your_key_here
```

The canvas worker defaults to `gpt-5-mini` through OpenAI and reuses that key.
To route only the canvas worker through OpenRouter, add:

```dotenv
CANVAS_AGENT_PROVIDER=openrouter
CANVAS_AGENT_MODEL=openai/gpt-5-mini
OPENROUTER_API_KEY=your_openrouter_key
```

OpenRouter requests prioritize throughput and require tool-capable,
zero-retention endpoints. ChalkPilot surfaces configuration or provider errors
instead of silently changing providers.

For development:

```bash
npm run dev
```

Open [http://localhost:3000/setup](http://localhost:3000/setup).

For the lecture room, build while you still have a reliable connection:

```bash
npm run build
npm run room
```

The API key stays on the Next.js server. The browser receives only a short-lived
Realtime client secret.

## Camera setup

ChalkPilot uses standard browser media APIs. Select the camera Chrome exposes:
that can be an auditorium capture device, a USB camera, or an iPhone presented
by macOS Continuity Camera. An iPhone on a mount aimed at a whiteboard or flip
chart needs no special mode.

1. Open `/setup`, allow camera access, and select the desired system camera.
2. Leave **Track a presenter** off for a deliberately framed camera such as a
   phone on a mount. Turn it on only when a wide view needs a separate,
   locally-derived presenter crop; ChalkPilot then asks you to confirm the
   correct person before tracking begins.
3. Select and confirm the microphone that both the Realtime partner and the
   recording should use.
4. Confirm the board corners. The handle surface follows the selected stream's
   real dimensions; adjust the four handles if the board is angled or the
   automatic outline is imperfect.
5. Check the camera and corrected-board previews. When presenter tracking is
   enabled, confirm the detected outline and verify the crop follows you.
6. Start the session. Keep the canvas on the laptop, move it to an external
   monitor, or open the clean display while controls stay on the laptop.

There is no special iPhone or lecture-room category: the chosen browser camera
defines the frame, and presenter tracking is an independent opt-in. A QR-code
or remote phone-feed session is not implemented yet. Android cameras therefore
need to be exposed to Chrome as a normal browser camera or capture device.

There is intentionally no display picker. Browser applications cannot reliably
assign a popup to a physical monitor; moving the clean presentation window is
faster and more predictable.

## Local recording

Choose **Start session recording** in the session controls. Chrome opens its
protected screen-sharing picker every time:

1. Select the clean-display tab for canvas-only output, the main ChalkPilot tab
   to include controls, or the display/window that contains the canvas.
2. Enable **Share tab audio**, **Share system audio**, or the equivalent audio
   option shown by your Chrome/macOS combination.
3. Confirm the share. ChalkPilot starts only after Chrome returns both a canvas
   video track and a desktop-audio track.

The browser owns this picker: ChalkPilot can request the current tab and system
audio, but it cannot preselect a surface, bypass consent, or enable the audio
checkbox. If the chosen surface supplies no audio track, recording stays
stopped and shows an actionable error.

One monotonic clock coordinates five separate WebM tracks:

- perspective-corrected board video;
- a locally derived presenter crop when tracking is enabled, or the fixed
  selected-camera frame when it is disabled;
- selected canvas video;
- confirmed microphone audio;
- desktop or tab audio from the selected display surface.

Recording state belongs to the session, not the collapsible sidebar. Hiding the
controls does not stop capture. Choose **Stop recording** before ending the
session so all pending chunks and timeline events can drain and finalize.

Chunks are acknowledged into:

```text
.chalkpilot/sessions/<session-id>/recordings/
```

This recording directory is local, gitignored, and never uploaded by
ChalkPilot. Recording does not change the live provider boundary: microphone
audio still reaches OpenAI Realtime, and corrected board images still reach the
configured provider at the learning moments described below. If the tab or app
stops unexpectedly, restart ChalkPilot and open `/replay`. Contiguous
acknowledged chunks remain discoverable as an interrupted session; recovered
tracks can still be replayed or downloaded, and missing evidence is shown
rather than presented as complete.

## Learning canvas

The canvas is intentionally typed and trusted rather than a general-purpose
webpage runtime. The agent chooses the smallest useful representation for the
learning move:

- **Chart** for a quantitative relationship or change over time;
- **Comparison** for contrasts that matter to a decision;
- **Sequence** for a process, progressively revealing only the current step;
- **Checkpoint** for a prediction, retrieval, classification, or transfer
  attempt before feedback.

Markdown, math, Mermaid, image, and YouTube remain available for the cases
they fit. The canvas specialist is guided to maintain one focal learning goal,
update the existing artifact when the learner advances, and avoid adding a
visual merely to restate prose. Raw AI-generated HTML, JavaScript, CSS, React,
and SVG are not executed or rendered. A sandboxed programmable-artifact path
is deferred rather than enabled implicitly.

## Replay Studio

Open [http://localhost:3000/replay](http://localhost:3000/replay) to see local
recordings. Each finalized session opens at `/replay/<session-id>` with:

- board, speaker, and canvas switching without resetting playback time;
- optional picture-in-picture;
- synchronized microphone and desktop audio with separate mute and volume;
- active transcript highlighting and click-to-seek;
- recovered-track health and interruption details;
- individual WebM downloads; and
- one `.chalkpilot.zip` containing the manifest, available tracks, transcript,
  and canvas events.

The local read routes are `GET /api/recordings`,
`GET /api/sessions/<id>/recording`,
`GET /api/sessions/<id>/recording/timeline`,
`GET /api/sessions/<id>/recording/tracks/<track>`, and
`GET /api/sessions/<id>/recording/export`.

## Guided-then-free field test

Run both parts with any concepts you genuinely want to learn. Use a fresh
recorded session for each part, then stop the recording and inspect that
session in Replay Studio.

### 1. Guided scenario

1. Say: “I want to learn [chosen concept]. Before explaining, ask me to show or
   state my current understanding.”
2. Make an attempt on the board, finish your turn, and say: “Inspect my attempt,
   give me one short spoken cue, and add or update one focal visual that fits
   what I need to understand.”
3. Revise your attempt and answer the agent's checkpoint or transfer question.

### 2. Free-learning scenario

1. Choose an unplanned concept in the moment and start a natural learning
   conversation without requesting a particular artifact type.
2. Use the board as part of your attempt. Once it is complete, ask the agent to
   inspect it and continue helping without naming an artifact type; let the
   agent choose the short cue and focal visual that best support the learning
   move.
3. Continue until you have revised or applied the idea and completed a
   checkpoint.

After each scenario, confirm:

- voice interaction remains brief and responsive;
- the controller visibly reports the board submission;
- the display receives a useful focal artifact and updates it as understanding
  changes;
- `/replay/<id>` opens the local tracks, follows transcript seeking, and shows
  the recorded canvas events.

## Privacy boundary

Live provider inputs and explicit local recording are separate:

| Data                                 | Live processing and provider transmission                                                                                                                                                                         | Local persistence                                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected camera frame, tracking off  | The fixed frame remains local for framing. Its corrected board image follows the provider boundary below.                                                                                                         | After explicit recording start, the fixed camera frame is stored as the speaker track alongside the corrected-board track.                                    |
| Selected camera frame, tracking on   | Board correction and presenter detection run locally. MediaPipe receives downscaled frames on this Mac; no camera frame is uploaded for tracking.                                                                 | The full selected source is never persisted. After explicit recording start, only the derived corrected-board and confirmed presenter-crop tracks are stored. |
| Corrected board image                | Sent to OpenAI Realtime after a completed learner turn or an explicit **Inspect board now** action. It is also sent to the configured canvas provider when a delegated canvas job includes current board context. | Stored as the board video track only after explicit recording start.                                                                                          |
| Microphone audio                     | Sent live to OpenAI Realtime over WebRTC for the voice conversation.                                                                                                                                              | Stored as a separate microphone track only after explicit recording start.                                                                                    |
| Presenter crop                       | Derived locally only when **Track a presenter** is enabled and not sent to the voice or canvas provider.                                                                                                          | Stored as the speaker track only after explicit recording start.                                                                                              |
| Canvas video                         | Selected through Chrome display capture and not sent to the voice or canvas provider as a recording stream.                                                                                                       | Stored as the canvas track only after explicit recording start.                                                                                               |
| Desktop or tab audio                 | Captured from the user-selected Chrome surface and not sent to OpenAI Realtime.                                                                                                                                   | Stored as a separate desktop-audio track only after explicit recording start.                                                                                 |
| Text transcript and canvas artifacts | Conversation text and canvas-job prompts/results are processed by their configured providers as part of those features.                                                                                           | Stored below `.chalkpilot/`.                                                                                                                                  |
| Recording package                    | Not sent to a provider or cloud service by ChalkPilot.                                                                                                                                                            | Stored below `.chalkpilot/sessions/<id>/recordings/`.                                                                                                         |

The UI indicates when a corrected board image is submitted. Local change
detection never autonomously interrupts the learner, and starting a recording
does not upload the five recording tracks.

## Architecture

ChalkPilot is one Next.js App Router application:

- `src/features/board` owns capture, calibration, OpenCV worker processing, and
  bounded change detection;
- `src/features/realtime` owns ephemeral credentials, the Agents SDK adapter,
  learning instructions, and typed agent tools;
- `src/features/recording` owns five-track capture, local pose tracking,
  chunk persistence, recovery, and the recording manifest;
- `src/features/replay` and `src/components/replay` own synchronized playback
  and local exports;
- `src/features/canvas-worker` owns provider selection, the bounded Vercel AI
  SDK tool loop, per-session job serialization, and asynchronous browser
  completion handling;
- `src/features/workspace` owns validated, queued, atomic local persistence;
- `src/features/display` owns the versioned `BroadcastChannel` protocol;
- `src/components/setup` and `src/components/session` compose the room flow.

The app uses the official OpenAI Agents SDK directly. See the
[OpenAI Realtime WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc)
and
[voice-agent guide](https://developers.openai.com/api/docs/guides/voice-agents).

## Development and CI

[GitHub Actions](https://github.com/SebastianBoehler/chalk-pilot/actions/workflows/ci.yml)
runs the full quality gate and a Chromium room-flow test on every push and pull
request.

```bash
npm test                 # focused unit and component tests
npm run test:e2e         # local browser flow; live OpenAI test is skipped
npm run check            # format, lint, type-check, unit tests, production build
npm audit --audit-level=high
```

Run the opt-in real-provider smoke test with a disposable test environment:

```bash
RUN_LIVE_OPENAI=1 npm run test:e2e -- e2e/live-realtime.spec.ts
```

This call uses the configured API key and incurs normal OpenAI usage.

## Troubleshooting

**The room camera is missing.** Check camera power and the capture-card cable,
then reload setup. ChalkPilot never switches cameras silently.

**Camera or microphone access was denied.** Allow access for localhost in the
browser site settings and retry. Camera access requires localhost or HTTPS.

**The corrected board is blank or skewed.** Select **Detect again**, then place
the four corner handles clockwise around only the writable board surface.

**Recording does not start.** Reopen Chrome's picker, select the canvas surface,
and enable its audio option. ChalkPilot requires both canvas video and desktop
audio and does not silently drop either track.

**The iPhone is missing.** Confirm Continuity Camera is available to macOS and
not already in use by another app, then reload setup. ChalkPilot only shows
devices exposed by Chrome.

**Replay marks a track interrupted.** The available contiguous chunks remain
usable. Download them or the session package; the manifest explains which
track ended or which sequence was missing.

**The presentation is waiting for the controller.** Reopen it from the laptop
controller. Both windows must use the same browser profile and origin.

**OpenAI is red in the readiness screen.** Confirm `OPENAI_API_KEY` exists in
`.env.local`, then restart the server.

**The Canvas worker is red.** For the default OpenAI worker, check
`OPENAI_API_KEY`. For OpenRouter, set `CANVAS_AGENT_PROVIDER`,
`CANVAS_AGENT_MODEL`, and `OPENROUTER_API_KEY`, then restart the server.

**The room has no network.** Realtime requires network access. Run `npm ci` and
`npm run build` before traveling, but verify room Wi-Fi before the session.

## Project status

This is a deliberately lean, single-user local MVP for home and lecture-room
trials. Calibration does not survive a page reload, collaboration is
voice/board based, and Chrome always retains control over display selection and
desktop-audio consent.

The implementation is an original open-source project. No source code from the
University of Tübingen AI Tutor was copied.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

Licensed under the [Apache License 2.0](LICENSE).
