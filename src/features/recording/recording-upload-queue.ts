import type { UploadChunkInput } from "./recording-client";

export interface UploadJob {
  input: UploadChunkInput;
  acknowledgement: Promise<void>;
}

export class RecordingUploadQueue {
  private readonly jobs = new Set<UploadJob>();

  constructor(
    private readonly limit: number,
    private readonly upload: (input: UploadChunkInput) => Promise<void>,
    private readonly onFailure: (
      input: UploadChunkInput,
      error: unknown,
    ) => Promise<void>,
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("The pending upload limit must be a positive integer.");
    }
  }

  get pendingInputs(): UploadChunkInput[] {
    return [...this.jobs].map(({ input }) => input);
  }

  enqueue(input: UploadChunkInput): boolean {
    if (this.jobs.size >= this.limit) return false;
    const job: UploadJob = {
      input,
      acknowledgement: Promise.resolve(),
    };
    this.jobs.add(job);
    let upload: Promise<void>;
    try {
      upload = this.upload(job.input);
    } catch (error) {
      upload = Promise.reject(error);
    }
    job.acknowledgement = upload
      .then(() => {
        this.jobs.delete(job);
      })
      .catch((error) => {
        this.jobs.delete(job);
        return this.onFailure(job.input, error);
      });
    return true;
  }

  async drain() {
    await this.drainJobs(() => true);
  }

  async drainTrack(track: UploadChunkInput["track"]) {
    await this.drainJobs((job) => job.input.track === track);
  }

  private async drainJobs(predicate: (job: UploadJob) => boolean) {
    let jobs = [...this.jobs].filter(predicate);
    while (jobs.length > 0) {
      await Promise.all(jobs.map(({ acknowledgement }) => acknowledgement));
      jobs = [...this.jobs].filter(predicate);
    }
  }
}
