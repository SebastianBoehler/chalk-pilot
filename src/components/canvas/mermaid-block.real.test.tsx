import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MermaidBlock } from "./mermaid-block";

describe("MermaidBlock with Mermaid 11", () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll('[id^="dchalkpilot-"]').forEach((node) => {
      node.remove();
    });
  });

  it("contains Mermaid's invalid-syntax error inside the artifact", async () => {
    render(<MermaidBlock source="flowchart TD\nA -->" />);

    expect(
      await screen.findByText("This diagram could not be rendered."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.body.querySelector('[id^="dchalkpilot-"]')).toBeNull();
    });
    expect(document.body.textContent).not.toContain("Syntax error in text");
  });
});
