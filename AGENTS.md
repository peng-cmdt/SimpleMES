# Repository Guidelines

## Project Structure & Module Organization
- `simple-mes/` hosts the Next.js client, admin portal, API routes, and Prisma layer; key subfolders include `src/app` for routes, `src/components` for shared UI, and `prisma/` for the data model.
- `DeviceCommunicationService/DeviceCommunicationService/` contains the .NET device bridge with controllers, drivers, and WebSocket pipeline; keep configs in `appsettings*.json`.
- `simple-mes/scripts/` provides seeding and migration utilities; run them from the repository root to keep relative paths intact.
- Assets such as uploaded images reside under `simple-mes/public` and `simple-mes/publicuploadsimages`; avoid committing large binaries unless required by tests.

## Build, Test, and Development Commands
- `cd simple-mes && npm install` to restore JavaScript dependencies; `npm run db:generate` keeps Prisma clients aligned with `schema.prisma`.
- `npm run dev -- --port 3009` launches the Next.js stack; pair it with `dotnet run --project DeviceCommunicationService/DeviceCommunicationService/DeviceCommunicationService.csproj` to exercise live device APIs.
- `npm run build` followed by `npm run start` verifies production bundles; enable `NODE_ENV=production npm run dev:ws` when you need the standalone WebSocket server.
- `node test-api-call.js` or other scripts in `simple-mes/` prefixed with `test-` execute focused integration checks against seeded data.

## Coding Style & Naming Conventions
- TypeScript follows ESLint (Next.js profile) with 2-space indentation; favor functional React components and hooks stored under `src/hooks`.
- Database records use camelCase fields in Prisma models but persist as snake_case through table mappings—mirror this when adding migrations.
- C# services adopt PascalCase for types and methods; logging should use Serilog and include device identifiers for traceability.
- Use file names like `feature-name.tsx` for pages and `useFeature.ts` for hooks; align REST handlers under `src/app/api/<domain>/route.ts`.

## Testing Guidelines
- Prefer script-based checks (`node test-workflow-complete-marking.js`) while automated suites are built out; keep fixtures lightweight and reset via `scripts/seed-mes-data.ts`.
- Structure new tests under `simple-mes/` with the `test-*.js` naming convention, returning `process.exit(0/1)` for CI friendliness.
- Document manual verification steps in the PR description when touching device communication or Prisma migrations.

## Commit & Pull Request Guidelines
- Write commits in imperative mood (e.g., `feat: add workstation monitor polling`) and keep scopes narrow; include schema or config references when they change.
- Pull requests should summarize the change, list impacted services (`Next.js`, `DeviceCommunicationService`), link related issues, and provide before/after screenshots for UI updates.
- Mention required environment steps (e.g., `npm run db:generate`, new `.env` keys) so reviewers can reproduce quickly.
