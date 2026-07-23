import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneStep } from "./microphone-step";

function microphoneStream(deviceId: string) {
  const track = {
    getSettings: () => ({ deviceId }),
    readyState: "live",
    stop: vi.fn(),
  };
  return {
    stream: {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream,
    track,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const devices = [
  {
    deviceId: "mic-1",
    kind: "audioinput",
    label: "Lectern microphone",
  },
  {
    deviceId: "mic-2",
    kind: "audioinput",
    label: "Laptop microphone",
  },
];

describe("MicrophoneStep", () => {
  afterEach(cleanup);

  it("explains a denied microphone permission", async () => {
    const mediaDevices = {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      enumerateDevices: vi.fn(),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

    render(<MicrophoneStep mediaDevices={mediaDevices} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));

    expect(
      await screen.findByText(/microphone permission was denied/i),
    ).toBeInTheDocument();
  });

  it("shows live level, stops a replaced stream, and confirms the exact selection", async () => {
    const first = microphoneStream("mic-1");
    const second = microphoneStream("mic-2");
    const mediaDevices = {
      getUserMedia: vi
        .fn()
        .mockResolvedValueOnce(first.stream)
        .mockResolvedValueOnce(second.stream),
      enumerateDevices: vi.fn().mockResolvedValue(devices),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
    let reportLevel: (level: number) => void = () => {};
    const stopLevel = vi.fn();
    const monitorLevel = vi.fn(
      (_stream: MediaStream, onLevel: (level: number) => void) => {
        reportLevel = onLevel;
        return stopLevel;
      },
    );
    const onConfirm = vi.fn();
    const view = render(
      <MicrophoneStep
        mediaDevices={mediaDevices}
        monitorLevel={monitorLevel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Microphone")).toHaveValue("mic-1"),
    );

    act(() => reportLevel(0.64));
    expect(screen.getByRole("meter", { name: "Input level" })).toHaveValue(
      0.64,
    );

    fireEvent.change(screen.getByLabelText("Microphone"), {
      target: { value: "mic-2" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Microphone")).toHaveValue("mic-2");
      expect(mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
        audio: { deviceId: { exact: "mic-2" } },
        video: false,
      });
    });
    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(stopLevel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Confirm microphone" }));
    expect(onConfirm).toHaveBeenCalledWith(second.stream);

    view.unmount();
    expect(second.track.stop).not.toHaveBeenCalled();
  });

  it("stops an unconfirmed stream when setup unmounts", async () => {
    const input = microphoneStream("mic-1");
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(input.stream),
      enumerateDevices: vi.fn().mockResolvedValue(devices),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
    const view = render(
      <MicrophoneStep
        mediaDevices={mediaDevices}
        monitorLevel={() => vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));
    await screen.findByLabelText("Microphone");

    view.unmount();

    expect(input.track.stop).toHaveBeenCalledOnce();
  });

  it("stops a stale acquisition without replacing the newer selection", async () => {
    const initial = microphoneStream("mic-1");
    const stale = microphoneStream("mic-2");
    const newest = microphoneStream("mic-1");
    const staleRequest = deferred<MediaStream>();
    const newestRequest = deferred<MediaStream>();
    const mediaDevices = {
      getUserMedia: vi
        .fn()
        .mockResolvedValueOnce(initial.stream)
        .mockReturnValueOnce(staleRequest.promise)
        .mockReturnValueOnce(newestRequest.promise),
      enumerateDevices: vi.fn().mockResolvedValue(devices),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
    const onConfirm = vi.fn();
    render(
      <MicrophoneStep
        mediaDevices={mediaDevices}
        monitorLevel={() => vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));
    await screen.findByLabelText("Microphone");

    fireEvent.change(screen.getByLabelText("Microphone"), {
      target: { value: "mic-2" },
    });
    fireEvent.change(screen.getByLabelText("Microphone"), {
      target: { value: "mic-1" },
    });
    await act(async () => newestRequest.resolve(newest.stream));
    await act(async () => staleRequest.resolve(stale.stream));

    await waitFor(() => expect(stale.track.stop).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Confirm microphone" }));
    expect(onConfirm).toHaveBeenCalledWith(newest.stream);
    expect(initial.track.stop).toHaveBeenCalledOnce();
  });

  it("stops a pending acquisition that resolves after unmount", async () => {
    const pending = deferred<MediaStream>();
    const acquired = microphoneStream("mic-1");
    const mediaDevices = {
      getUserMedia: vi.fn().mockReturnValue(pending.promise),
      enumerateDevices: vi.fn().mockResolvedValue(devices),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
    const view = render(
      <MicrophoneStep mediaDevices={mediaDevices} onConfirm={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));

    view.unmount();
    await act(async () => pending.resolve(acquired.stream));

    expect(acquired.track.stop).toHaveBeenCalledOnce();
    expect(mediaDevices.enumerateDevices).not.toHaveBeenCalled();
  });

  it("stops an acquired stream when device enumeration fails", async () => {
    const acquired = microphoneStream("mic-1");
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(acquired.stream),
      enumerateDevices: vi
        .fn()
        .mockRejectedValue(new Error("Device list unavailable")),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
    render(<MicrophoneStep mediaDevices={mediaDevices} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));

    expect(await screen.findByText("Device list unavailable")).toBeVisible();
    expect(acquired.track.stop).toHaveBeenCalledOnce();
  });

  it("accepts acquisition after the Strict Mode effect replay", async () => {
    const acquired = microphoneStream("mic-1");
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(acquired.stream),
      enumerateDevices: vi.fn().mockResolvedValue(devices),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
    render(
      <StrictMode>
        <MicrophoneStep
          mediaDevices={mediaDevices}
          monitorLevel={() => vi.fn()}
          onConfirm={vi.fn()}
        />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow microphone" }));

    expect(await screen.findByLabelText("Microphone")).toHaveValue("mic-1");
    expect(acquired.track.stop).not.toHaveBeenCalled();
  });
});
