# ChalkPilot

ChalkPilot turns a physical board, a room camera, a laptop, and an external
display into a voice-first learning workspace.

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
- sends no board image until a completed turn or explicit inspection;
- makes the agent-created learning canvas the primary post-onboarding
  workspace, with board context and transcript in a collapsible sidebar;
- opens a dedicated presentation window that you move to the external display;
- lets the agent append or update Markdown, math, Mermaid, image, and YouTube
  sections;
- stores canvas sections, text transcripts, events, and evidence-linked learner
  notes locally.

ChalkPilot does not record room video or raw audio. It does not require a touch
display, a separate backend, LiveKit, or a monitor-selection screen.

## Quick start

Prerequisites:

- Node.js 24 (the repository includes `.nvmrc`);
- npm;
- a Chromium-based browser;
- an OpenAI API key with access to `gpt-realtime-2.1`;
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
2. Connect the rear camera or its capture device.
3. Run `npm run room` and open `/setup`.
4. Allow camera access and select the rear high-resolution camera.
5. Confirm the detected board corners. Drag the handles if the camera is angled
   or the automatic outline is imperfect.
6. Open the presentation window, move it to the external display, and make that
   browser window fullscreen.
7. Start the session. The browser will request microphone access for Realtime
   WebRTC.
8. Keep the controller window on the laptop and work at the physical board.

There is intentionally no display picker. Browser applications cannot reliably
assign a popup to a physical monitor; moving the clean presentation window is
faster and more predictable.

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

The collapsed **Connection test** control also supports a typed diagnostic turn
when testing in a browser environment without microphone access.

## Privacy boundary

| Data                  | Processing                                            | Persistence              |
| --------------------- | ----------------------------------------------------- | ------------------------ |
| Full camera view      | Browser only                                          | Never                    |
| Rectified board image | OpenAI only at a turn boundary or explicit inspection | Never                    |
| Microphone audio      | OpenAI Realtime WebRTC                                | Not stored by ChalkPilot |
| Text transcript       | Browser and local server                              | `.chalkpilot/`           |
| Canvas artifacts      | Browser and local server                              | `.chalkpilot/`           |
| Learner observations  | Local server, with evidence and confidence            | `.chalkpilot/learner.md` |

The UI indicates when a corrected board image is submitted. Local change
detection never autonomously interrupts the learner.

## Architecture

ChalkPilot is one Next.js App Router application:

- `src/features/board` owns capture, calibration, OpenCV worker processing, and
  bounded change detection;
- `src/features/realtime` owns ephemeral credentials, the Agents SDK adapter,
  learning instructions, and typed agent tools;
- `src/features/workspace` owns validated, queued, atomic local persistence;
- `src/features/display` owns the versioned `BroadcastChannel` protocol;
- `src/components/setup` and `src/components/session` compose the room flow.

The app uses the official OpenAI Agents SDK directly. See the
[OpenAI Realtime WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc)
and
[voice-agent guide](https://developers.openai.com/api/docs/guides/voice-agents).

## Commands

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

**The room has no network.** Realtime requires network access. Run `npm ci` and
`npm run build` before traveling, but verify room Wi-Fi before the session.

## Project status

This is a deliberately lean, single-user MVP for an in-room trial. Calibration
does not survive a page reload, collaboration is voice/board based, and physical
Cyber Valley camera compatibility still needs to be confirmed in the room.

The implementation is an original open-source project. No source code from the
University of Tübingen AI Tutor was copied.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

Licensed under the [Apache License 2.0](LICENSE).
