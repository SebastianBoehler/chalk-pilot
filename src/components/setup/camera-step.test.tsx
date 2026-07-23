import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CameraStep } from "./camera-step";

describe("CameraStep", () => {
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

    render(<CameraStep mediaDevices={mediaDevices} onReady={vi.fn()} />);

    expect(screen.queryByLabelText("Camera")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow camera" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Camera")).toHaveValue("room-camera"),
    );
    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });
});
