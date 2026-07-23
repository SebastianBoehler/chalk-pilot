import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();

vi.mock("next/navigation", () => ({ redirect }));

describe("Home", () => {
  beforeEach(() => redirect.mockClear());

  it("sends learners to room setup", async () => {
    const { default: Home } = await import("./page");

    render(<Home />);

    expect(redirect).toHaveBeenCalledWith("/setup");
  });
});
