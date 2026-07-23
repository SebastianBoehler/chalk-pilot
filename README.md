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
    <a href="#room-setup">Room setup</a> ·
    <a href="#architecture">Architecture</a>
  </p>
</div>

You work with your hands at the board. A short-spoken OpenAI learning agent can
inspect the perspective-corrected board at visible turn boundaries and place
durable explanations, formulas, diagrams, images, or videos on a separate
presentation canvas.

## What the MVP does

- selects a high-resolution room camera;
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
- records the corrected board, a locally tracked speaker crop, and the selected
  canvas as three separate local WebM videos;
- lets the canvas specialist append or update Markdown, math, Mermaid, image,
  and YouTube sections;
- stores canvas sections, text transcripts, events, and evidence-linked learner
  notes locally.

ChalkPilot does not upload or persist the raw room feed or raw audio. It does
not require a touch display, a separate backend, LiveKit, or a
monitor-selection screen.

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

## Room setup

1. Connect the MacBook to the room display and use extended-desktop mode.
2. Connect the rear camera or its capture device and set the auditorium camera
   to its manual, widest view.
3. Run `npm run room` and open `/setup`.
4. Allow camera access and select the rear high-resolution camera.
5. Allow microphone access, select the room input, verify its live level, and
   confirm it. ChalkPilot reuses this exact stream for Realtime and recording.
6. Confirm the detected board corners. The handle surface follows the selected
   stream's real dimensions; drag the handles if the camera is angled or the
   automatic outline is imperfect.
7. Start the session. Realtime WebRTC uses the microphone confirmed during
   setup without requesting a different input.
8. Move the main canvas to the external screen, or optionally open the clean
   display while keeping session controls on the laptop.

There is intentionally no display picker. Browser applications cannot reliably
assign a popup to a physical monitor; moving the clean presentation window is
faster and more predictable.

## Local recording

Open **Recording** in the session controls and choose **Start 3 recordings**.
Chrome will ask which tab or window contains the canvas. ChalkPilot includes
and prefers the current tab in that picker; select the clean-display tab for
canvas-only output, or the main ChalkPilot tab to include the sidebar.
ChalkPilot then keeps three local recordings:

- the perspective-corrected board frame;
- a smoothed speaker crop driven by local motion tracking;
- the selected canvas tab or window.

Stop recording before ending the session, then download each WebM separately.
The source room video and recorded files are not uploaded or persisted by
ChalkPilot.

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
- `.chalkpilot/sessions/<id>/` contains text and canvas files but no camera or
  audio recording.

## Privacy boundary

| Data                  | Processing                                                                                 | Persistence              |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| Full camera view      | Browser only                                                                               | Never                    |
| Rectified board image | Voice provider at a turn boundary; selected canvas provider when a canvas job is delegated | Never                    |
| Microphone audio      | OpenAI Realtime WebRTC                                                                     | Not stored by ChalkPilot |
| Text transcript       | Browser and local server                                                                   | `.chalkpilot/`           |
| Canvas artifacts      | Browser and local server                                                                   | `.chalkpilot/`           |
| Learner observations  | Local server, with evidence and confidence                                                 | `.chalkpilot/learner.md` |
| Recorded WebM videos  | Browser only                                                                               | User download only       |

The UI indicates when a corrected board image is submitted. Local change
detection never autonomously interrupts the learner.

## Architecture

ChalkPilot is one Next.js App Router application:

- `src/features/board` owns capture, calibration, OpenCV worker processing, and
  bounded change detection;
- `src/features/realtime` owns ephemeral credentials, the Agents SDK adapter,
  learning instructions, and typed agent tools;
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

This is a deliberately lean, single-user MVP for an in-room trial. Calibration
does not survive a page reload, collaboration is voice/board based, and each
room camera must be switched to a stable manual/wide composition before
calibration.

The implementation is an original open-source project. No source code from the
University of Tübingen AI Tutor was copied.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

Licensed under the [Apache License 2.0](LICENSE).
