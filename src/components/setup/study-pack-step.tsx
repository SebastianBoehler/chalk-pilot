"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  studyPackClient,
  type StudyPackClient,
} from "@/features/study-pack/client";
import type { StudyPack } from "@/features/study-pack/schema";

interface StudyPackStepProps {
  client?: StudyPackClient;
  selectedId?: string;
  onSelect: (pack: StudyPack | undefined) => void;
  onContinue: (selected: boolean) => void;
}

export function StudyPackStep({
  client = studyPackClient,
  selectedId,
  onSelect,
  onContinue,
}: StudyPackStepProps) {
  const [packs, setPacks] = useState<StudyPack[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const selected = packs.find((pack) => pack.id === selectedId);

  const load = async () => {
    setLoading(true);
    setLoadFailed(false);
    setError(undefined);
    try {
      setPacks(await client.list());
    } catch (cause) {
      setError(message(cause));
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    client
      .list()
      .then((next) => {
        if (!active) return;
        setPacks(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(message(cause));
        setLoadFailed(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  const createPack = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const pack = await client.create(title.trim());
      setPacks((current) => [pack, ...current]);
      setTitle("");
      onSelect(pack);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!selected || !files?.length) return;
    const unsupported = [...files].find((file) => !supported(file));
    if (unsupported) {
      setError(
        `${unsupported.name} is not supported. Use PDF, Markdown, or text.`,
      );
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      let pack = selected;
      for (const file of files) pack = await client.upload(pack.id, file);
      setPacks((current) =>
        current.map((item) => (item.id === pack.id ? pack : item)),
      );
      onSelect(pack);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        Choose your material
      </h1>
      <p className="text-muted mt-3 max-w-2xl text-base leading-7">
        Ground the tutor in your course notes. Files stay on this Mac, and you
        can reuse the study pack in later sessions.
      </p>

      {error && (
        <div
          className="border-danger/30 bg-danger/5 text-danger mt-6 rounded-2xl border p-4 text-sm"
          role="alert"
        >
          <p>{error}</p>
          {loadFailed && (
            <Button
              className="mt-3"
              onClick={() => void load()}
              variant="danger"
            >
              Try again
            </Button>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-[1fr_1.15fr]">
        <section className="border-border bg-surface rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">Study packs</h2>
          {loading ? (
            <p className="text-muted mt-4 text-sm">Loading your material…</p>
          ) : packs.length ? (
            <div className="mt-4 space-y-2">
              {packs.map((pack) => (
                <button
                  aria-pressed={pack.id === selectedId}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    pack.id === selectedId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-surface-muted"
                  }`}
                  key={pack.id}
                  onClick={() => onSelect(pack)}
                  type="button"
                >
                  <span className="block font-semibold">{pack.title}</span>
                  <span className="text-muted mt-1 block text-sm">
                    {sourceCount(pack)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted mt-4 text-sm">
              No study packs yet. Create one for these materials.
            </p>
          )}

          <div className="border-border mt-5 border-t pt-5">
            <label className="text-sm font-semibold" htmlFor="study-pack-title">
              New study pack
            </label>
            <input
              className="border-border bg-background mt-2 w-full rounded-xl border px-3 py-3"
              disabled={busy}
              id="study-pack-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Probabilistic ML"
              value={title}
            />
            <Button
              className="mt-3 w-full"
              disabled={busy || !title.trim()}
              onClick={() => void createPack()}
              variant="secondary"
            >
              Create study pack
            </Button>
          </div>
        </section>

        <section className="border-border bg-surface rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">
            {selected ? selected.title : "Add course files"}
          </h2>
          {selected ? (
            <>
              <label className="border-border hover:bg-surface-muted mt-4 block cursor-pointer rounded-2xl border border-dashed p-6 text-center">
                <span className="font-semibold">
                  {busy ? "Processing material…" : "Add files"}
                </span>
                <span className="text-muted mt-1 block text-sm">
                  PDF, Markdown, or plain text · up to 20 MiB each
                </span>
                <input
                  accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
                  className="sr-only"
                  disabled={busy}
                  multiple
                  onChange={(event) => void upload(event.target.files)}
                  type="file"
                />
              </label>
              <SourceList pack={selected} />
            </>
          ) : (
            <p className="text-muted mt-4 text-sm leading-6">
              Select a saved pack or create a new one, then add the material you
              want to understand.
            </p>
          )}
        </section>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
        <Button
          disabled={busy}
          onClick={() => {
            onSelect(undefined);
            onContinue(false);
          }}
          variant="quiet"
        >
          Continue without material
        </Button>
        <Button disabled={busy || !selected} onClick={() => onContinue(true)}>
          Continue with study pack
        </Button>
      </div>
    </section>
  );
}

function SourceList({ pack }: { pack: StudyPack }) {
  if (!pack.sources.length) {
    return (
      <p className="text-muted mt-4 text-sm">
        This pack is empty. Add files now or continue and add them next time.
      </p>
    );
  }
  return (
    <ul className="border-border mt-4 divide-y">
      {pack.sources.map((source) => (
        <li
          className="flex items-center justify-between gap-4 py-3"
          key={source.id}
        >
          <span className="min-w-0 truncate text-sm font-semibold">
            {source.fileName}
          </span>
          <span className="text-muted shrink-0 text-xs">
            {source.locators.length} sections
          </span>
        </li>
      ))}
    </ul>
  );
}

function sourceCount(pack: StudyPack) {
  return `${pack.sources.length} ${pack.sources.length === 1 ? "source" : "sources"}`;
}

function supported(file: File) {
  return /\.(pdf|md|markdown|txt)$/i.test(file.name);
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "Study material failed.";
}
