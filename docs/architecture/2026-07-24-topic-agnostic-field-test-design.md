# Topic-Agnostic Field-Test Design

## Goal

Make the next room test both reliable and educationally meaningful without
optimizing ChalkPilot for one subject. The system should select visual tools
from the learner's immediate cognitive task, whether the topic is mathematics,
law, biology, programming, or something else.

## Scope

This iteration combines two priorities:

1. a predictable setup-to-replay field-test loop; and
2. better artifact selection and teaching progression during an unfamiliar
   learning conversation.

It does not add resumable sessions, cloud storage, remote-phone QR streaming,
or executable AI-generated HTML. Those features change the lifecycle or
security model and are intentionally deferred until the core room interaction
has another successful field test.

## Approaches considered

### Subject templates

Curated templates for NLP, gradient descent, or another test topic could make
one demonstration look polished, but would hide whether ChalkPilot generalizes.
This approach is rejected.

### Arbitrary generated webpages

A sandbox could render almost any visualization, but introduces a second
runtime, security boundaries, and failure modes before the room interaction is
stable. This approach remains deferred.

### Learning-move routing

The selected approach extends the trusted artifact vocabulary with a typed
flow diagram and routes artifacts by purpose:

- flow for mechanisms, transformations, causal chains, and architectures;
- chart for quantitative relationships;
- comparison for distinctions and trade-offs;
- sequence for procedures that should be progressively revealed; and
- checkpoint for prediction, retrieval, classification, or transfer.

The artifact contains validated data only and is rendered by owned React code.

## Teaching loop

The voice agent should normally move through:

1. elicit the learner's current explanation, prediction, drawing, or attempt;
2. inspect the board when visual evidence is needed;
3. give one short spoken cue rather than a lecture;
4. delegate one durable focal artifact chosen by learning move;
5. ask the learner to revise, explain, or apply the idea; and
6. use a checkpoint before revealing an answer or moving on.

This is a policy, not a rigid state machine. The learner can ask directly for
an explanation, skip a step, or change topics. Existing artifact IDs should be
updated as understanding advances rather than creating a feed of new cards.

## Flow artifact

A flow artifact is a bounded directed graph with two to eight nodes and one to
twelve edges. The agent supplies node IDs, concise labels, optional details,
edges, orientation, and an optional active node. It cannot supply coordinates,
CSS, SVG, HTML, or callbacks.

The renderer derives a deterministic layered layout from the graph. It shows
clear nodes, directional connectors, relationship labels, and an active state.
Invalid references, duplicate IDs, self-edges, and cycles are rejected by the
schema so rendering never needs a permissive fallback.

## Field-test contract

The ready screen remains minimal but uses device-neutral labels and explains
what each status actually proves. It must not imply that an API configuration
check proves a connected voice session. The documented smoke test has two
parts:

- a repeatable guided scenario on any chosen concept; then
- an unplanned free-learning scenario.

Both exercise voice, board inspection, focal canvas updates, recording, and
Replay Studio.

## Failure handling

- Invalid flow payloads are rejected before persistence.
- A flow renderer failure is contained to its section.
- The agent must prefer an existing safe typed artifact over uncertain
  Mermaid or raw code.
- Setup errors stay visible and prevent session start.
- No hidden provider, model, or artifact fallback is introduced.

## Verification

- Schema tests cover valid graphs and every rejected graph invariant.
- Renderer tests verify semantic structure, labels, active state, and the
  absence of executable payloads.
- Prompt tests verify the learning-move taxonomy and attempt-first loop.
- Setup tests verify accurate generic readiness language.
- Playwright verifies synchronized display rendering and incremental flow
  updates.
- The full format, lint, type, unit, build, and E2E suites remain required.
