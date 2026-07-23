import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CameraStep } from "./camera-step";

describe("CameraStep", () => {
  afterEach(cleanup);

  it("requests permission before exposing camera selection", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [],
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: "room-camera",
          kind: "videoinput",
          label: "Rear room camera",
        },
      ]),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

    render(
      <CameraStep
        mediaDevices={mediaDevices}
        onPresenterTrackingChange={vi.fn()}
        onReady={vi.fn()}
        presenterTracking={false}
      />,
    );

    expect(screen.queryByLabelText("Camera")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow camera" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Camera")).toHaveValue("room-camera"),
    );
    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("keeps camera choice generic and leaves presenter tracking off by default", () => {
    const onPresenterTrackingChange = vi.fn();

    render(
      <CameraStep
        onPresenterTrackingChange={onPresenterTrackingChange}
        onReady={vi.fn()}
        presenterTracking={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Connect a camera" }),
    ).toBeVisible();
    expect(
      screen.getByText(/point the selected camera at the board or flip chart/i),
    ).toBeVisible();
    expect(
      screen.queryByRole("radio", { name: /room-wide|board-focused/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /track a presenter/i }),
    ).not.toBeChecked();
  });

  it("maps enabled presenter tracking through the single checkbox", () => {
    const onPresenterTrackingChange = vi.fn();

    render(
      <CameraStep
        onPresenterTrackingChange={onPresenterTrackingChange}
        onReady={vi.fn()}
        presenterTracking={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: /track a presenter/i }),
    );

    expect(onPresenterTrackingChange).toHaveBeenCalledWith(true);
  });
});
