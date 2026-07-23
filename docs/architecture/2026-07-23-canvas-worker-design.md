# Canvas Worker Design

## Goal

Keep ChalkPilot's OpenAI Realtime tutor responsive while a separate,
provider-selectable agent creates and updates durable canvas artifacts in the
background.

## Boundaries

- The voice tutor owns dialogue, board inspection, teaching strategy, and
  learner memory.
- The canvas worker owns only canvas creation, correction, and focus.
- The worker receives a bounded job containing the tutor's goal, an optional
  corrected board crop, and the current canvas.
- Worker mutations use ChalkPilot's existing validated repository. The model
  never receives filesystem or arbitrary application-code execution tools.
- The first version supports the existing typed Markdown, math, Mermaid, image,
  and YouTube artifacts. Markdown covers tables, comparisons, timelines, and
  fenced code. Sandboxed generated React or HTML is out of scope.

## Runtime

The browser-side Realtime agent gains a `delegate_canvas_task` tool. Calling it
starts a background request and immediately returns a job ID, so the Realtime
response is not blocked by artifact generation.

The Next.js canvas-worker route runs a bounded Vercel AI SDK `ToolLoopAgent`.
Its tools read the current canvas, upsert typed sections, and focus a section.
Jobs are serialized per session. On completion, the browser replaces its
canvas with the persisted server result and adds a private completion item to
the Realtime conversation without forcing an interruption.

The session UI reports `idle`, `building`, `complete`, or `error` independently
from the voice connection.

## Providers

OpenAI is the default and reuses `OPENAI_API_KEY`. OpenRouter is opt-in:

```dotenv
CANVAS_AGENT_PROVIDER=openai
CANVAS_AGENT_MODEL=gpt-5-mini

# Alternative:
# CANVAS_AGENT_PROVIDER=openrouter
# CANVAS_AGENT_MODEL=openai/gpt-5-mini
# OPENROUTER_API_KEY=
```

OpenRouter requests prioritize throughput, require tool-capable endpoints, and
deny provider data collection. Missing or unsupported configuration is shown
as a canvas-worker error; ChalkPilot does not silently change providers.

## Data Flow

1. The tutor calls `delegate_canvas_task` with a concrete learning goal and
   artifact preference.
2. ChalkPilot captures the latest corrected board image and starts the worker
   request without awaiting it inside the Realtime tool call.
3. The server validates the job, loads the canvas, and serializes it behind any
   earlier job for the same session.
4. The canvas agent uses typed tools to append or update sections and focus the
   most relevant result.
5. The server returns the persisted canvas plus a short completion summary.
6. The browser updates both the main and clean displays and informs the voice
   tutor that the artifact is ready.

## Failure Behavior

- Invalid jobs return `400`.
- Missing sessions return `404`.
- Missing provider credentials or provider failures return a bounded `503` or
  `502` response.
- A worker failure does not end or mark the Realtime voice session as failed.
- Concurrent requests for one session run in submission order.

## Verification

- Unit tests cover validation, provider selection, typed canvas mutations,
  per-session serialization, and asynchronous Realtime delegation.
- Component tests cover visible worker state.
- Route tests cover success and bounded errors with an injected worker.
- The full quality gate and browser flow must remain green.
