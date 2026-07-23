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
    <a href="#home-setup">Home setup</a> ·
    <a href="#lecture-room-setup">Lecture room setup</a> ·
    <a href="#replay-studio">Replay Studio</a> ·
    <a href="#architecture">Architecture</a>
  </p>
</div>

You work with your hands at the board. A short-spoken OpenAI learning agent can
inspect the perspective-corrected board at visible turn boundaries and place
durable explanations, formulas, diagrams, images, or videos on a separate
presentation canvas.

## What the MVP does

- selects any browser camera, including a high-resolution room camera or an
  iPhone exposed through macOS Continuity Camera;
- supports a nearby `board-focused` camera and a `room-wide` camera with a
  confirmed, locally tracked presenter;
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
  and YouTube sections;
- stores canvas sections, text transcripts, events, and evidence-linked learner
  notes locally.

The full room-wide camera feed stays on the Mac. Live microphone audio is sent
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

## Home setup

ChalkPilot uses standard browser media APIs, so it does not need an iPhone SDK
or a camera-name special case. If macOS presents your iPhone as a camera in
Chrome, ChalkPilot can select it like any other input.

1. Mount the iPhone so the full whiteboard or flip chart stays in frame.
2. Make the iPhone available through macOS Continuity Camera, then open
   `/setup` in Chrome.
3. Choose **Board-focused camera**, allow camera access, and select the iPhone
   from the camera menu.
4. Select and confirm the microphone you want both the Realtime partner and the
   recording to use.
5. Confirm the board corners and check the fixed camera and corrected-board
   previews. Presenter confirmation is intentionally skipped in this mode.
6. Start the learning session. Keep the canvas on the laptop, or move a clean
   display window to an additional monitor.

Board-focused mode records the fixed camera frame as the speaker view. It does
not crop or chase a person who is already deliberately framed by the phone.

## Lecture room setup

1. Connect the MacBook to the room display and use extended-desktop mode.
2. Connect the rear camera or its capture device and set the auditorium camera
   to its manual, widest view.
3. Run `npm run room` and open `/setup`.
4. Choose **Room-wide camera**, allow camera access, and select the rear
   high-resolution camera.
5. Allow microphone access, select the room input, verify its live level, and
   confirm it. ChalkPilot reuses this exact stream for Realtime and recording.
6. Confirm the detected board corners. The handle surface follows the selected
   stream's real dimensions; drag the handles if the camera is angled or the
   automatic outline is imperfect.
7. In the output check, click your detected outline to confirm the presenter,
   then walk through the teaching area and verify that the crop follows you.
8. Start the session. Realtime WebRTC uses the microphone confirmed during
   setup without requesting a different input.
9. Move the main canvas to the external screen, or optionally open the clean
   display while keeping session controls on the laptop.

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
- tracked presenter video in room-wide mode, or the fixed camera in
  board-focused mode;
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

## Two-turn room smoke test

Use this before a lecture:

1. Say: “I am trying to explain gradient descent. Ask me to draw my current
   understanding before you explain it.”
2. Draw the update direction on the board and say: “Here is my attempt. Inspect
   it, give me one spoken cue, and put the durable comparison on the display.”

Expected result:

- the agent answers briefly;
- the controller visibly reports a board submission;
- the display gains a useful section;
- if recording was not started, `.chalkpilot/sessions/<id>/` contains text and
  canvas files but no recording tracks;
- if recording was started and stopped, `/replay/<id>` opens all five local
  tracks.

## Privacy boundary

Live provider inputs and explicit local recording are separate:

| Data                                 | Live processing and provider transmission                                                                                                                                                                         | Local persistence                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Room-wide camera frames              | Board correction and presenter detection run locally. MediaPipe receives downscaled frames on this Mac; no camera frame is uploaded for tracking.                                                                 | The full wide source is never persisted. After explicit recording start, only the derived corrected-board and presenter-crop tracks are stored. |
| Board-focused camera frames          | The fixed frame remains local for framing. Its corrected board image follows the provider boundary below.                                                                                                         | After explicit recording start, the fixed full-camera view is deliberately stored as the speaker track, alongside the corrected-board track.    |
| Corrected board image                | Sent to OpenAI Realtime after a completed learner turn or an explicit **Inspect board now** action. It is also sent to the configured canvas provider when a delegated canvas job includes current board context. | Stored as the board video track only after explicit recording start.                                                                            |
| Microphone audio                     | Sent live to OpenAI Realtime over WebRTC for the voice conversation.                                                                                                                                              | Stored as a separate microphone track only after explicit recording start.                                                                      |
| Presenter crop                       | Derived locally from the room-wide camera and not sent to the voice or canvas provider.                                                                                                                           | Stored as the speaker track only after explicit recording start.                                                                                |
| Canvas video                         | Selected through Chrome display capture and not sent to the voice or canvas provider as a recording stream.                                                                                                       | Stored as the canvas track only after explicit recording start.                                                                                 |
| Desktop or tab audio                 | Captured from the user-selected Chrome surface and not sent to OpenAI Realtime.                                                                                                                                   | Stored as a separate desktop-audio track only after explicit recording start.                                                                   |
| Text transcript and canvas artifacts | Conversation text and canvas-job prompts/results are processed by their configured providers as part of those features.                                                                                           | Stored below `.chalkpilot/`.                                                                                                                    |
| Recording package                    | Not sent to a provider or cloud service by ChalkPilot.                                                                                                                                                            | Stored below `.chalkpilot/sessions/<id>/recordings/`.                                                                                           |

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
