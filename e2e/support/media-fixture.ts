import type { Page } from "@playwright/test";

interface MediaFixtureOptions {
  height: number;
  poseBoxes?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  width: number;
}

export async function installMediaFixture(
  page: Page,
  options: MediaFixtureOptions,
) {
  await page.addInitScript(({ height, poseBoxes, width }) => {
    const size = { height, width };
    Object.defineProperty(window, "__chalkPilotVideoSize", {
      configurable: true,
      value: size,
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      videoHeight: {
        configurable: true,
        get: () => size.height,
      },
      videoWidth: {
        configurable: true,
        get: () => size.width,
      },
    });

    class DeterministicWorker {
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      postMessage(raw: unknown) {
        const request = raw as {
          frame?: ImageBitmap;
          id: string;
          image?: ImageData;
          type: string;
        };
        queueMicrotask(() => {
          if (request.frame) {
            request.frame.close();
            this.onmessage?.(
              new MessageEvent("message", {
                data: {
                  boxes: poseBoxes ?? [],
                  id: request.id,
                  ok: true,
                },
              }),
            );
            return;
          }
          this.onmessage?.(
            new MessageEvent("message", {
              data: {
                id: request.id,
                ok: true,
                result:
                  request.type === "detect"
                    ? { confidence: 0, corners: null }
                    : request.image,
              },
            }),
          );
        });
      }

      terminate() {}
    }

    class DeterministicMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      readonly mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: ((event: { error?: DOMException }) => void) | null = null;
      onstop: (() => void) | null = null;
      state: RecordingState = "inactive";

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        this.mimeType = options?.mimeType ?? "video/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        queueMicrotask(() => {
          this.ondataavailable?.({
            data: new Blob(["chalkpilot-e2e"], { type: this.mimeType }),
          });
          this.onstop?.();
        });
      }
    }

    const mediaState = new WeakMap<
      HTMLMediaElement,
      { currentTime: number; paused: boolean }
    >();
    const stateFor = (element: HTMLMediaElement) => {
      let state = mediaState.get(element);
      if (!state) {
        state = { currentTime: 0, paused: true };
        mediaState.set(element, state);
      }
      return state;
    };
    Object.defineProperties(HTMLMediaElement.prototype, {
      currentTime: {
        configurable: true,
        get() {
          return stateFor(this as HTMLMediaElement).currentTime;
        },
        set(value: number) {
          stateFor(this as HTMLMediaElement).currentTime = value;
        },
      },
      paused: {
        configurable: true,
        get() {
          return stateFor(this as HTMLMediaElement).paused;
        },
      },
    });
    HTMLMediaElement.prototype.play = function () {
      stateFor(this).paused = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      stateFor(this).paused = true;
      this.dispatchEvent(new Event("pause"));
    };

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: DeterministicWorker,
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: DeterministicMediaRecorder,
    });
  }, options);
}

export async function installDisplayCaptureFixture(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: () =>
        navigator.mediaDevices.getUserMedia({ audio: true, video: true }),
    });
  });
}

export async function stubRealtime(page: Page) {
  await page.route("**/api/realtime-token", async (route) => {
    await route.fulfill({
      json:
        route.request().method() === "GET"
          ? { configured: true }
          : { value: "ek_test_secret" },
    });
  });
  await page.route("https://api.openai.com/**", (route) => route.abort());
}
