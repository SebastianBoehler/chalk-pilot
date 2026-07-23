import type { CanvasState } from "@/features/workspace/schema";
import type { WorkspaceRepository } from "@/features/workspace/repository";
import { createCanvasWorkerActions, type CanvasWorkerActions } from "./actions";
import { runCanvasAgent } from "./agent";
import {
  CanvasProviderConfigurationError,
  createCanvasModel,
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
}

export class CanvasAgentExecutionError extends Error {}

export function createCanvasWorkerService(
  dependencies: CanvasWorkerDependencies,
) {
  const queue = dependencies.queue ?? createKeyedQueue();
  const runAgent = dependencies.runAgent ?? runProviderAgent;

  async function run(
    sessionId: string,
    request: CanvasJobRequest,
  ): Promise<CanvasJobResult> {
    return queue.run(sessionId, async () => {
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
      return canvasJobResultSchema.parse({
        jobId: request.jobId,
        summary,
        canvas: await dependencies.repository.readCanvas(sessionId),
      });
    });
  }

  return { run };
}

export type CanvasWorkerService = ReturnType<
  typeof createCanvasWorkerService
>;

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
