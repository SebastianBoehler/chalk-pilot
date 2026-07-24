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

  it("encodes the attempt-first teaching loop as a flexible voice policy", () => {
    expect(chalkPilotInstructions).toContain("current attempt");
    expect(chalkPilotInstructions).toContain("board evidence");
    expect(chalkPilotInstructions).toContain("one concise spoken cue");
    expect(chalkPilotInstructions).toContain("one focal artifact");
    expect(chalkPilotInstructions).toContain("checkpoint or transfer");
    expect(chalkPilotInstructions).toContain("flexible policy");
    expect(chalkPilotInstructions).toContain("not a rigid state machine");
  });
});
