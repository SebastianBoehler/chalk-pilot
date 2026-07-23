import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadyStep } from "./ready-step";

describe("ReadyStep", () => {
  afterEach(cleanup);

  it("blocks session start until the selected microphone is confirmed", () => {
    const { rerender } = render(
      <ReadyStep
        boardReady
        busy={false}
        cameraReady
        microphoneReady={false}
        onStart={vi.fn()}
        openAiReady
      />,
    );

    expect(screen.getByText("Room microphone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start learning session" }),
    ).toBeDisabled();

    rerender(
      <ReadyStep
        boardReady
        busy={false}
        cameraReady
        microphoneReady
        onStart={vi.fn()}
        openAiReady
      />,
    );

    expect(
      screen.getByRole("button", { name: "Start learning session" }),
    ).toBeEnabled();
  });
});
