export type RecordingCoordinatorStatus =
  "idle" | "starting" | "recording" | "stopping" | "complete" | "error";

export class RecordingCoordinatorState {
  status: RecordingCoordinatorStatus = "idle";
  error: Error | null = null;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  change(status: RecordingCoordinatorStatus, error: Error | null) {
    this.status = status;
    this.error = error;
    this.listeners.forEach((listener) => listener());
  }
}
