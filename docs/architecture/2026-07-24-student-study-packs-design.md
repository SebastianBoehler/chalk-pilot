# Student Study Packs Design

## Goal

Let a student create a reusable local study pack from PDF, Markdown, and plain
text files, select that pack before a ChalkPilot session, and receive tutoring
grounded in those materials. The tutor may supplement the pack with general
knowledge, but it must distinguish supplemental knowledge from course material.

The field-test implementation remains single-user and local. Stable pack,
source, and chunk identifiers preserve a clean migration path to future users,
tenants, and workspaces without introducing authentication or cloud storage now.

## Product flow

The first setup stage is **Choose your material**:

1. Select an existing study pack, create a new one, or continue without one.
2. A new pack has a student-authored title and accepts multiple PDF, Markdown,
   or text files.
3. Every successful upload immediately appears with its filename and extracted
   page or section count.
4. Unsupported, oversized, scanned, or unreadable material shows a bounded
   source-specific error and is not silently indexed.
5. The selected pack is attached to the new session. Existing camera,
   microphone, board-calibration, preview, and ready stages remain unchanged.

Study packs persist under `.chalkpilot/study-packs` and can be reused across
sessions. A study pack is optional so ChalkPilot still works as a general tutor.

## Ingestion

The server processes uploads locally and synchronously:

- PDF uses [UnPDF](https://github.com/unjs/unpdf) and preserves one-based page
  provenance.
- Markdown uses `mdast-util-from-markdown` and
  `mdast-util-to-string`; chunks preserve the active heading path and source
  line.
- Plain text is divided by paragraphs and preserves paragraph ranges.

All formats normalize into bounded `StudyChunk` records:

```ts
interface StudyChunk {
  id: string;
  packId: string;
  sourceId: string;
  sourceTitle: string;
  locator: string;
  ordinal: number;
  text: string;
}
```

Chunks target approximately 1,600 characters and split only when necessary.
The original upload is retained locally beside the normalized source record and
JSONL chunks. Filenames are metadata only; generated identifiers define every
filesystem path.

MVP limits are 20 sources per pack, 20 MiB per file, and 500 PDF pages. The MVP
does not run OCR. A PDF with no meaningful extractable text is rejected with a
clear scanned-PDF message.

## Retrieval

ChalkPilot does not inject entire documents into every voice turn. It exposes
three bounded tools:

- `get_study_pack_outline`: pack title, source titles, and available locators;
- `search_study_pack`: lexical search returning at most five passages with
  source, page or heading, and chunk identifiers;
- `read_study_passage`: one selected passage plus its immediate neighbors.

`MiniSearch` builds a small in-memory lexical index from the selected pack on
demand. This avoids embeddings, a vector database, another model call, and a
provider-specific index. The repository boundary allows a later semantic
retriever to replace lexical search without changing tool contracts.

## Tutor behavior

At session creation, the Realtime agent receives the selected pack title and
source list. Its course-first policy is:

- search before checking a course-specific definition, claim, exercise, or
  board solution;
- use retrieved material as the primary reference;
- identify the source page or heading when correcting or extending the learner;
- explicitly call information outside the pack “supplemental context”;
- never claim that a statement appears in the pack without retrieved evidence;
- pass relevant chunk IDs when delegating a grounded Canvas artifact.

Retrieval remains proactive but selective. The agent should not search for
ordinary conversational coordination or universally stable arithmetic.

## Canvas grounding

`delegate_canvas_task` accepts up to five source chunk IDs. The server resolves
those IDs against the session’s selected pack and gives the Canvas worker the
canonical passages and provenance.

Canvas sections gain optional validated citations. A worker may cite only
evidence supplied to that job. The Canvas renderer displays a compact source
footer such as `Lecture 4, p. 12`; uncited general explanations remain valid.
This keeps typed artifacts trusted and prevents model-authored URLs or arbitrary
HTML.

## Storage and API boundaries

Local structure:

```text
.chalkpilot/
  study-packs/
    <packId>/
      pack.json
      sources/
        <sourceId>/
          source.json
          original.<ext>
          chunks.jsonl
  sessions/
    <sessionId>/
      session.json
```

`session.json` stores an optional `studyPackId`. Existing sessions parse with
`studyPackId: null`.

Routes:

- `GET/POST /api/study-packs`
- `GET /api/study-packs/:packId`
- `POST /api/study-packs/:packId/sources`
- `GET /api/sessions/:sessionId/study-pack`
- `POST /api/sessions/:sessionId/study-pack/search`
- `GET /api/sessions/:sessionId/study-pack/passages/:chunkId`

Pack creation accepts JSON. Source upload accepts one multipart `file`. Session
creation accepts optional JSON `{ "studyPackId": "..." }`; an absent body
remains backward compatible.

## Failure behavior

- Invalid identifiers and unsupported extensions return `400`.
- Unknown packs, sessions, sources, and chunks return `404`.
- Source or pack limits return `413`.
- Parsing failure returns `422` with a safe, actionable message.
- A failed upload removes its temporary directory and does not mutate the pack.
- Retrieval failure is visible to the tutor and UI; it is not replaced with
  invented source context.
- A Canvas citation outside the resolved evidence set rejects that Canvas job.

## Verification

Unit tests cover PDF page provenance, Markdown heading provenance, text
paragraph chunking, limits, repository persistence, lexical ranking, and
citation validation.

API tests cover pack creation/listing, multipart upload, session attachment,
search, passage reading, and bounded errors.

Component tests cover selecting, creating, uploading, skipping, and retrying the
study-pack setup stage.

Realtime tests prove that study tools expose provenance, course-first
instructions are present, and delegated jobs carry only retrieved chunk IDs.

An end-to-end test creates a pack, uploads source text, selects it, completes
setup, and verifies that the source is available to the session retrieval API.

## Deliberate exclusions

- users, organizations, tenants, permissions, and shared workspaces;
- cloud uploads, synchronization, or professor administration;
- embeddings and vector databases;
- OCR and visual interpretation of scanned PDFs;
- Word, PowerPoint, web crawling, and arbitrary URLs;
- arbitrary generated JavaScript, React, or HTML.
