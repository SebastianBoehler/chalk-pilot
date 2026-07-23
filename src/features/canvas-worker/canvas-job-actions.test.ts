// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { CanvasWorkerActions } from "./actions";
import { createCanvasJobActions } from "./canvas-job-actions";

const section = {
  id: "token-types",
  kind: "markdown" as const,
  title: "Token types",
  content: "Subwords balance vocabulary size and flexibility.",
};

function createActions(overrides: Partial<CanvasWorkerActions> = {}) {
  return {
    readCanvas: async () => ({
      version: 1,
      focusId: null,
      order: [],
      sections: {},
    }),
    upsertSection: async () => ({ sectionId: section.id }),
    focusSection: async ({ sectionId }: { sectionId: string }) => ({
      sectionId,
    }),
    ...overrides,
  } as CanvasWorkerActions;
}

describe("canvas job actions", () => {
  it("requires one upsert followed by focus of that exact returned section", async () => {
    let upserts = 0;
    const actions = createCanvasJobActions(
      createActions({
        upsertSection: async () => {
          upserts += 1;
          return { sectionId: "persisted-token-types" };
        },
      }),
    );

    await expect(
      actions.focusSection({ sectionId: section.id }),
    ).rejects.toThrow("Upsert a section before focusing.");
    await actions.upsertSection(section);
    await expect(
      actions.focusSection({ sectionId: section.id }),
    ).rejects.toThrow("Focus the upserted section.");
    await expect(actions.upsertSection(section)).rejects.toThrow(
      "A canvas job can upsert one section.",
    );
    await actions.focusSection({ sectionId: "persisted-token-types" });

    expect(upserts).toBe(1);
    expect(() => actions.assertComplete()).not.toThrow();
  });

  it("does not consume the upsert slot when persistence fails", async () => {
    let attempts = 0;
    const actions = createCanvasJobActions(
      createActions({
        upsertSection: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("disk unavailable");
          return { sectionId: section.id };
        },
      }),
    );

    await expect(actions.upsertSection(section)).rejects.toThrow(
      "disk unavailable",
    );
    await actions.upsertSection(section);
    await actions.focusSection({ sectionId: section.id });

    expect(attempts).toBe(2);
    expect(() => actions.assertComplete()).not.toThrow();
  });

  it("rejects completion until the persisted section is focused", async () => {
    const actions = createCanvasJobActions(createActions());

    expect(() => actions.assertComplete()).toThrow(
      "Canvas job must upsert and focus one section.",
    );
    await actions.upsertSection(section);
    expect(() => actions.assertComplete()).toThrow(
      "Canvas job must upsert and focus one section.",
    );
  });
});
