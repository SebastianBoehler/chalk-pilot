# Contributing to ChalkPilot

Thank you for helping make room-based learning calmer and more effective.

## Development setup

Use Node.js 24 and install the locked dependency graph:

```bash
nvm use
npm ci
npx playwright install chromium
cp .env.example .env.local
```

An OpenAI key is not needed for unit tests or the default browser tests. It is
needed only for a live learning session or the opt-in live Realtime smoke test.

## Before opening a pull request

```bash
npm run check
npm run test:e2e
npm audit --audit-level=high
```

Keep changes narrow and modular. Source files should generally remain below 300
lines. Add the smallest test that demonstrates a behavior change.

## Product constraints

- Keep the physical board and learning task in the foreground.
- Keep normal voice responses brief and durable detail on the display.
- Do not upload camera images continuously.
- Do not persist raw audio, room video, or submitted board images.
- Do not add silent providers, mock product content, or automatic device
  switching.
- Surface permission, connection, persistence, and tool errors visibly.

Live-provider tests must be opt-in and must not print or commit credentials.

## Commit style

Use conventional, scoped messages such as:

```text
feat(board): improve low-contrast corner detection
fix(agent): preserve image ordering at a turn boundary
docs: clarify room camera setup
```

By contributing, you agree that your contributions are licensed under
Apache-2.0.
