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
        cameraUse="pending"
        mediaDevices={mediaDevices}
        onCameraUseChange={vi.fn()}
        onReady={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Camera")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow camera" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Camera")).toHaveValue("room-camera"),
    );
    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("offers generic room-wide and board-focused camera uses", () => {
    const onCameraUseChange = vi.fn();

    render(
      <CameraStep
        cameraUse="pending"
        onCameraUseChange={onCameraUseChange}
        onReady={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: /Board-focused camera/i }),
    );

    expect(onCameraUseChange).toHaveBeenCalledWith("board-focused");
    expect(screen.getByText(/whiteboard or flip chart/i)).toBeVisible();
  });
});
