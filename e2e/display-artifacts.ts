export const artifactSections = [
  {
    id: "recall-growth",
    kind: "chart",
    title: "Recall growth",
    data: {
      variant: "line",
      xLabel: "Practice round",
      yLabel: "Correct recalls",
      series: [
        {
          name: "Recall",
          points: [
            { x: 1, y: 2 },
            { x: 2, y: 5 },
            { x: 3, y: 8 },
          ],
        },
      ],
    },
  },
  {
    id: "learning-mechanism",
    kind: "flow",
    title: "From evidence to transfer",
    data: {
      orientation: "horizontal",
      activeNodeId: "connect",
      nodes: [
        {
          id: "observe",
          title: "Observe evidence",
          detail: "Notice the part that changes.",
        },
        {
          id: "connect",
          title: "Connect the mechanism",
          detail: "Explain why the evidence produces the result.",
        },
        {
          id: "transfer",
          title: "Try a new case",
          detail: "Use the same mechanism in a different situation.",
        },
      ],
      edges: [
        { from: "observe", to: "connect", label: "supports" },
        { from: "connect", to: "transfer", label: "generalizes to" },
      ],
    },
  },
  {
    id: "retrieval-loop",
    kind: "sequence",
    title: "Retrieval loop",
    data: {
      activeStepId: "recall",
      reveal: "active",
      steps: [
        {
          id: "recall",
          title: "Retrieve from memory",
          content: "Say what you remember before seeing the answer.",
        },
        {
          id: "check",
          title: "Check the evidence",
          content: "Compare with notes and repair only the missing link.",
        },
        {
          id: "apply",
          title: "Apply again",
          content: "Use the idea in a fresh example.",
        },
      ],
    },
  },
  {
    id: "retrieval-check",
    kind: "checkpoint",
    title: "Prediction before feedback",
    data: {
      mode: "prediction",
      prompt: "Which step comes before checking notes?",
      choices: ["Retrieve from memory", "Read the answer first"],
      hint: "Commit to your best guess before seeing feedback.",
      expectedAnswer: "Retrieve from memory.",
      feedback: "Effortful recall makes the gap visible.",
      status: "unanswered",
      showHint: false,
      showAnswer: false,
      showFeedback: false,
    },
  },
  {
    id: "compare-recall",
    kind: "comparison",
    title: "Recall versus rereading",
    data: {
      columns: [
        {
          heading: "Retrieve",
          summary: "Attempt before feedback.",
          points: ["Makes gaps visible", "Strengthens recall routes"],
          emphasis: "positive",
        },
        {
          heading: "Reread",
          summary: "Review without a prior attempt.",
          points: ["Feels fluent", "Can hide gaps"],
          emphasis: "caution",
        },
      ],
    },
  },
  {
    id: "invalid-diagram",
    kind: "mermaid",
    title: "Contained diagram failure",
    content: "flowchart TD\nA -->",
  },
] as const;
