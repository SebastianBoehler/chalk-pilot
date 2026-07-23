import { describe, expect, it } from "vitest";
import { chalkPilotInstructions } from "./instructions";

describe("ChalkPilot instructions", () => {
  it("keeps voice brief and protects the learner's attempt", () => {
    expect(chalkPilotInstructions).toContain("one or two sentences");
    expect(chalkPilotInstructions).toContain("attempt");
    expect(chalkPilotInstructions).toContain("canvas");
    expect(chalkPilotInstructions).toContain("inspect");
    expect(chalkPilotInstructions).toContain("unreadable");
  });
});
