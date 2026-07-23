# Security Policy

## Supported version

Security fixes currently target the latest commit on the default branch.

## Reporting a vulnerability

Please use GitHub's private security-advisory flow for this repository. Do
not open a public issue for credential exposure, path traversal, camera or
microphone privacy failures, cross-window injection, or unauthorized data
persistence.

Include:

- the affected commit;
- a minimal reproduction;
- realistic impact;
- whether a credential, board image, transcript, or learner record was exposed;
- any suggested mitigation.

Do not include real API keys, private transcripts, or identifiable room images.

## Operational guidance

- Keep `OPENAI_API_KEY` only in `.env.local` or the deployment environment.
- Never expose the standard API key to browser code.
- Run ChalkPilot on localhost or HTTPS.
- Use a dedicated OpenAI project with appropriate usage limits for public
  demonstrations.
- Treat `.chalkpilot/` as private learner data and exclude it from backups or
  sync services unless explicitly intended.
