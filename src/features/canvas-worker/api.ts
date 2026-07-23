import { z } from "zod";
import { CanvasProviderConfigurationError } from "./provider";
import { canvasJobRequestSchema } from "./schema";
import {
  CanvasAgentExecutionError,
  type CanvasWorkerService,
} from "./service";

export function createCanvasWorkerApi(service: CanvasWorkerService) {
  async function run(sessionId: string, request: Request) {
    try {
      const input = canvasJobRequestSchema.parse(await request.json());
      return Response.json(await service.run(sessionId, input));
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return Response.json(
          { error: "The canvas job was invalid." },
          { status: 400 },
        );
      }
      if (
        error instanceof Error &&
        error.message.startsWith("Unknown session")
      ) {
        return Response.json({ error: "Session not found." }, { status: 404 });
      }
      if (error instanceof CanvasProviderConfigurationError) {
        return Response.json({ error: error.message }, { status: 503 });
      }
      if (error instanceof CanvasAgentExecutionError) {
        return Response.json({ error: error.message }, { status: 502 });
      }
      throw error;
    }
  }

  return { run };
}
