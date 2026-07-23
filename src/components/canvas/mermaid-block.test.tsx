import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MermaidBlock } from "./mermaid-block";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaid }));

function appendTemporaryNode(renderId: string) {
  const node = document.createElement("div");
  node.id = `d${renderId}`;
  node.dataset.mermaidTemporary = "true";
  document.body.append(node);
  return node;
}

function addUnrelatedTemporaryNode() {
  const node = document.createElement("div");
  node.id = "dchalkpilot-unrelated";
  document.body.append(node);
  return node;
}

describe("MermaidBlock", () => {
  beforeEach(() => {
    mermaid.initialize.mockReset();
    mermaid.parse.mockReset();
    mermaid.render.mockReset();
  });

  afterEach(() => {
    cleanup();
    document.querySelectorAll('[id^="dchalkpilot-"]').forEach((node) => {
      node.remove();
    });
  });

  it("contains an invalid diagram without calling Mermaid render", async () => {
    const source = "flowchart TD\nA -->";
    mermaid.parse.mockResolvedValue(false);
    mermaid.render.mockImplementation(async (renderId: string) => {
      appendTemporaryNode(renderId);
      throw new Error("invalid Mermaid");
    });

    render(<MermaidBlock source={source} />);

    expect(
      await screen.findByText("This diagram could not be rendered."),
    ).toBeInTheDocument();
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict" }),
    );
    expect(mermaid.parse).toHaveBeenCalledWith(source, {
      suppressErrors: true,
    });
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-mermaid-temporary="true"]'),
    ).not.toBeInTheDocument();
  });

  it("recovers when an invalid diagram source becomes valid", async () => {
    const invalidSource = "flowchart TD\nA -->";
    mermaid.parse.mockImplementation(async (source: string) =>
      source === invalidSource ? false : { diagramType: "flowchart-v2" },
    );
    mermaid.render.mockImplementation(
      async (renderId: string, source: string) => {
        if (source === invalidSource) {
          appendTemporaryNode(renderId);
          throw new Error("invalid Mermaid");
        }
        return { svg: '<svg data-testid="rendered-diagram"></svg>' };
      },
    );

    const view = render(<MermaidBlock source={invalidSource} />);

    expect(
      await screen.findByText("This diagram could not be rendered."),
    ).toBeInTheDocument();

    view.rerender(<MermaidBlock source="flowchart TD\nA --> B" />);

    await waitFor(() => {
      expect(screen.getByTestId("rendered-diagram")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("This diagram could not be rendered."),
    ).not.toBeInTheDocument();
  });

  it("removes only its temporary Mermaid node after a render failure", async () => {
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
    const unrelatedNode = addUnrelatedTemporaryNode();
    mermaid.render.mockImplementation(async (renderId: string) => {
      appendTemporaryNode(renderId);
      throw new Error("renderer crashed");
    });

    render(<MermaidBlock source="flowchart TD\nA --> B" />);

    await screen.findByText("This diagram could not be rendered.");
    expect(
      document.querySelector('[data-mermaid-temporary="true"]'),
    ).not.toBeInTheDocument();
    expect(unrelatedNode).toBeInTheDocument();
  });

  it("removes only its temporary Mermaid node when unmounted mid-render", async () => {
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
    const unrelatedNode = addUnrelatedTemporaryNode();
    mermaid.render.mockImplementation((renderId: string) => {
      appendTemporaryNode(renderId);
      return new Promise(() => undefined);
    });

    const view = render(<MermaidBlock source="flowchart TD\nA --> B" />);
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce());

    view.unmount();

    expect(
      document.querySelector('[data-mermaid-temporary="true"]'),
    ).not.toBeInTheDocument();
    expect(unrelatedNode).toBeInTheDocument();
  });

  it("does not remove a newer render node when a previous render rejects", async () => {
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
    let rejectFirstRender: (reason?: unknown) => void = () => undefined;
    mermaid.render.mockImplementation((renderId: string) => {
      appendTemporaryNode(renderId);
      if (mermaid.render.mock.calls.length === 1) {
        return new Promise((_, reject) => {
          rejectFirstRender = reject;
        });
      }
      return new Promise(() => undefined);
    });

    const view = render(<MermaidBlock source="flowchart TD\nA --> B" />);
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce());

    view.rerender(<MermaidBlock source="flowchart TD\nA --> C" />);
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2));

    rejectFirstRender(new Error("old render failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      document.querySelector('[data-mermaid-temporary="true"]'),
    ).toBeInTheDocument();
  });
});
