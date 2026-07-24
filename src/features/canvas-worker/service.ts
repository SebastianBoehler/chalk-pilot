import { randomUUID } from "node:crypto";
import type { CanvasState } from "@/features/workspace/schema";
import type { WorkspaceRepository } from "@/features/workspace/repository";
import { createCanvasWorkerActions, type CanvasWorkerActions } from "./actions";
import { runCanvasAgent } from "./agent";
import {
  CanvasProviderConfigurationError,
  createCanvasModel,
  resolveCanvasProviderIdentity,
} from "./provider";
import { createKeyedQueue, type KeyedQueue } from "./queue";
import {
  canvasJobResultSchema,
  type CanvasJobRequest,
  type CanvasJobResult,
} from "./schema";

interface CanvasAgentTask {
  request: CanvasJobRequest;
  canvas: CanvasState;
  actions: CanvasWorkerActions;
}

type CanvasAgentRunner = (task: CanvasAgentTask) => Promise<string>;

interface CanvasWorkerDependencies {
  repository: WorkspaceRepository;
  runAgent?: CanvasAgentRunner;
  queue?: KeyedQueue;
  providerIdentity?: { provider: string; model: string };
}

export class CanvasAgentExecutionError extends Error {}

export function createCanvasWorkerService(
  dependencies: CanvasWorkerDependencies,
) {
  const queue = dependencies.queue ?? createKeyedQueue();
  const runAgent = dependencies.runAgent ?? runProviderAgent;
  const providerIdentity =
    dependencies.providerIdentity ??
    (dependencies.runAgent
      ? { provider: "injected", model: "injected" }
      : resolveCanvasProviderIdentity());

  async function run(
    sessionId: string,
    request: CanvasJobRequest,
  ): Promise<CanvasJobResult> {
    const queuedAt = new Date();
    const queuedMs = Date.now();
    return queue.run(sessionId, async () => {
      const startedAt = new Date();
      const startedMs = Date.now();
      try {
        const canvas = await dependencies.repository.readCanvas(sessionId);
        const actions = createCanvasWorkerActions(
          dependencies.repository,
          sessionId,
        );
        const summary = await executeAgent(runAgent, {
          request,
          canvas,
          actions,
        });
        const completedAt = new Date();
        const completedMs = Date.now();
        const metrics = {
          ...providerIdentity,
          queuedAt: queuedAt.toISOString(),
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          queueMs: Math.max(0, startedMs - queuedMs),
          executionMs: Math.max(0, completedMs - startedMs),
          totalMs: Math.max(0, completedMs - queuedMs),
        };
        const result = canvasJobResultSchema.parse({
          jobId: request.jobId,
          summary,
          metrics,
          canvas: await dependencies.repository.readCanvas(sessionId),
        });
        await recordJobEvent(dependencies.repository, sessionId, {
          request,
          metrics,
          status: "complete",
        });
        return result;
      } catch (error) {
        const failedAt = new Date();
        const failedMs = Date.now();
        await recordJobEvent(dependencies.repository, sessionId, {
          request,
          metrics: {
            ...providerIdentity,
            queuedAt: queuedAt.toISOString(),
            startedAt: startedAt.toISOString(),
            completedAt: failedAt.toISOString(),
            queueMs: Math.max(0, startedMs - queuedMs),
            executionMs: Math.max(0, failedMs - startedMs),
            totalMs: Math.max(0, failedMs - queuedMs),
          },
          status: "failed",
        });
        throw error;
      }
    });
  }

  return { run };
}

async function recordJobEvent(
  repository: WorkspaceRepository,
  sessionId: string,
  input: {
    request: CanvasJobRequest;
    metrics: {
      provider: string;
      model: string;
      queuedAt: string;
      startedAt: string;
      completedAt: string;
      totalMs: number;
      queueMs: number;
      executionMs: number;
    };
    status: "complete" | "failed";
  },
) {
  try {
    await repository.appendEvent(sessionId, {
      id: randomUUID(),
      type: "canvas_job",
      createdAt: new Date().toISOString(),
      metadata: {
        jobId: input.request.jobId,
        artifact: input.request.artifact,
        status: input.status,
        provider: input.metrics.provider,
        model: input.metrics.model,
        queueMs: input.metrics.queueMs,
        executionMs: input.metrics.executionMs,
        totalMs: input.metrics.totalMs,
      },
    });
  } catch {
    // Telemetry must never block the learning artifact itself.
  }
}

export type CanvasWorkerService = ReturnType<typeof createCanvasWorkerService>;

async function runProviderAgent(task: CanvasAgentTask) {
  return runCanvasAgent({ ...task, model: createCanvasModel() });
}

async function executeAgent(
  runner: CanvasAgentRunner,
  task: CanvasAgentTask,
): Promise<string> {
  try {
    return await runner(task);
  } catch (error) {
    if (
      error instanceof CanvasProviderConfigurationError ||
      error instanceof CanvasAgentExecutionError
    ) {
      throw error;
    }
    throw new CanvasAgentExecutionError(
      error instanceof Error && error.message
        ? error.message
        : "The canvas agent failed.",
    );
  }
}
