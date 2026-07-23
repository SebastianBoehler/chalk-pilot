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

  it("uses a generic heading and home guidance for a board-focused camera", () => {
    const onCameraUseChange = vi.fn();

    render(
      <CameraStep
        cameraUse="board-focused"
        onCameraUseChange={onCameraUseChange}
        onReady={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Connect a camera" }),
    ).toBeVisible();
    expect(
      screen.getByText(/nearby webcam or iPhone Continuity Camera/i),
    ).toBeVisible();
    expect(
      screen.getByText(/presenter tracking is skipped/i),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: /Room-wide camera/i }));

    expect(onCameraUseChange).toHaveBeenCalledWith("room-wide");
  });

  it("explains auditorium setup for a room-wide camera", () => {
    render(
      <CameraStep
        cameraUse="room-wide"
        onCameraUseChange={vi.fn()}
        onReady={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/manual, widest view/i),
    ).toBeVisible();
    expect(screen.getByText(/presenter tracking/i)).toBeVisible();
  });
});
