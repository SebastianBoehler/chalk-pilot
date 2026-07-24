import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadyStep } from "./ready-step";

describe("ReadyStep", () => {
  afterEach(cleanup);

  it("describes device and voice-service readiness accurately", () => {
    render(
      <ReadyStep
        boardReady
        busy={false}
        cameraReady
        microphoneReady
        onStart={vi.fn()}
        openAiReady
      />,
    );

    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(screen.getByText("Microphone")).toBeInTheDocument();
    expect(screen.getByText("Board frame")).toBeInTheDocument();
    expect(screen.getByText("Voice service")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a ready voice service status confirms configuration only/i,
      ),
    ).toHaveTextContent(/it is not connected yet/i);
  });

  it.each([
    ["camera", { cameraReady: false }],
    ["microphone", { microphoneReady: false }],
    ["board frame", { boardReady: false }],
    ["voice service", { openAiReady: false }],
  ])("blocks session start when the %s is not ready", (_, notReady) => {
    render(
      <ReadyStep
        boardReady
        busy={false}
        cameraReady
        microphoneReady
        onStart={vi.fn()}
        openAiReady
        {...notReady}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Start learning session" }),
    ).toBeDisabled();
  });
});
