import type { CanvasSectionInput } from "@/features/workspace/schema";

export const curatedArtifactExamples = [
  {
    id: "rainfall-runoff-mechanism",
    kind: "flow",
    title: "How rainfall becomes river flow",
    data: {
      orientation: "horizontal",
      nodes: [
        {
          id: "rainfall",
          title: "Rainfall",
          detail: "Water reaches the ground.",
        },
        {
          id: "soil",
          title: "Soil",
          detail: "Some water infiltrates and some remains at the surface.",
        },
        {
          id: "runoff",
          title: "Runoff",
          detail: "Surface water moves downhill.",
        },
        {
          id: "river",
          title: "River flow",
          detail: "Runoff collects in channels.",
        },
      ],
      edges: [
        { from: "rainfall", to: "soil", label: "lands on" },
        { from: "soil", to: "runoff", label: "excess becomes" },
        { from: "runoff", to: "river", label: "collects as" },
      ],
      activeNodeId: "soil",
    },
  },
  {
    id: "evaluate-a-source",
    kind: "sequence",
    title: "Check a source before using it",
    data: {
      steps: [
        {
          id: "identify-claim",
          title: "Identify the claim",
          content: "State exactly what the source asks you to accept.",
        },
        {
          id: "trace-evidence",
          title: "Trace the evidence",
          content: "Find the observation, record, or argument supporting it.",
        },
        {
          id: "check-provenance",
          title: "Check provenance",
          content: "Ask who produced the source, when, and for what purpose.",
        },
        {
          id: "decide-use",
          title: "Decide how to use it",
          content: "Use, qualify, or reject the claim based on those checks.",
        },
      ],
      activeStepId: "trace-evidence",
      reveal: "through-active",
    },
  },
  {
    id: "lease-versus-buy",
    kind: "comparison",
    title: "Lease or buy equipment",
    data: {
      columns: [
        {
          heading: "Lease",
          summary: "Pay for use over a fixed term.",
          points: ["Lower upfront cost", "No ownership at the end"],
          emphasis: "positive",
        },
        {
          heading: "Buy",
          summary: "Pay to own the equipment.",
          points: ["Higher upfront cost", "Retains resale value"],
          emphasis: "neutral",
        },
      ],
    },
  },
  {
    id: "speed-and-stopping-distance",
    kind: "chart",
    title: "Stopping distance rises with speed",
    data: {
      variant: "scatter",
      xLabel: "Speed (km/h)",
      yLabel: "Stopping distance (m)",
      series: [
        {
          name: "Dry road",
          points: [
            { x: 20, y: 6 },
            { x: 40, y: 18 },
            { x: 60, y: 36 },
            { x: 80, y: 60 },
          ],
        },
      ],
      annotations: [{ x: 80, y: 60, label: "Ten times the 20 km/h distance" }],
    },
  },
  {
    id: "predict-circuit-change",
    kind: "checkpoint",
    title: "Predict a circuit change",
    data: {
      mode: "prediction",
      prompt:
        "Two identical bulbs are in series. What happens to the first bulb if the second bulb is removed?",
      choices: [
        "It stays equally bright",
        "It becomes brighter",
        "It turns off",
      ],
      hint: "Removing the bulb opens the only path for current.",
      expectedAnswer: "It turns off",
      feedback: "The open circuit stops current through both bulb positions.",
      status: "unanswered",
      showHint: false,
      showAnswer: false,
      showFeedback: false,
    },
  },
] satisfies CanvasSectionInput[];

const selectionRules = `
Artifact policy:
- Produce exactly one focal artifact per job. Choose the simplest representation that enables the learner's next action.
- Use a flow for a mechanism, transformation, causal chain, or architecture. Use a sequence for a progressively revealed procedure or worked progression.
- Use a comparison for distinctions or trade-offs. Use a chart for quantitative relationships. Use a checkpoint for a learner prediction, retrieval, classification, or transfer attempt.
- Inspect the current canvas first. When the concept already exists, update that stable ID before appending a new section. Focus only after a successful upsert.
- Voice agent owns dialogue, pacing, and teaching strategy; this worker owns durable visual output.

Reject these anti-patterns:
- No renamed prose cards, giant text dumps, or duplicate sections. No decorative chart without quantities.
- Do not use Markdown or ASCII for a mechanism or procedure when a flow or sequence fits.
- Do not describe a plot in prose when real values or coordinates exist; make a chart instead.
- Do not reveal a checkpoint hint, answer, or feedback before the learner has attempted it unless the request explicitly asks to reveal it.
- Never invent a URL. Keep image and YouTube only when a valid public HTTP(S) URL is already available.
- Never promise or emit raw HTML, JavaScript, CSS, React, or live HTML. Do not emit uncertain Mermaid; use a trusted flow or sequence instead.
`.trim();

export const artifactPlaybookInstructions = `${selectionRules}

Concrete examples (copy the artifact structure and learning intent, not the exact topic):
${JSON.stringify(curatedArtifactExamples)}`;
