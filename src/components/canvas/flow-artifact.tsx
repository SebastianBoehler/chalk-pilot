import { Fragment } from "react";
import type { FlowArtifactData } from "@/features/workspace/artifact-schemas";
import { nestedTarget } from "@/features/canvas-navigation/schema";

type FlowNode = FlowArtifactData["nodes"][number];

export function FlowArtifact({
  data,
  sectionId,
}: {
  data: FlowArtifactData;
  sectionId?: string;
}) {
  const { layerByNode, layers } = createLayers(data);
  const vertical = data.orientation === "vertical";

  return (
    <div
      aria-label="Concept flow"
      className="bg-surface-muted border-border overflow-hidden rounded-2xl border p-5"
      data-orientation={data.orientation}
      role="region"
    >
      <div
        data-testid="flow-layout"
        className={
          vertical
            ? "flex flex-col"
            : "flex min-w-0 flex-col gap-4 2xl:flex-row 2xl:items-stretch"
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
                    : "grid min-w-0 gap-3 sm:grid-cols-2 2xl:flex 2xl:w-64 2xl:shrink-0 2xl:flex-col 2xl:justify-center"
                }
              >
                {nodes.map((node) => (
                  <FlowNodeCard
                    active={node.id === data.activeNodeId}
                    key={node.id}
                    node={node}
                    sectionId={sectionId}
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

function FlowNodeCard({
  active,
  node,
  sectionId,
}: {
  active: boolean;
  node: FlowNode;
  sectionId?: string;
}) {
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
        data-canvas-target={
          sectionId ? nestedTarget(sectionId, node.id) : undefined
        }
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
          : "flex min-w-0 flex-wrap items-center justify-center gap-2 py-1 2xl:w-28 2xl:shrink-0 2xl:flex-col 2xl:py-0"
      }
    >
      {connections.map((edge) => (
        <li
          aria-label={`${titleById.get(edge.from)} to ${titleById.get(edge.to)}`}
          className="border-border bg-surface flex max-w-48 flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-center text-xs"
          data-flow-from={edge.from}
          data-flow-to={edge.to}
          key={JSON.stringify([edge.from, edge.to])}
        >
          <span className="flex items-center gap-2 font-semibold">
            <span data-flow-endpoint>{titleById.get(edge.from)}</span>
            <FlowArrow vertical={vertical} />
            <span data-flow-endpoint>{titleById.get(edge.to)}</span>
          </span>
          {edge.label && <span>{edge.label}</span>}
        </li>
      ))}
    </ul>
  );
}

function FlowArrow({ vertical }: { vertical: boolean }) {
  if (vertical) {
    return (
      <span aria-hidden="true" className="text-primary text-xl leading-none">
        ↓
      </span>
    );
  }
  return (
    <>
      <span
        aria-hidden="true"
        className="text-primary text-xl leading-none 2xl:hidden"
      >
        ↓
      </span>
      <span
        aria-hidden="true"
        className="text-primary hidden text-xl leading-none 2xl:inline"
      >
        →
      </span>
    </>
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
