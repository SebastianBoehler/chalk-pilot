import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { SiteNavigation } from "./site-navigation";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

describe("SiteNavigation", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/session");
  });

  it("links the setup and replay surfaces and identifies a live session", () => {
    render(<SiteNavigation />);

    expect(screen.getByRole("link", { name: "ChalkPilot" })).toHaveAttribute(
      "href",
      "/setup",
    );
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute(
      "href",
      "/setup",
    );
    expect(screen.getByRole("link", { name: "Replay" })).toHaveAttribute(
      "href",
      "/replay",
    );
    expect(screen.getByText("Live session")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("stays out of the clean room display", () => {
    vi.mocked(usePathname).mockReturnValue("/display");
    const view = render(<SiteNavigation />);

    expect(view.container).toBeEmptyDOMElement();
  });
});
