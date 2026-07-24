import { Fragment } from "react";
import type { FlowArtifactData } from "@/features/workspace/artifact-schemas";

type FlowNode = FlowArtifactData["nodes"][number];

export function FlowArtifact({ data }: { data: FlowArtifactData }) {
  const { layerByNode, layers } = createLayers(data);
  const vertical = data.orientation === "vertical";

  return (
    <div
      aria-label="Concept flow"
      className="bg-surface-muted border-border overflow-x-auto rounded-2xl border p-5"
      data-orientation={data.orientation}
      role="region"
    >
      <div
        className={
          vertical ? "flex flex-col" : "flex min-w-max items-stretch gap-4"
        }
      >
        {layers.map((nodes, index) => {
          const connections = data.edges.filter(
            ({ from }) => layerByNode.get(from) === index,
          );
          return (
            <Fragment key={nodes.map(({ id }) => id).join("-")}>
              <ul
                aria-label={`Flow layer ${index + 1}`}
                className={
                  vertical
                    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    : "flex w-64 flex-col justify-center gap-3"
                }
              >
                {nodes.map((node) => (
                  <FlowNodeCard
                    active={node.id === data.activeNodeId}
                    key={node.id}
                    node={node}
                  />
                ))}
              </ul>
              {connections.length > 0 && (
                <FlowConnections
                  connections={connections}
                  nodes={data.nodes}
                  vertical={vertical}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function FlowNodeCard({ active, node }: { active: boolean; node: FlowNode }) {
  return (
    <li className="list-none">
      <article
        aria-current={active ? "true" : undefined}
        aria-label={node.title}
        className={`h-full rounded-2xl border p-4 shadow-sm ${
          active
            ? "border-primary bg-primary/10 ring-primary/15 ring-4"
            : "border-border bg-surface"
        }`}
      >
        <h3 className="text-lg font-semibold tracking-tight">{node.title}</h3>
        {node.detail && (
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {node.detail}
          </p>
        )}
      </article>
    </li>
  );
}

function FlowConnections({
  connections,
  nodes,
  vertical,
}: {
  connections: FlowArtifactData["edges"];
  nodes: FlowArtifactData["nodes"];
  vertical: boolean;
}) {
  const titleById = new Map(nodes.map(({ id, title }) => [id, title]));
  return (
    <ul
      aria-label="Flow relationships"
      className={
        vertical
          ? "flex flex-wrap items-center justify-center gap-2 py-3"
          : "flex w-28 flex-col items-center justify-center gap-2"
      }
    >
      {connections.map((edge) => (
        <li
          className="border-border bg-surface flex max-w-44 items-center gap-2 rounded-full border px-3 py-2 text-center text-xs font-semibold"
          key={`${edge.from}-${edge.to}`}
        >
          <span className="sr-only">
            {titleById.get(edge.from)} to {titleById.get(edge.to)}:
          </span>
          {edge.label && <span>{edge.label}</span>}
          <span
            aria-hidden="true"
            className="text-primary text-xl leading-none"
          >
            {vertical ? "↓" : "→"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function createLayers(data: FlowArtifactData) {
  const incoming = new Map(data.nodes.map(({ id }) => [id, 0]));
  const outgoing = new Map(
    data.nodes.map(({ id }) => [id, [] as FlowArtifactData["edges"]]),
  );
  for (const edge of data.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge);
  }

  const layerByNode = new Map<string, number>();
  const ready = data.nodes
    .filter(({ id }) => incoming.get(id) === 0)
    .map(({ id }) => id);
  for (const id of ready) layerByNode.set(id, 0);
  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) break;
    const currentLayer = layerByNode.get(current) ?? 0;
    for (const edge of outgoing.get(current) ?? []) {
      layerByNode.set(
        edge.to,
        Math.max(layerByNode.get(edge.to) ?? 0, currentLayer + 1),
      );
      const remaining = (incoming.get(edge.to) ?? 0) - 1;
      incoming.set(edge.to, remaining);
      if (remaining === 0) ready.push(edge.to);
    }
  }

  const layerCount = Math.max(...layerByNode.values(), 0) + 1;
  const layers = Array.from({ length: layerCount }, () => [] as FlowNode[]);
  for (const node of data.nodes) {
    layers[layerByNode.get(node.id) ?? 0]?.push(node);
  }
  return { layerByNode, layers };
}
