import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudyPackClient } from "@/features/study-pack/client";
import type { StudyPack } from "@/features/study-pack/schema";
import { StudyPackStep } from "./study-pack-step";

describe("StudyPackStep", () => {
  afterEach(cleanup);

  it("supports an explicit session without material", async () => {
    const onContinue = vi.fn();
    const onSelect = vi.fn();
    render(
      <StudyPackStep
        client={client([])}
        onContinue={onContinue}
        onSelect={onSelect}
      />,
    );

    expect(await screen.findByText(/no study packs yet/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /continue without material/i }),
    );
    expect(onSelect).toHaveBeenCalledWith(undefined);
    expect(onContinue).toHaveBeenCalledWith(false);
  });

  it("selects a reusable pack before continuing", async () => {
    const saved = pack("saved-pack", "NLP");
    const onContinue = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <StudyPackStep
        client={client([saved])}
        onContinue={onContinue}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /NLP/i }));
    expect(onSelect).toHaveBeenCalledWith(saved);

    rerender(
      <StudyPackStep
        client={client([saved])}
        onContinue={onContinue}
        onSelect={onSelect}
        selectedId={saved.id}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue with study pack/i }),
    );
    expect(onContinue).toHaveBeenCalledWith(true);
  });

  it("creates a pack and uploads supported files", async () => {
    const created = pack("new-pack", "Probabilistic ML");
    const withSource = {
      ...created,
      sources: [
        {
          id: "notes-source",
          packId: created.id,
          title: "notes",
          fileName: "notes.md",
          format: "markdown" as const,
          mimeType: "text/markdown",
          sizeBytes: 22,
          chunkCount: 1,
          locators: ["Introduction"],
          createdAt: NOW,
        },
      ],
    };
    const mock = client([]);
    vi.mocked(mock.create).mockResolvedValue(created);
    vi.mocked(mock.upload).mockResolvedValue(withSource);
    const onSelect = vi.fn();
    render(<ControlledStep client={mock} onSelect={onSelect} />);
    await screen.findByText(/no study packs yet/i);
    fireEvent.change(screen.getByLabelText(/new study pack/i), {
      target: { value: created.title },
    });
    fireEvent.click(screen.getByRole("button", { name: /create study pack/i }));
    await waitFor(() =>
      expect(mock.create).toHaveBeenCalledWith(created.title),
    );

    fireEvent.change(screen.getByLabelText(/add files/i), {
      target: {
        files: [
          new File(["# Introduction"], "notes.md", {
            type: "text/markdown",
          }),
        ],
      },
    });
    await waitFor(() => expect(mock.upload).toHaveBeenCalledOnce());
    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    expect(onSelect).toHaveBeenLastCalledWith(withSource);
  });

  it("shows unsupported files and lets a failed library load retry", async () => {
    const saved = pack("saved-pack", "NLP");
    const mock = client([]);
    vi.mocked(mock.list)
      .mockRejectedValueOnce(new Error("Material library is unavailable."))
      .mockResolvedValueOnce([saved]);
    render(<ControlledStep client={mock} />);
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    fireEvent.click(await screen.findByRole("button", { name: /NLP/i }));
    fireEvent.change(screen.getByLabelText(/add files/i), {
      target: { files: [new File(["x"], "slides.pptx")] },
    });
    expect(
      await screen.findByText(/slides\.pptx is not supported/i),
    ).toBeInTheDocument();
    expect(mock.upload).not.toHaveBeenCalled();
  });
});

const NOW = "2026-07-24T08:00:00.000Z";

function pack(id: string, title: string): StudyPack {
  return {
    id,
    title,
    sources: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function client(packs: StudyPack[]): StudyPackClient {
  return {
    list: vi.fn().mockResolvedValue(packs),
    create: vi.fn(),
    read: vi.fn(),
    upload: vi.fn(),
  };
}

function ControlledStep({
  client,
  onSelect = vi.fn(),
}: {
  client: StudyPackClient;
  onSelect?: (pack: StudyPack | undefined) => void;
}) {
  const [selected, setSelected] = useState<StudyPack>();
  return (
    <StudyPackStep
      client={client}
      onContinue={vi.fn()}
      onSelect={(pack) => {
        setSelected(pack);
        onSelect(pack);
      }}
      selectedId={selected?.id}
    />
  );
}
