import type { CanvasSectionInput } from "@/features/workspace/schema";

export const curatedArtifactExamples = [
  {
    id: "tokenization-pipeline",
    kind: "sequence",
    title: "Text becomes model input",
    data: {
      steps: [
        {
          id: "source-text",
          title: "Start with text",
          content: 'The learner writes: "unbelievable".',
        },
        {
          id: "token-pieces",
          title: "Split into pieces",
          content: 'A subword tokenizer may produce "un" | "believ" | "able".',
        },
        {
          id: "token-ids",
          title: "Look up IDs",
          content:
            "Each piece maps to a vocabulary ID such as 17, 932, and 41.",
        },
        {
          id: "embeddings",
          title: "Create vectors",
          content:
            "The embedding table turns each ID into the vector the model processes.",
        },
      ],
      activeStepId: "token-ids",
      reveal: "through-active",
    },
  },
  {
    id: "token-granularity",
    kind: "comparison",
    title: "Three tokenization choices",
    data: {
      columns: [
        {
          heading: "Word",
          summary: "One token per known word.",
          points: ["Easy to inspect", "Large vocabulary"],
          emphasis: "neutral",
        },
        {
          heading: "Subword",
          summary: "Frequent pieces combine into new words.",
          points: ["Handles rare words", "Less intuitive splits"],
          emphasis: "positive",
        },
        {
          heading: "Character",
          summary: "One token per character.",
          points: ["No unknown words", "Longer sequences"],
          emphasis: "caution",
        },
      ],
    },
  },
  {
    id: "embedding-neighborhood",
    kind: "chart",
    title: "Embedding neighborhood (illustrative coordinates)",
    data: {
      variant: "scatter",
      xLabel: "Dimension 1",
      yLabel: "Dimension 2",
      series: [
        {
          name: "Tokens",
          points: [
            { x: -1.2, y: 0.9, label: "cat" },
            { x: -0.8, y: 1.1, label: "dog" },
            { x: 1.0, y: -0.7, label: "run" },
            { x: 1.3, y: -1.0, label: "walk" },
          ],
        },
      ],
      annotations: [
        { x: -1.2, y: 0.9, label: "cat" },
        { x: -0.8, y: 1.1, label: "dog" },
        { x: 1, y: -0.7, label: "run" },
        { x: 1.3, y: -1, label: "walk" },
      ],
    },
  },
  {
    id: "predict-tokenization",
    kind: "checkpoint",
    title: "Predict the next representation",
    data: {
      mode: "prediction",
      prompt:
        'A tokenizer turns "unbelievable" into three token IDs. What does the embedding layer receive next?',
      choices: [
        "The three token strings",
        "The three token IDs",
        "One probability distribution",
      ],
      hint: "The embedding layer is a lookup table indexed by vocabulary IDs.",
      expectedAnswer: "The three token IDs",
      feedback: "Those IDs select three learned vectors for the model input.",
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
- For a process with steps, use a sequence. For alternatives or trade-offs, use a comparison. For quantities or coordinates, use a chart. For a learner prediction or retrieval attempt, use a checkpoint.
- Inspect the current canvas first. When the concept already exists, update that stable ID before appending a new section. Focus only after a successful upsert.
- Voice agent owns dialogue, pacing, and teaching strategy; this worker owns durable visual output.

Reject these anti-patterns:
- No renamed prose cards, giant text dumps, or duplicate sections. No decorative chart without quantities.
- Do not use Markdown or ASCII for a process when a sequence fits.
- Do not describe a plot in prose when real values or coordinates exist; make a chart instead.
- Do not reveal a checkpoint hint, answer, or feedback before the learner has attempted it unless the request explicitly asks to reveal it.
- Never invent a URL. Keep image and YouTube only when a valid public HTTP(S) URL is already available.
- Never promise or emit raw HTML, JavaScript, CSS, React, or live HTML. Do not emit uncertain Mermaid; use a sequence or comparison instead.
`.trim();

export const artifactPlaybookInstructions = `${selectionRules}

Concrete examples (copy the artifact structure and learning intent, not the exact topic):
${JSON.stringify(curatedArtifactExamples)}`;
