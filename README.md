# Inkhorn

A vocabulary trainer for the words you look up: save them as you read,
then learn them with spaced repetition.

Each saved word gets definitions, pronunciation, etymology, examples and a
usage note. Study runs on flashcards and quizzes: a word you know well
comes back less often than one you struggled with.

*Inkhorn term* was a sixteenth-century insult for showily Latinate
vocabulary. The name is a joke on itself.

## Status

This is a rebuild. The working prototype was a single-file React app that
ran inside a Claude artifact. It was called Lexicon, and it holds a
library of 1,070 words. It is being ported to a standalone web app, one
vertical slice at a time.

Built so far: the database schema and its migration runner; a loader that
moves the prototype's export into Postgres and checks it (1,070 words, 974
with fetched definitions, 95 with study history); the server; and a
browser page that lists the whole library from the database. Not yet
ported: search and the word-detail view, flashcards,
quizzes, and fetching definitions. Accounts come after that.

The prototype is kept, frozen, in [`reference/`](reference/) as the record
of what is being ported.

## The stack, and why

**Vite + React** in the browser, **Express** on **Node 24**, **Postgres**
on **Neon** through `pg`, **TypeScript** throughout. One repo, one
deployed process: Express serves the API and the built client together.

The rule behind each choice: **legibility over speed**. Fewer managed
abstractions, more wiring you can see.

- **Hand-written SQL, no ORM.** Every query and every schema change is
  readable as SQL. Migrations are numbered files, applied in order by a
  small runner, and recorded in a table.
- **No meta-framework.** Next.js was rejected on legibility, and because
  on serverless hosts its functions time out before a 60-second
  definition fetch can finish.
- **TypeScript with no build step on the server.** Node 24 runs `.ts`
  files directly by stripping the types. The TypeScript compiler is used
  only as a checker (`npm run typecheck`).
- **Neon for Postgres.** Development runs against a Neon `dev` branch, so
  there is no local database to keep in step. Supabase was rejected: its
  free projects pause after a week of inactivity.
- **Render for hosting, on the $7/month always-on plan.** Render's free
  plan puts the server to sleep after 15 minutes. Railway was rejected for
  per-second metered billing, and Fly for needing a Dockerfile before the
  first deploy.
- **Two vendors, joined only by a connection string**, so the database
  can move without code changes.
- **Nothing queries the database on a schedule.** Neon's compute sleeps
  after five minutes without a query. One keep-alive query every five
  minutes would hold it awake permanently and would, by the project's own
  estimate, use up the free plan's monthly compute in about seventeen
  days, with no error anywhere. So
  there is no health check that touches the database, no pinger and no
  polling.
- **Migrations run at boot, before the server listens.** If one fails,
  the process exits, the deploy fails, and the previous version stays
  live.
- **Lowercase-with-hyphens filenames and LF line endings,** enforced
  rather than remembered. Development is on Windows, which ignores the
  case of filenames, and deployment is on Linux, which does not.
- **A temporary password gate (HTTP Basic Auth)** until real accounts
  exist. It refuses to start in production without its credentials,
  rather than serving without them.

## Where the reasoning lives

- [`map.md`](map.md): the open questions and the build order.
- [`decisions.md`](decisions.md): every resolved decision, with the
  reasoning and the cost accepted, including the options rejected and the
  choices later superseded.
- [`CLAUDE.md`](CLAUDE.md): standing instructions for Claude Code, which
  writes much of the code. Design decisions are made in a separate
  planning session, and every change is reviewed before it is pushed.

## Running it locally

You need Node 24 (24.2 or later) and a Postgres connection string. The
code is written against Neon.

*Terminal commands:*

```
npm install
cp .env.example .env
```

Then fill in `DATABASE_URL` in `.env`. `.env.example` explains each
variable. Then, in two terminals:

*Terminal commands:*

```
npm run dev:server
npm run dev:client
```

`dev:server` applies any pending migrations, then serves the API on port
3000. `dev:client` runs Vite on port 5173 and forwards `/api` requests to
the server, so the browser sees a single origin, as it does in production.
Open http://localhost:5173.

The library itself is not in the repo. `server/scripts/import-json.ts`
loads it from an export of the prototype. Run it with no arguments to see
its options.

In production, the build command is
`npm ci --include=dev && npm run build`, and the start command is
`node server/src/index.ts`. Not `npm start`: started through npm, the
server never logged the shutdown signal Render sends on each redeploy,
so it could not close its database connections cleanly.

## Contact

Questions or ideas about the project: open a
[GitHub issue](https://github.com/jonathanmilder/inkhorn/issues).
