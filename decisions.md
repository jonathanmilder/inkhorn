# Decisions — Lexicon (to be renamed Inkhorn)

The settled record behind `map.md`: every resolved decision with its reasoning and the
cost accepted, plus the environment and data notes the build relies on. Split out of
`map.md` on 2026-10-26 so the working map stays short. **Resolved means resolved — a change
of mind is a new dated entry, not an edit to the old one.** Cross-references to "above" or
"below" were written when both halves were one file; search by Q-number or step instead.

## Decisions so far

- Scope of this effort — auto-capture end to end; deployment is leg one, not the destination.
- Does auto-capture strictly require deployment? — No (an MCP path exists in-artifact),
  but yes in practice: single-user, fragile, zero portfolio value.
- Multi-user? — Yes, real accounts with other people's words.
- Who funds definition fetches? — Not Jonathan. Accounts yes, subsidised strangers no.
- Accounts in leg one? — No. Single-user deploy first, prove parity, then auth.
- Legibility vs speed — legibility. Fewer managed abstractions, more visible wiring.
- Portfolio piece or product? — Portfolio piece, built so it doesn't foreclose a product.
- 2. Stack — Vite + React (client), Express on Node (server; also serves the built client),
  Postgres via `pg` with hand-written SQL and numbered migration files, TypeScript
  throughout. One repo, one deployed process.
- 2a. Meta-framework? — No. Next.js rejected on legibility and on its serverless timeout
  ceiling against 60-second definition fetches. Cheap to reverse.
- 3. Where the Anthropic key lives — in the always-on Express server, read from an
  environment variable.
- 4. Where does data live? — Neon managed Postgres, free plan. **Storage read from the
  console 2026-08-09: 31.69 MB on `main`, with `dev` reporting none of its own** — branches
  share storage copy-on-write. ~6% of the 0.5 GB cap before a single word is loaded.
- 4a. Supabase? — Out. Free projects pause after a week of inactivity; removing that is
  $25/mo, and the auth and RLS that would justify the price pull toward a client library
  and dashboard-edited schemas the settled stack avoids.
- 6. Hosting — Render, Starter web service, $7/month, always on. Rejected: Railway
  (per-second metered billing); Fly (Dockerfile + fly.toml before the first deploy).
  Render's own free tier rejected — the server sleeps after 15 min, and free Postgres is
  deleted 30 days after creation.
- 6a. One vendor or two? — Two. A generic connection string keeps the database swappable.
- 6b. Region — Render and Neon both in US East. **Made specific at step 8: Ohio**, because
  Neon `dev` is AWS `us-east-2` (Ohio); Render cannot change a service's region later.
- 6c. How they connect — Render holds `DATABASE_URL`; Express passes it to `pg`, which
  opens a small pool over TLS. No SDK, no vendor client, no platform API.
- 17. Local development database — none. A Neon `dev` branch with its own connection
  string; production on `main`.
- 5a. Migration direction — v3.1 stays authoritative for all writes during the build; the
  standalone is read-only until cutover. The migration is a repeatable wipe-and-reload.
- 5b. Unfetched words become rows. The unfetched list is the work queue.
- 24a. Word identity — the lowercased word string. **Refined by 24h: identity is the
  lowercase *comparison*; storage is verbatim.**

### Q7 — repo and README (RESOLVED 2026-08-06)

- **Public.** Legibility is the whole pitch, and a private repo is portfolio evidence
  nobody can see. **Decided at the safest possible moment.** Cost accepted: permanent and
  public from commit one, including every clumsy commit and wrong turn.
- **`reference/lexicon-v3.jsx` is included**, with both briefs. The before-and-after is
  the story.
- **Repo name `lexicon`; URL `github.com/jonathanmilder/lexicon`.** **Renamed 2026-10-28 (Q30):
  `github.com/jonathanmilder/inkhorn`.** GitHub redirects the old URL.
- **README is a placeholder** — written properly at step 8.
- **README register, settled:** a straight, accurate description, not a pitch. **The one
  thing pure documentation would omit and this must include: why decisions were made.**
- **Corollary, 2026-08-11: git history records what was BUILT, not what was APPROVED.**
  Pushing does not ratify. If a review decides a choice was wrong, the fix is a commit on
  top — never an edit to an existing one. This is what makes "push early, push often" safe
  here: unpushed work exists in exactly one place, and the only irreversible act is
  publication, which the pre-push check covers.

### Q16 — Node, package manager, repo layout (RESOLVED 2026-08-06)

- **Node 24 LTS** (v24.14.1 verified locally). **Pinned for Render at step 8 by
  `engines` `>=24.2.0 <25` (`c4ff173`); Render resolved 24.22.2.**
- **npm**, with `package-lock.json` committed. **Cost accepted:** npm's flat `node_modules`
  permits phantom dependencies — importing a package that was never declared, which works
  locally and can break on deploy. pnpm forecloses that. Judged a narrow hole against an
  unfamiliar tool.
  **THE PREMISE CHANGED AT STEP 7a — see open question 32.** The cost was accepted partly
  on the installed closure being small — roughly a dozen packages, ~17 when measured.
  `express` took it to roughly 80.
- **Layout — six directories at the root:**
  `client/` (step 7b) · `server/` (steps 4–7a) · `scripts/` (the 26a script) ·
  `data/` (the corrections file) · `reference/` (v3.1 source and both briefs) ·
  plus `.gitignore`, `.gitattributes`, `README.md`.
- **`scripts/` is deliberately not `server/scripts/`.** The 26a script is plain Node, no
  dependencies, run by hand twice; the loader is TypeScript and belongs to the server's
  toolchain.
- **`data/` exists** because the corrections file is neither code nor server config.
- **`client/` still does not exist in the repo** — git tracks files, not folders. Step 7b
  creates it.
- **`init.defaultBranch=main` set globally.**

### Q19 — Windows-to-Linux portability (RESOLVED 2026-08-06)

- **Line endings — `.gitattributes` containing `* text=auto eol=lf`**, committed before
  the first `git add`. **`.gitattributes` overrides `core.autocrlf`**, so the project's
  rule wins wherever they disagree. It travels; a machine-level setting does not.
  **Cost accepted:** any Windows tool that cannot read LF will show files as one long line.
- **Filename case — lowercase-with-hyphens for every file and directory created**, plus
  `core.ignorecase false` set globally. Windows treats `Header.tsx` and `header.tsx` as
  one file; Linux treats them as two.
  *Why a convention over consistent capitalization:* **a rule that cannot be broken beats a
  rule that must be remembered.** **Cost accepted:** cuts against React's convention of
  capitalized component files — **which arrives concretely at step 7b.**

### v3.1 freeze — code AND data (RESOLVED)

- **Code frozen.** No new features, no data-shape changes. Bug fixes only if they block
  daily study. Ideas go to Lexicon → Backlog. Never let a new chat regenerate Lexicon's
  code — that creates a separate artifact with empty storage.
- **Data frozen too, effective 2026-08-04.** No studying, no fetching, no curation in the
  artifact. Rationale: the baseline counts are *external* facts read off the artifact by
  hand, so freezing keeps verification proving "database matches the artifact."
- **Consequences:** the 96 unfetched words get fetched in the standalone. Curation moves
  post-cutover. Anything done in v3.1 from now on is discarded, not merged.
- **Corollary: there is no longer any reason to open LEXICON LIVE.**

### Q15a — leg-one parity bar (RESOLVED)

Above the line — must work in the standalone first: browse and search the library;
flashcards with SM-2 scheduling and the four rating tiers; **session length (10/20/30/All)**;
**all three quiz modes**; fetch definitions; **add a single word**; export.
Below the line — built after cutover: paste-to-import with dedup, Import Only mode,
checkbox selection and shift-click range select, bulk re-fetch, bulk and single-word
delete, the sources-editing UI, library filters if search covers them.
- *Add a word* is above the line despite the import machinery being below it: without it
  the app is a closed museum from the moment of cutover.
- *Session length* is Study-mode-only in v3.1; the standalone should offer it in quizzes too.
- **Parity needs two instruments, not one.** Q5f's verification is a script and can only
  check data. Whether fill-in-the-blank still targets SM-2 repetitions 2–4, or the 80/20
  weighting holds, is hand-checked. So leg one also produces a **cutover acceptance
  checklist** — **placed at step 11, deliberately before the UI slices.**
- Full Q15 stays open, deferred until after leg one.

### Q24 — target schema (RESOLVED, all parts)

- 24b. Definitions and examples — **array columns on `words`** (`text[]`), not child tables.
- 24c. Primary key — **surrogate `id bigint generated always as identity`**, uniqueness on
  `(user_id, lower(word))` per 24h.
- 24d. Progress — **its own table**, `word_id` as both primary and foreign key,
  `ON DELETE CASCADE`. **Confirmed by the data: 20 of the 95 records sit at repetition 0.**
- 24e. Rating timestamp — **`last_rated timestamptz`**, derived once at migration.
  **The rule (step 9, ratified 2026-10-27):** `next_review − getInterval(ease, repetition)`
  days, in UTC. See Step 9, decision 1.
- 24f. All timestamps are **`timestamptz`**, never plain `timestamp`.
- 24g. Preferred sources — `user_settings` table, one row per user. Will host the BYOK
  Anthropic key in leg two (needs encryption at rest — noted, not solved).
- 24h. **Case preservation — words store verbatim; uniqueness is enforced case-
  insensitively** via `CREATE UNIQUE INDEX words_user_word_lower ON words (user_id,
  lower(word));`
- 24i. `users` **exists in leg one**, minimal: `id`, `email`, `created_at`. One row; server
  stamps `DEFAULT_USER_ID`. No auth, no login, no password.
- 24j. **No indexes beyond the uniqueness rule.** At 1,070 rows a sequential scan is
  imperceptible.
- 24k. **`user_settings.sources` — two `text[]` columns, `dictionaries` and
  `usage_guides`** (RESOLVED 2026-08-05), on direct evidence from `buildSystemPrompt`.
  **The split is semantic, not presentational.** **Knock-on: `usageGuides` → `usage_guides`
  is the loader's one camelCase translation.**

**Assembled schema (`server/migrations/001_initial_schema.sql`) — COMPLETE:**

```sql
CREATE TABLE users (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_settings (
  user_id      bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dictionaries text[] NOT NULL DEFAULT '{}',
  usage_guides text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE words (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word           text NOT NULL,
  part_of_speech text,
  pronunciation  text,
  definitions    text[],
  etymology      text,
  usage_note     text,
  examples       text[],
  mnemonics      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX words_user_word_lower ON words (user_id, lower(word));
CREATE TABLE progress (
  word_id     bigint PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  ease        real        NOT NULL,
  repetition  integer     NOT NULL,
  next_review timestamptz NOT NULL,
  last_rated  timestamptz
);
```

Nullability is deliberate: only `word` and `user_id` are `NOT NULL`. **Q27 adds no columns.**
**`schema_migrations` is NOT in this file** — per Q28 the runner creates it itself.

### Q27 — the five stray keys (RESOLVED 2026-08-05)

**None of the five earns a column.**

- **`example` (singular, 76 words) — FALLBACK, not merge.** *Use `examples`; if absent or
  empty, use the singular `example`.* The 72 words with both keep only `examples`.
  *Why fallback beat merging:* merging needs a duplicate check, and sentence equality is
  exact string matching — a trailing period, a curly apostrophe, and a near-duplicate slips
  into a tool whose whole purpose is orthographic precision. **The four-word trap is an
  ordinary consequence:** `aver`, `audacious`, `avoirdupois`, `aureole` have `example` and
  no `examples`. **Both outcomes must be reported in the loader summary.**
  **Cost accepted:** 72 sentences lost, recoverable before cutover by changing the rule.
- **`etymology_note` (3) — appended to `etymology`**, separated by a blank line.
  On `preoccupied`, `satrap`, `tergiversation`.
- **`pronunciation_note` (1) — appended to `pronunciation`**, same way. On `importunate`.
- **`definitons` (1, `colloquial`) — DISCARDED, reported by word and key name.**
  **It holds an ARRAY, not a string.**
- **`confusables` (3) — DISCARDED, reported by word.** On `azimuth`, `auspice`, `badinage`.
  *The deeper finding:* the fetch prompt already assigns `usage_note` the job of
  *"distinctions from near-synonyms."* The successor idea is in the fog.

**Two knock-ons that must not be "simplified" later:**
1. **Verification must mirror every loader transformation.**
2. **26a keeps scanning the singular `example` even though it is discarded.**

### Q5 — migration method and verification (RESOLVED)

- 5c. Form — **a hand-run TypeScript script, `server/scripts/import-json.ts`**. Explicit
  `--target` and explicit file path, **neither with a default**; prints both before acting;
  requires typed confirmation for `main`.
- 5d. Sequence — (1) read and validate, print counts, fail before touching the database;
  (2) print target, confirm; (3) `TRUNCATE ... RESTART IDENTITY CASCADE`; (4) insert user,
  then settings; (5) insert words verbatim, applying 26a's corrections and the Q27 rules;
  (6) insert progress; (7) orphan check; (8) summary, then verify. **The whole run is
  wrapped in a transaction.** **Steps 1–7 DONE (steps 5, 6 and 9 of the build).** Step 8,
  "summary, then verify," is completed by step 10 — **as a separate command,
  `server/scripts/verify.ts`, run after the loader** (see Step 10).
- 5e. Failure handling — **fail on anything suggesting the data is not what we understand
  it to be; warn on anything understood but unexpected.** `--strict` promotes warnings to
  failures; off during the build, on for cutover.
  **AMENDMENT (RESOLVED 2026-08-08) — the five stray keys are RECOGNISED keys, and get
  named report lines. They are NOT warnings.**
  - *Reading A, rejected:* all five are permanent warnings — which would make `--strict`
    fail **every run, by construction, on data we fully understand.**
  - *Reading B, taken:* recognised keys get named report lines; **the warning is reserved
    for a key nobody has seen before.**
  - **The governing principle: an alarm that always sounds is not an alarm.**
  - **Cost accepted:** nothing forces a stop at cutover to look at the 72 discarded
    sentences and the 4 promotions. **The instrument for a human stop is step 11's
    acceptance checklist, not `--strict`.**
  - **Proven in practice 2026-08-08 and again 2026-08-11:** the clean file passes
    `--strict` with 0 failures and 0 warnings.
- 5f. Verification — a `verify` command ~~in the same script~~ **in its own file,
  `server/scripts/verify.ts` (amended at step 10, 2026-10-31; see Step 10)**:
  1. Word count = **1,070** exactly.
  2. Fetched/unfetched split = **974 / 96**.
  3. Progress records = **95**, every `word_id` resolving.
  4. **Content spot-check of three words**, chosen adversarially: longest usage note, one
     with em dashes or quotation marks, one with three definitions. `imperious` qualifies.
     **One of the three must be drawn from the `example`-only four.**
  5. Timestamp sanity: earliest and latest `next_review` within a year either side of today.
     **CALIBRATION NOTE (2026-08-08): the window is tighter than it sounds.** Actual span is
     **2026-03-01 to 2027-08-07**. The *earliest* value would fall outside a one-year-back
     window from **March 2027**. **The window must be calibrated deliberately at step 10.**
  6. **`user_settings` matches the file:** order compared, not just membership.
  7. **Study Due = 971**, counted from the file and from Postgres independently.
  **AS BUILT AT STEP 10 (2026-10-31):** check 5's window is fixed, [2026-01-01,
  2028-01-01) UTC; check 7 counts 971 as of 2026-08-04 plus file = Postgres at now; check 4
  also compares every row. **Seven PASSes on `dev`.** See Step 10.
  **Design constraint: verification reads the database independently and re-reads the
  file — it shares no state with the loader.** **Verification must *re-implement* the
  transformations, not import the loader's copy.**
  **Honest limit:** this verifies the JSON arrived in Postgres intact. It does not verify
  that the JSON faithfully represents the artifact — the chip counts did that, once, by
  hand, and the data freeze is what keeps that proof valid.
- 5g. Script extras — **a field-coverage report** and **`--dry-run`** (landed at step 6).
  - **The safety this depends on — and it must not be quietly removed.** The deferral was
    safe *only because* 5c gives `--target` **no default and no fallback**.
    **If anyone later adds a convenient default target, they are removing the guard.**

### Step 5 — what the loader validates, and the run of record (RESOLVED 2026-08-08)

**Four checks were added beyond the brief, and all four are KEPT** — progress-record shape;
a fourth top-level key; a stray key inside a progress record; and the sixth-key rule applied
one level up and one level down.
- **Condition attached to keeping them, and MET:** they must be silent on good data.
- **The honest cost, recorded:** more validation code than the Map specified, and every
  check is a small thing that can be wrong. **The counter is not "these are good checks"
  but that unrequested code must land in the Map as a decision.**

**The run of record — Jonathan's own terminal, 2026-08-08.** PASS, 0 failures, 0 warnings,
under `--strict`. Every count matched. **The wrong-file guard works**, reporting
1,071 / 663 / 408 / 52 against the earlier backup and exiting 1 — precisely the Map's
superseded numbers, so the guard discriminates on real differences.
**All four warning paths were proven to fire** against a deliberately corrupted copy, which
**lived in a session scratchpad only.**
**Commits `051cb94`, `19b2b34`, `a60c642`, pushed.**

### Step 6 — the loader's write half, and the run of record (RESOLVED 2026-08-09)

**Status: BUILT, RUN, AND INDEPENDENTLY VERIFIED. Commits `9966b81` and `725636e` —
PUSHED. (The Map previously said "not yet pushed at the time of writing"; corrected
2026-08-11 from `git log`, `origin/main` having been at `725636e`.)**

**THE EVIDENCE OF RECORD — Neon's SQL Editor on `dev`, not the loader's own report:**

| words | users | user_settings | progress | schema_migrations |
|---|---|---|---|---|
| 1,070 | 1 | 1 | 0 | 1 |

- **`progress` = 0** — the loader did its own job and did not drift into step 9's.
- **`schema_migrations` = 1** — the `TRUNCATE` named four tables and left the fifth alone.

**Transformation evidence — three words, three different Q27 rules, checked by name:**
`aver` → 1 example (the promoted singular); `colloquial` → 3 examples (the `definitons`
typo neither crashed nor merged); `importunate` → 3 examples (its `pronunciation_note`
went to a different column). `user_settings` — 4 and 6, **order preserved exactly**.

**THE CANONICAL LOADER COMMAND (recorded 2026-08-11, because the only one written down was
step 5's and it fails from step 6 onward):**

```
node --env-file=.env server/scripts/import-json.ts "C:\Users\<user>\Dropbox\AI\Projects\Lexicon\backups\lexicon-backup-2026-08-03-b.json" --target dev --dry-run --strict
```

*Terminal command.* Drop `--dry-run` to commit. `--target main` additionally demands the
typed phrase `load main`.

**Ratified from the step-6 handoff report:**
- **`--target main` requires confirmation EVEN UNDER `--dry-run`.** `TRUNCATE` holds an
  `ACCESS EXCLUSIVE` lock for the life of the transaction whether or not it commits, so a
  "harmless" dry run would block every reader of `main` on cutover day.
- **Four more unrequested guards, on the step-5 precedent** (condition met): a non-string
  element in a `text[]`; an accepted correction that changes more than case; an accepted
  correction matching no headword; a word→id map that comes back short.
- **`formatDatabaseError` was duplicated in the loader and `migrate.ts`. Left duplicated
  then; EXTRACTED at step 7a, its third caller — as planned.**
- **No npm script for the loader.** An alias would put `--target` one level further from the
  command line, which is the whole point of it.

**REJECTED: a `--validate-only` flag.** `--dry-run --target dev` does everything the old
file-only mode did **and** exercises every constraint.
**Strongest argument against, recorded:** 26a's hand review will mean repeated runs while
iterating on `capitalizations.json`. *If that loop proves annoying, add it then.*

**RE-RUN 2026-08-11, after the `formatDatabaseError` extraction.** PASS — 0 failures,
0 warnings, under `--strict --dry-run --target dev`. Every count, coverage figure,
structural check and stray-key count identical to the run of record; byte count 2,037,770;
`words: 1,070 rows inserted` followed by `ROLLED BACK`.
*Why this run happened at all:* step 7a changed a module the loader imports, without the
loader being the subject of the step. **The loader is the program that can destroy data;
it gets re-run whenever anything it depends on changes.**
**Honest limit, recorded:** a clean pass does not prove `formatDatabaseError` itself is
correct, because error-formatting code only executes when something fails. What it proves
is that the import resolves and nothing else broke. **The error path was proven at step 5
against the corrupted copy; it was not re-proven here.**

**THE TWO QUEUED REPORT FIXES — both closed 2026-08-11:**
1. **Mask the endpoint — DONE.** The line shows the first word after `ep-`, an ellipsis, and the last few characters (the real fragment is deliberately not recorded here).
   **Verified to discriminate:** `DATABASE_URL_DEV` and `DATABASE_URL_MAIN` carry
   *different* first tokens after `ep-`, compared locally from `.env` without printing
   either. So `dev` and `main` produce visibly different lines, which is the whole job.
   - **The demonstration was synthetic and its shape differed from reality.** All five of
     the report's example strings ended `...us-east-2`, a shape the real line does not have.
     The function works; the demo did not model the real hostname. *Recorded because "it was
     shown working" and "it was shown working on real input" are different claims.*
   - **The branch name is NOT in the masked line and CANNOT be.** Neon does not put the
     branch in the connection string — the host is `ep-<adjective>-<noun>-<id>.<region>.
     aws.neon.tech` and both branches use the same database name, `neondb`. The loader
     prints its branch on the line above, from `--target`. **The server and the runner
     genuinely do not know which branch they are on** — under Q18 they read `DATABASE_URL`
     and never choose. **Printing a guess would be worse than printing nothing.**
2. **Print the `sslmode` actually stripped — NO CHANGE NEEDED; the fix was already
   satisfied when it was queued.** `describeTls` reads the stripped value back out of the
   strip function and always has. On 2026-08-09 it printed `verify-full` because
   `verify-full` was genuinely in the string. **The line was right for the right reason.**
   Demonstrated against five synthetic strings covering `verify-full`, `require`, no
   `sslmode` at all, several TLS parameters at once, and `localhost`.
   **This is what produced the queued-fix rule (now in `map.md`).**

**`.env` VERIFIED TO HOLD `verify-full`, in Jonathan's own terminal, 2026-08-11.** Both
`npm run dev` and the loader printed `sslmode=verify-full dropped from the string, decided
in code instead`. Q18's amendment 1 — false for a full day, corrected 2026-08-09 — is now
true *and* observed, in the exact place the original claim went wrong.

### Q26 — canonical capitalization (RESOLVED)

- **Finding (2026-08-04): the capitals were never lost.** v3.1 lowercased the headword at
  import but left every other field untouched. **All 1,070 headwords are lowercase, so 26a
  supplies every capital that will ever exist in the library.**
- 26a. Method — **a corrections file in the repo** (`data/`). A one-off script proposes a
  mapping by scanning each word's `usage_note` and `examples`; Jonathan reviews and edits by
  hand; the loader applies it as an explicit step.
  **Five traps the proposal script must handle:**
  1. Sentence-initial capitals are false positives; only mid-sentence occurrences count.
  2. Mixed evidence (*Byzantine* vs *byzantine*) routes to manual review.
  3. Multi-word entries capitalize partially (*Stockholm syndrome*).
  4. **All-caps emphasis is a false positive** — the rough run proposed `career → CAREER`.
     A proper-noun use in a *different* sense (`Herald`, `Squire`) routes to review.
  5. **Quotation-initial capitals are false positives** — worth 8 of the 10 removals.
  **45 candidates (2026-08-06), superseding the earlier "~56".** With filters disabled the
  script reproduces 55, which is the evidence the gap is the traps working.
  **`example` (singular) must be scanned alongside `examples`** — it holds 57 headword
  occurrences, exactly one capitalized, and changed no verdict in this run. **It stays
  required, because the four `example`-only words have no other prose, and an inert rule is
  not an unnecessary one.**
- **Output: two files.** `data/capitalizations.json` — the decisions file, hand-edited, read
  by the loader. `data/capitalization-review.md` — the evidence dossier, for reading only.
  **The loader applies only entries marked `accepted`.** Re-runs preserve existing decisions.
- **The hand review is a soft dependency, not a hard one.** **It must be finished before
  step 17.** **Status 2026-08-11: 45 entries, all 45 unreviewed, skipped by the loader.**
- **26a's capitals are what make 24h's case-insensitive progress match matter.**
- **Remaining gap: the 96 unfetched words have no prose to mine.** Post-cutover.

### Q18 — environment variables (RESOLVED 2026-08-08)

**The shape: three database variables, not one.**
- **The server reads `DATABASE_URL` and nothing else. It never chooses a database.**
- **The loader reads `DATABASE_URL_DEV` and `DATABASE_URL_MAIN`, selected by
  `--target dev|main`, with no default.**
  *Why the loader is different:* it is the one program that runs `TRUNCATE ... RESTART
  IDENTITY CASCADE`. "Whatever is in the environment" is the wrong rule for a program that
  can destroy data. `--target main` is visible in shell history forever.
  **The governing criterion was loud-versus-silent failure, not elegance.**
- **Cost accepted:** locally `DATABASE_URL` and `DATABASE_URL_DEV` hold the identical
  string. Rotate a Neon password and update only one, and the other program breaks. **This
  is the loud failure that was bought deliberately.**
  **IT PAID OUT 2026-08-11**, in a different form than anticipated: a command run without
  `--env-file` found `DATABASE_URL_DEV` unset and stopped with instructions, rather than
  connecting anywhere.
- **Strongest argument against, recorded:** one variable everywhere is twelve-factor
  orthodoxy, and cutover happens once, already behind a typed confirmation. Rejected
  because "be careful on the one day it matters" is the shape of every migration story that
  ends badly.
- **Rejected alternatives:** (a) two variables asymmetric; (b) having `npm run dev` copy
  `DATABASE_URL_DEV` into `DATABASE_URL` at launch — a `cross-env` dependency and a
  portability trap bought to avoid retyping one string.

**No `dotenv` dependency.** Node has read `.env` files natively since v20.6 via
`--env-file`. **`npm run dev:server` passes `--env-file=.env`; `npm start` does not pass it
at all**, and neither does `node server/src/index.ts`, which is what Render actually runs
since step 8 (decision 12) — Render injects real environment variables. **Confirmed on
screen 2026-08-11**, when the script was still named `npm run dev`; it split into
`dev:server` and `dev:client` at step 7b. Known limits: no multi-line values, no `${VAR}`
expansion.

**Full variable inventory — `.env.example`, committed; `.env` never committed.**

```
# ---- Postgres (Neon) ----
# The server reads DATABASE_URL and nothing else. It never chooses a database.
DATABASE_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DBNAME?sslmode=verify-full
# ---- Loader targets (local only — never set these on Render) ----
DATABASE_URL_DEV=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DBNAME?sslmode=verify-full
DATABASE_URL_MAIN=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DBNAME?sslmode=verify-full
# ---- Single-user placeholder (24i) ----
DEFAULT_USER_ID=1
# ---- Anthropic (step 16) ----
ANTHROPIC_API_KEY=
# ---- Temporary access gate (20d) ----
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
# ---- Server ----
PORT=3000
```

- **`DEFAULT_USER_ID` stays an env var even though it will always be `1`.** Every place leg
  two must change is findable by searching one string.
- **At Neon signup, copy the DIRECT connection string, not the pooled one.** **Confirmed
  2026-08-08 — no `-pooler` in any of the three strings.**

**AMENDMENT (2026-08-08) — `sslmode=verify-full`, not `require`.**
- ~~All three strings use `verify-full`.~~ **THIS WAS FALSE WHEN WRITTEN AND STAYED FALSE
  FOR A DAY. Corrected 2026-08-09.** `.env` edited by hand and `.env.example` committed
  2026-08-09. **Independently observed true 2026-08-11 — see Step 6.**
  *Why:* `require` demands encryption but never checks *who* answered. `verify-full`
  additionally requires a certificate from a trusted authority whose name matches the host.
  **A wrong claim with evidence stapled to it is harder to catch than a wrong claim alone.**
- **THE STRING IS A REQUEST, NOT A GUARANTEE.** `sslmode` is a **libpq** convention. This
  project uses `pg`, which **re-implements** that parsing, and the implementation has
  changed across versions.
- **Knock-on: the pool passes explicit TLS options in code.** **DONE at step 6 via
  `db-config.ts`; inherited by step 7a's pool.**
- **Cost accepted:** a second independent way for a deploy to fail at the database layer.
- **Strongest argument against, recorded:** the realistic threat is thin. *That argument is
  why the enforcement exists rather than a reason to skip the setting.*

**AMENDMENT 2 (2026-08-09) — the enforcement moves to a SHARED MODULE and lands at STEP 6.**
- **The trigger was a corrected fact.** `server/src/migrate.ts` already connects. **Stated
  from inference, not from reading the file** — and confirmed at step 6.
- **`server/src/db-config.ts` builds the connection configuration including explicit TLS.**
  `migrate.ts` refactored onto it; the loader written onto it; **step 7a's pool inherits it,
  as designed.**
- **The setting is `ssl: { rejectUnauthorized: true }`.** **No CA bundle is pinned.**
- **PROVE IT ONCE, then never again.** Done — see amendment 3's negative test.
- *Why step 6 rather than step 7a:* **the loader is the program that runs `TRUNCATE` against
  `main` on cutover day, from a home network.**

**AMENDMENT 3 (2026-08-09) — the TLS parameters are STRIPPED from the connection string,
and amendment 2's premise was wrong.**
- **Amendment 2 assumed an explicit `ssl` object would win over the string's `sslmode`.
  IT DOES NOT.** `pg` builds config as `Object.assign({}, config, parse(config.
  connectionString))` — the parsed string is **last** — and `pg-connection-string` sets
  `config.ssl = {}` the instant it sees any `sslmode`. **An explicit `ssl` object beside an
  intact connection string is replaced by an empty object.**
- **Verified independently, twice**, on `pg` 8.23.0 and then on **`pg` 8.22.0 /
  `pg-connection-string` 2.14.0 — Jonathan's exact installed versions.**
- **THE DESIGN: `db-config.ts` removes the TLS parameters and passes `ssl` explicitly.**
- **The fear was pointed the wrong way.** `pg` currently treats `require`, `prefer` and
  `verify-ca` as **aliases for `verify-full`** — *stronger* than libpq. **The danger was a
  silent downgrade on a future `npm install`**, in `pg-connection-string` v3 / `pg` v9.
- **Both halves of `verify-full` are covered, and only one was tested.** `pg` sets
  `options.servername = host` and calls `tls.connect`, so Node checks the hostname by
  default. **The wrong-CA test demonstrated the certificate-authority half ONLY.** The
  hostname half rests on a source-level argument. **Do not let a README inflate this.**
- **The negative test, as run:** self-signed throwaway CA, scratchpad only. Control
  connected; wrong CA through `db-config.ts` failed with
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`; **wrong CA passed beside an untouched string
  CONNECTED — the finding**; no `ssl` object at all connected.
- **The string still matters, for other clients** — `psql` and GUI clients read it directly.
  **`.env.example`'s comment must say that our own programs strip it** — otherwise a reader
  cannot tell which one governs.
  **STILL OUTSTANDING as of 2026-08-11.** It is one comment line. Claude Code declined to
  make a third uninstructed edit at step 7a, correctly. **Now explicitly assigned to
  step 7b.**

### Q28 — the migration runner (RESOLVED 2026-08-08)

**Purpose:** a deploy must never land new code on a database that lacks something the code
queries. Three decisions.

**1. A tracking table, not filename ordering alone.**

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
```

This lives in the runner's code, **not** in `001`. **This is the one place `IF NOT EXISTS`
is correct** — bootstrapping, not schema change.
*Why not re-run every file each deploy:* `ALTER TABLE ... ADD COLUMN` fails on the second
run; data-moving migrations are not idempotent at all; and the idiom trains you to write
migrations that **succeed by doing nothing**.
**Absolute rule: an applied migration file is never edited and never renamed.** If `001` was
wrong, `002` fixes it.

**2. One transaction per file; the tracking `INSERT` inside that same transaction; stop on
first failure.** Record-then-apply leaves a migration marked done that never ran;
apply-then-record leaves it applied but unrecorded. Inside one transaction, "applied" and
"recorded" are one event.
**No down migrations.** **Cost accepted: the only recovery paths are restore-from-backup and
fix-forward. This makes Q22 more pressing.**
*Gotcha banked:* `CREATE INDEX CONCURRENTLY` refuses to run inside a transaction. Nothing in
leg one needs it.

**3. Runs on server boot, before Express accepts its first request — Option A.**
Also exposed standalone as `npm run migrate`.
**BUILT AND OBSERVED 2026-08-11.** `npm run dev` prints the target line, the TLS line,
`1 file on disk, 1 already applied`, `nothing to apply` — and only then
`server: listening on http://localhost:3000`. **The ordering is the evidence: migrations
complete before the port opens.**
*Why boot:* **one mechanism, identical on the laptop and on Render.** Failure exits
non-zero, Render's health check never passes, the deploy is marked failed, and **the
previous working version stays live.**
**Costs accepted:** (a) one process doing two unrelated jobs; (b) an unreachable database
becomes a boot failure rather than a degraded page; (c) **concurrency — two instances
booting at once could race.** The fix is a Postgres **advisory lock**, ~5 lines.
**Deferred**, because there is one Starter instance.
**File locations:** `server/migrations/001_initial_schema.sql`; runner at
**`server/src/migrate.ts`, not `server/scripts/`.**
**Numbering convention: three digits, zero-padded, lowercase with underscores.**

### Q31 — where `package.json` lives (RESOLVED 2026-08-08)

- **A single `package.json` at the repo root. No npm workspaces.** `client/` is built by
  Vite at step 7b into a folder the server serves; Vite lives in the same manifest as a
  devDependency.
- **Cost accepted:** the manifest mixes client and server dependencies. **This bites at
  step 7b**, when Vite and React land beside Express in one list.
- **Rejected — one manifest per half:** Render's automatic detection stops applying and the
  build command becomes a hand-written string in a dashboard field, living outside the repo
  and failing only at deploy time. **That is the exact failure category Q19 defends against.**
- **Rejected — npm workspaces:** adds a managed abstraction. Same grounds as pnpm.
- **Reversible:** splitting at step 7b costs an hour or two.

### Q21 — connection pool against Neon's compute quota (RESOLVED 2026-08-09, CLOSED 2026-08-11)

**THE MAP'S STATED MECHANISM WAS WRONG, and the correction is most of the answer.**
The frontier entry read: *"an open connection is activity, and a pool that never lets go is
a compute that never sleeps."* **Scale to zero is triggered by the absence of QUERIES, not
the absence of connections.** Read from Neon's docs 2026-08-09.
*This is what "verify, do not assume" was written down to catch, and it caught it.*

**The asymmetry, which is the genuinely counterintuitive part:** *opening* a connection
wakes a sleeping compute; *holding* an open connection does not keep it awake. Both are true
at once, and most intuitions want them to be the same rule.

**Two documented exceptions do hold a compute awake:** an **idle-in-transaction** connection
and an active logical-replication WAL sender. Neither exists in this project.

**Quota facts, re-verified 2026-08-09:**
- Free plan: **100 CU-hours per project per month.** A 0.25 CU compute runs ~400 hours
  against a ~730-hour month, so a compute that never sleeps dies around day seventeen.
- **Scale to zero on Free is always on, fixed at five minutes, and cannot be disabled.**
- **Exhaustion suspends the project's compute until the next billing period.**
- `dev` and `main` draw from **one per-project bucket**.
- A 0.25 CU compute allows **104 connections (97 after Neon's seven reserved slots)**.

**21a. THE STANDING RULE — nothing in this project queries the database on a schedule.**
- **Render's health check stays on its default TCP probe.** **If an HTTP health path is ever
  added it must not query Postgres.**
- No uptime pinger, no keep-warm cron, no scheduled job of any kind.
- **No polling `setInterval` fetch in the React client (steps 13–16).** **This becomes live
  at step 7b, the first step with a client at all.**
- **The Q28 boot-time migration runner is fine** — one wake per deploy.
- **Cost accepted:** a default TCP health check reports the service healthy while the
  database is unreachable.

**21b. Compute pinned to a FIXED 0.25 CU on both `dev` and `main`.**
*Why:* it makes the meter linear — CU-hours = awake-hours × 0.25, hard ceiling 400 awake
hours a month.
**Cost accepted:** a future heavy operation gets *slow* rather than *expensive*.
**The larger cost, named honestly:** this is console state with no representation in the
repo. The Map is the only place it can live, so it is recorded twice.
**STATUS: APPLIED 2026-08-09, verified on screen.**
**CORRECTION — Free offers NO fixed-size option.** The pin is the autoscale slider with both
ends at 0.25. **Jonathan's screen corrected the claim; that is the standing rule working.**
**OPEN, one click: the PROJECT DEFAULT compute size** (Settings → Compute → Modify
defaults). It matters only because a *restored* branch would inherit the default.
[interacts with: 22]

**21c. Pool configuration — BUILT AT STEP 7a, and the shape is RATIFIED (2026-08-11).**

The Map's illustrative snippet showed `export const pool = new Pool({...})`. **Claude Code
wrote `createPool(connectionString)` instead — a function, taking the string as an argument.
RATIFIED.**

*Why:* `index.ts` must read `DATABASE_URL` anyway for the boot hook. A module-level pool
would read it a second time, independently — **two places to keep in step and two different
messages when it is missing.** **This is Q18's own reasoning applied one level down:** the
whole design exists to stop programs from quietly deciding which database they connect to.
A pool that is *handed* its string cannot go looking.

**Every settled value survived exactly:** `max: 5`, `idleTimeoutMillis: 60_000`,
`connectionTimeoutMillis: 10_000`, `min` untouched at 0, `pool.on('error')` logging without
exiting, TLS inherited from `db-config.ts`.

**Cost accepted:** route code in other files will need the pool passed to it, or this
converted back to a singleton. Minutes either way.
**CORRECTION to the step-7a report: it named step 9 as where this bites. It is step 13.**
Step 9 is the loader's progress half, which opens its own connection through `db-config.ts`
and never touches the pool. **The pool's second consumer arrives with the library slice.**

```ts
// FILE CONTENTS — server/src/db.ts, as built. Values settled; shape ratified.
export function createPool(connectionString: string) { /* Pool with the values below */ }
//   max: 5                          one user, one instance; 104 are available
//   idleTimeoutMillis: 60_000       safely under Neon's 5-minute suspend window
//   connectionTimeoutMillis: 10_000 pg's default is 0 = wait forever
//   min: 0                          untouched
//   pool.on('error', …)             log, do not exit
//   TLS from db-config.ts (Q18 amendment 3), not re-specified here
```

- **`max: 5`** — bounded, comprehensible, leaves room for a hand-run loader connecting at
  the same time.
- **`idleTimeoutMillis: 60_000`** — chosen to sit **safely under Neon's five-minute suspend
  window**, so the pool always closes a connection before Neon can sever it. **This turned
  out to be load-bearing for a second reason — see 21d.**
- **`connectionTimeoutMillis: 10_000`** — the one real improvement over `pg`'s defaults.
- **`min` stays at 0.** A minimum above zero is the one pool setting that would deliberately
  hold connections open.
- **`pool.on('error', ...)` IS NOT OPTIONAL.** An unhandled `error` event on a Node
  EventEmitter takes the process down. Log it, do not exit.

**21d. CLOSED 2026-08-11 — MOOT BY CONSTRUCTION, ON AN OBSERVATION.**

**The question was:** does Neon count a silent-but-open connection as activity? An always-on
Render server holding a pool open was thought to depend on the answer.

**It does not depend on it, because the two clocks cannot overlap.** The pool destroys an
idle client at **60 seconds**. Neon's suspend clock does not fire until **five minutes**
without a query. By the time Neon is deciding, this project has had nothing connected for
four minutes. **A held-open connection never exists at the moment Neon is looking.**

**THE OBSERVATION THAT CLOSES IT.** The argument above is reasoning, and the load-bearing
sub-claim — *that `pg`'s pool actually drains to zero* — was asserted, not known. **If `pg`
kept one connection alive indefinitely the argument collapses.** So it was checked.

Server started, `/api/words` loaded once, browser tab closed, **two minutes** elapsed
(past the 60-second timeout, well short of five). Then, from Neon's SQL Editor on `dev`:

```sql
SELECT state, application_name, backend_type, count(*)
FROM pg_stat_activity
WHERE datname = 'neondb'
GROUP BY 1, 2, 3;
```

**Result: exactly one row — `active`, `neon-internal-sql-editor`, `client backend`, 1.**
The SQL Editor asking the question. **Nothing of Jonathan's was connected.** The pool let go.

**The confound, checked rather than waved away:** an empty register is also what you would
see if the server had never connected at all. Ruled out by the same session's evidence —
`npm run dev` printed its migration and listening lines, and `GET /api/words` returned 1,070
records. The server connected, queried, and then released.

**~~The seven-minute idle check~~ IS NOT RUN AND IS NOT OWED.** It was specified as: start
the server, load the endpoint once, wait seven minutes, read `dev`'s state. **It could never
have produced the evidence it was written for** — at minute seven the connection is long
gone, so the reading would describe a compute with nothing attached, which is exactly what
was already observed on `main` on 2026-08-09.

**THE TRIPWIRE — this is what replaces the check, and it is the durable half.**

> **Raising `idleTimeoutMillis` above five minutes, or setting `min` above 0, reopens 21d.**

Both are one-word edits that look harmless. Either would create a connection that outlives
Neon's suspend window, at which point whether Neon counts held connections becomes a live
question again — and the failure is silent, with no error anywhere until the month ends.
**A measurement describes 2026-08-11; a tripwire holds whatever Neon does later.**

- **21d's step-8 check still stands** as the confirmation against the real deployment: ten
  minutes idle, branch reads Idle, then read the CU-hours figure a week later.
- **Baseline for comparison, read 2026-08-09: 0.27 CU-hours total** (`main` 0.14, `dev`
  0.13) since 2026-08-08 — about one awake-hour across both branches for a full day of real
  work, against 100.
- **Operational note: browsing the Neon console WAKES a compute.** Do not leave a branch
  page open in a background tab.

**Deliberately NOT recorded in this Map: compute endpoint IDs and branch IDs.** They are not
credentials, but they are part of the connection hostname, and the Map is published in this
public repo (decided 2026-10-26).

**Cold-start cost, accepted:** the first request after a lull pays a few hundred
milliseconds. Named so it is recognised as normal rather than investigated as a bug.

**Realistic budget:** three study bursts a day of twenty minutes, each with a five-minute
idle tail, is roughly 75 minutes awake per day — **about 9.4 CU-hours a month, under 10% of
quota.** Jonathan's own use was never the risk; a timer he forgot he wrote is.

### Step 7a — the wire, server side (RESOLVED 2026-08-11)

**Status: BUILT, RUN, AND VERIFIED IN JONATHAN'S OWN TERMINAL. Commits `65df801`,
`f0103a5`, `813ceac`, `403a12e` — pushed, `725636e..403a12e`.**

**THE RUN OF RECORD.**

`npm run dev` printed, in this order: the masked target line, the TLS line,
`1 file on disk, 1 already applied`, `nothing to apply. The database is up to date.`, then
`server: listening on http://localhost:3000`.

**The endpoint was counted, not eyeballed.** *Terminal commands:*

```
$w = Invoke-RestMethod http://localhost:3000/api/words
$w.Count
($w | Where-Object { $_.definitions }).Count
```

**Returned 1070 and 974.** The frozen baseline, arriving over HTTP from Postgres for the
first time in the project's life. **A 1,070-element JSON array in a browser is not something
anyone can eyeball; it is not verified until something counts it.**

**FOUR UNREQUESTED CHOICES, REVIEWED — three ratified, one deferred.**
On the step-5 and step-6 precedent: unrequested code lands in the Map as a decision, or it
is silent drift.

**1. `createPool()` over a module-level pool — RATIFIED.** See 21c.

**2. `import.meta.main` in `migrate.ts` — RATIFIED.** The command-line half now sits inside
`if (import.meta.main) { … }`. It asks *"was I the file Node was told to run?"* — true for
`npm run migrate`, false when `index.ts` imports the module for the boot hook.
*Proven, not assumed:* importing `migrate.ts` with `DATABASE_URL` deleted returns cleanly
and exposes `runMigrations`. Before the guard, that import printed an error and exited 1.
*Rejected alternatives:* splitting into a CLI wrapper (moves the runner off
`server/src/migrate.ts`, the path **Q28 records by name** — a file move to avoid a one-line
guard); or comparing `import.meta.url` against `process.argv[1]` by hand (same test, less
clearly, with a Windows path-separator trap inside it).
**KNOCK-ON, and it is a real inaccuracy: `import.meta.main` landed in Node v24.2, and
`package.json` declares `engines: { "node": ">=24.0.0" }`.** A Node 24.0 or 24.1 install
would fail on this. **Render pins from that field so it will not bite there, but the
declaration is now false.** Fix: `>=24.2.0`. **~~Queued for step 7b~~ — DONE at step 7b;
`engines` reads `>=24.2.0`.**

**3. `GET /api/words` column selection — RATIFIED, all four parts.**
- **Named columns, not `*`** — adding a column later cannot silently change what the API
  returns.
- **`user_id` omitted** — the 24i single-user placeholder, meaningless outside the server.
- **`id` included** — wanted as a React key at 7b. **Constrained: see The data. A React key
  never leaves the browser's memory; an id must not become a URL segment or an export
  field.**
- **No `WHERE user_id = …` filter** — Q8 puts *"make every query filter by the logged-in
  user"* in leg two as **one job done once**. Half of it now is building ahead, and one
  endpoint is trivially findable.

**4. A SIGTERM shutdown handler — SHIPPED UNTESTED, DELIBERATELY. VERIFIED ON RENDER AT STEP 8
(2026-10-29), once production started with `node` directly; see Step 8.** Claude Code wrote it
unrequested and said plainly it was not claiming it works.
*What it is:* Render sends `SIGTERM` before replacing an instance. The handler closes the
pool and exits cleanly rather than dying mid-query.
**Kept rather than deleted**, because the alternative is deleting working-looking code to
rewrite it at step 8 under deploy pressure.
**But the step-5 precedent's condition — *silent on good data, demonstrated* — could not be
met here, and that is recorded rather than glossed.**
- **THREE OBLIGATIONS AT STEP 8:** watch the first deploy's log for the shutdown lines
  before the new instance starts; if they are absent the handler never fired; if they appear
  and the process then hangs until Render hard-kills it, the handler hangs.
- **Failure mode if wrong:** slower deploys and a confusing log line. Bounded and visible.
- **CHAT'S ERROR, RECORDED: a cross-process SIGTERM test was proposed, argued for, and
  cannot work on Windows.** Windows has no Unix signals. When one process calls
  `process.kill(pid, 'SIGTERM')` on **another**, Node terminates the target outright rather
  than delivering a catchable signal. **The observed result — prompt returned, no shutdown
  lines — was therefore uninformative, not a failure of the handler.** The mistake was
  arguing from a mechanism ("the emulation would catch a hanging handler") that does not
  exist.
- *The rejected alternative:* temporarily editing `index.ts` to fire the event at itself,
  then `git checkout` to revert. It reaches the handler, but tests handler logic only, on an
  OS with no signals — **strictly worse than step 8's test, which is free and runs on the
  real platform.**
- **SMALL OPEN ITEM: the handler catches SIGTERM but not SIGINT**, so Ctrl+C dies silently.
  Observed 2026-08-11 and consistent with the report. **Not a bug** — Render sends SIGTERM;
  SIGINT is only the keyboard. Whether it *should* also catch SIGINT is a design question.

**`formatDatabaseError` EXTRACTED — its third caller arrived, as Q28's step-6 note
predicted.** *Two copies is a coincidence; three is a module.*
**One behaviour change worth knowing: the two copies had drifted.** The runner printed
`position` and `where`; the loader did not. **The shared module prints the superset, so the
loader now reports two fields it used to drop.** This is why the loader was re-run — see
Step 6.

**Left alone, correctly:** `CLAUDE.md` is untracked at the repo root. Claude Code declined
to commit a file that is not its own. *Closed: `CLAUDE.md` was committed in `a1518e3` (2026-08-20)
and has been tracked and public since.*

### Step 7b — the wire, client side (RESOLVED 2026-08-22)

**Status: BUILT AND DEMONSTRATED. Commit `1684f46`.**

**REPORTED BY THE BUILD SESSION:** 1,070 `<li>` counted in the DOM via
`document.querySelectorAll('#root ul li').length`, not eyeballed; the list runs
*a fortiori* → *zenith*, matching `ORDER BY lower(word)`. The error branch was demonstrated
by stopping Express and reading the page. `npm run typecheck` clean on both configs;
`npm run build` 191 KB → 60 KB gzip.

**RE-CHECKED IN CHAT 2026-08-22 AGAINST THE REPO, not against the session summary.**
Confirmed on disk: all three carried items; `id` used once, as a React key, in the render;
`git status` matching its claim exactly. **The built bundle was grepped and holds no
`postgres`, `neon.tech`, `DATABASE_URL`, or `sslmode`** — the only hit for `password` is
inside React's own table of HTML input types. **The browser render itself is not
independently verified; it rests on the session's screenshots and Jonathan's own screen.**

**DECISIONS TAKEN AT 7b THAT WERE NOT SPECIFIED IN ADVANCE.**

**1. `npm run dev` no longer exists — a working-practice change, not a rename.** It is
`dev:server` and `dev:client`, two processes in two terminals, with no script pretending to
start both. **Q31's single manifest forced it:** one `package.json`, two halves, and
something had to give. `index.ts`'s three references moved with it. **A working session now
needs three windows — see "Three-window sessions" under Environment.**

**2. A `build` script exists (`vite build`), and the client builds to `dist/client`.**
`build` is Render's conventional hook, correct now rather than a step-8 unknown.
`build.outDir` is `../dist/client` rather than Vite's default `client/dist`: one repo, one
build output, already gitignored. **Nothing serves it yet; step 8 is where Express learns
to.**

**3. `vite.config.ts` sits at the repo root, not in `client/`, with `root: 'client'`.**
Q31's reasoning one level down — the config belongs beside the manifest it shares. **This
extends Q31 rather than applying it, which is why it is recorded as a decision.**

**Not decisions; recorded only so they are not rediscovered as questions:**
`strictPort: true` (fail rather than silently move to 5174); a second `tsconfig.json` at
`client/tsconfig.json` holding the browser half (DOM + JSX, and `types: []` so
`@types/node`'s globals cannot let server-only code typecheck against a browser); three
render states — loading, failed, loaded — and a count line, because "some words appeared"
is not the claim being made.

**`id` ARRIVES AS A STRING, NOT A NUMBER — discovered, not assumed.** The column is a
Postgres `bigint`, whose range is wider than a JavaScript number holds exactly, so `pg`
returns it as text rather than silently rounding past `Number.MAX_SAFE_INTEGER`. Verified
over the wire. **Harmless for React keys, which are strings anyway. It will matter the
first time something does arithmetic on one** — likely step 13.

**THE PROXY TARGET IS HARDCODED, AND THE FIRST REASON GIVEN FOR IT WAS WRONG.**
`vite.config.ts` hardcodes `http://localhost:3000`, coupled to `PORT` in `.env`. The
comment first said Vite "cannot read that variable" because `--env-file` is a Node flag.
**That is a non-sequitur, caught in review:** a Vite config file *is* a Node module, and
Vite exports `loadEnv` — confirmed present in the installed copy and read in its source.
`loadEnv(mode, process.cwd(), 'PORT')` would work.
**The decision stands on a better reason, now written into the file:** to return one
variable, `loadEnv` opens and parses the whole file that holds `DATABASE_URL`. Nothing
would reach a browser — a proxy target is a dev-server setting, evaluated in Node, never
bundled. The objection is that reading the file with the database password in it would
become a normal thing for the client's toolchain to do, and the whole of what that buys is
not retyping one number. **If `PORT` changes, change `vite.config.ts` too; the failure it
leaves is a confusing 404 from the proxy, in development, with someone watching.**
*Why this is in the Map: a false "X cannot do this" written into a comment is worse than
the limitation it describes, because it closes the door for whoever reads it next.*

**StrictMode's double-mount, recorded so it is not rediscovered as a bug.** A dev page load
fires `GET /api/words` twice; the `AbortController` cancels the first, so total transfer is
about one response. A production build fires once. **Cancellation is an `AbortController`,
not the `{ cancelled }` flag v3.1 used** — that flag was a workaround for an unreliable
`AbortController` inside the artifact sandbox, and the sandbox is gone.

**Q21a's evidence, stated correctly.** The build session offered "2 requests on load, 2
after 8 seconds idle." **That is weak evidence** — a thirty-second poll would pass it. The
proof that holds is that `setInterval` appears in no code that runs. *(A grep finds several
`setTimeout` calls in `reference/lexicon-v3.jsx`. That is the frozen v3.1 prototype,
imported by nothing and executed by nothing; `app.tsx`'s comment now says so in place.)*

**A blind spot in the window rule, found the hard way.** The build session found nothing
listening on 3000 and started its own server — window 1 had died at some point unnoticed.
**The Map's rule says "a prompt means idle." A crashed server window shows a prompt too,
and looks exactly like an idle one.** With three windows rather than two, the title-bar
habit listed as "optional, not adopted" under Environment is worth more than it was.

**Loose end carried to step 8: `CLAUDE.md`'s Build-position line still says step 7a is
next.** *Closed 2026-10-26: the line now says step 8 is next.*


### Step 9 — the loader's progress half (RESOLVED 2026-10-27)

**Status: BUILT, RUN AND VERIFIED. Commit `b85372c`, pushed.** Built by Claude Code in a
parallel git worktree (`step-9`) while step 8 waited: the first step under the revised
tooling division. Reviewed against the diff by the planning session before Jonathan ran it.

**THE EVIDENCE OF RECORD — Neon's SQL Editor on `dev`, 2026-10-27:**

| words | users | user_settings | progress | schema_migrations |
|---|---|---|---|---|
| 1,070 | 1 | 1 | 95 | 1 |

Three rows checked against the backup file by name (the planning session read the file
directly): `abashed` (repetition 0, `last_rated` = `next_review`), `a fortiori`
(repetition 5; intervals 1, 3, 7, 17, 40 days at ease 2.36, so April 7 from May 17, worked
by hand) and `adjure` (the earliest `next_review`, 2026-03-01). Dry run and real run both
PASS under `--strict`, 0 failures, 0 warnings. `npm run typecheck` clean.

**The case-insensitive path, proven on synthetic input in a scratch copy outside the repo**
(re-run against code matching `b85372c`):
- **A key in the wrong case** (`glee` renamed `Glee`): 94 exact, 1 case-insensitive, all
  95 landed on their own words.
- **Headwords gaining capitals** (four 26a entries marked accepted): `arcadia`,
  `brigadoon`, `dowager` and `goldilocks`, the only four of the 45 candidates with progress.
  91 exact, 4 case-insensitive, all on their own words. **These four are where the path
  goes live once 26a is reviewed.**
- **Not tested:** a key and a headword that both carry capitals but differ (`ARCADIA`
  against `Arcadia`). Both sides are lowercased, so this is low risk.
- Nothing with an inexact match has ever been committed; every synthetic run rolled back.

**SIX DECISIONS, RATIFIED BY JONATHAN 2026-10-27.**

**1. `last_rated = next_review − getInterval(ease, repetition) × 24 hours`, in UTC.**
The formula reverses v3.1's `recordAnswer` (`reference/lexicon-v3.jsx`, `getInterval` and
`recordAnswer`), checked against the source by the build session.
- **Rounding causes no error.** The handoff said it did, and was wrong: the interval is
  recomputed from the same stored `ease` and `repetition` it was first computed from.
- **The real error is daylight saving.** v3.1 added days with `setDate`, which holds the
  clock time steady across a change; a UTC subtraction does not. **Five records are one
  hour off:** `adamantine`, `abjure`, `ad hoc`, `a posteriori`, `accede`. The other 90 are
  exact, including all 20 at repetition 0.
- *Evidence the ratings were made on New York time:* read on the New York clock, those
  five land 1–8 minutes from other ratings whose times are exact; read in UTC, 40–67 minutes.
- **Strongest argument against:** the data shows which reading is right, and the
  derivation is permanent. A New York calculation would be exact for all 95.
- **Why not:** it hard-codes a time zone the file does not record, and adds about 20
  lines that step 10 must re-implement (5f), for a value already marked "not for streaks or
  precise history." **Reversible before step 17 by changing one function.**

**2. The orphan check compares each row's `next_review` with the file**, not only the set
of names. A name check passes when two records swap words; a deliberately broken loader
proved it. All 95 `next_review` values are distinct. *Cost:* it overlaps step 10's verify.

**3. Four new failures before the database is opened**, each proven to fire on bad input
and silent on the clean file, on the step-5 precedent: a `nextReview` with no time zone
(JavaScript and Postgres would read it as different moments); a negative repetition
(`getInterval` would recurse forever); two keys colliding case-insensitively (one would be
lost); a derived `last_rated` in the future. A shared `readProgress` serves both the read
check and the write plan, so the two cannot disagree about which records are loadable.

**4. A case-insensitive match is a report line, not a warning.** Once 26a's capitals land
it is nonzero on every run, and an alarm that always sounds is not an alarm. *Cost:*
nothing forces a look at cutover, so **step 11's checklist now names those lines.**

**5. `valuesPlaceholders` extracted from step 6's `insertWordsSql` at its second caller**,
not the third the house rule names. Small; the dry run re-proved the words insert at 1,070.

**6. The progress line reports Postgres's own row count; the words line still reports the
plan's.** Inconsistent, deliberately left; a deliberately broken loader that dropped a row
showed why the database's count is the honest one. **Step 10 brings the words line into
line.**

**Working notes from the first parallel session, recorded so they are not relearned:**
- **A 16 GB laptop ran out of memory twice:** a third VS Code window crashed VS Code, and
  TypeScript 7 aborted `npm run typecheck` with `errno=1455` until other programs were
  closed. **Run parallel sessions as `claude` in a terminal, not as extra VS Code windows**
  (about 300 MB each, against a gigabyte or more per window).
- **A worktree cannot be removed while any window stands in its folder**, even an idle
  prompt.
- **Long commands pasted into PowerShell can wrap into two commands.** Put a long path in a
  variable first (`$f = "…"`), then use `$f`.

### Step 8 — Render, the first deploy, and the Inkhorn rename (RESOLVED 2026-10-29)

**Status: LIVE at https://inkhorn-jxxu.onrender.com. Commits `c5d42ea`, `b025171`,
`e088dd1`, `c4ff173`, `bf36c2e`, `21ffb95`, `b680dcd`, `dd96ab0`, all pushed.** Built by
Claude Code over two sittings; every public push run by Jonathan after a planning-session
check of the unpushed diff.

**THE EVIDENCE OF RECORD — Jonathan's screen, 2026-10-29:**
- **Deploy log, in order:** Node **24.22.2** → `npm ci`, 117 packages, **0 vulnerabilities**
  → `vite build` (191 KB, 60 KB gzip, as at 7b) → `Basic Auth is ON.` → `migrate:` with
  `rejectUnauthorized: true`, `nothing to apply` → `listening`. **Q32's check passed:** no
  phantom dependency surfaced on Linux.
- **The gate:** the prompt appeared; a wrong password was refused; the right one let him in.
  (The build session also confirmed 401s with curl.)
- **Counted, not eyeballed:** `document.querySelectorAll('#root ul li').length` → **1070** on
  the live site.
- **SIGTERM (step 7a's three obligations):** under `npm start`, two redeploys, no shutdown
  line. Under `node server/src/index.ts`, both `SIGTERM received. Closing.` and
  `pool closed.` **The handler works; npm stood in the way.** Note that SIGTERM goes to the
  *old* instance, so the first redeploy after a start-command change still tests the old
  command.
- **21d:** `dev` **Idle**, last active 14 minutes earlier. **CU-hours reading due
  2026-11-05.**

**Other results:** Render pricing matches decision 6 (Starter $7/month; free tier sleeps after
15 minutes). The Pre-Deploy Command field **exists** (paid services; left empty). The form now
says "Compute" and "Deploy Web Service". `npm audit fix`: 5 → 0 vulnerabilities, no major
bumps; the app never sets `trust proxy` or reads `req.ip`. The `noreply` commit email is set
globally (`281466530+jonathanmilder@users.noreply.github.com`); local Gmail overrides were
removed from his other repos. README written and edited line by line by Jonathan; Contact is
the repo's GitHub issues, no address published. The tagline is open, due before step 13.

**THIRTEEN DECISIONS, RATIFIED BY JONATHAN 2026-10-29.**
1. **"Production" = `RENDER === 'true'` or `NODE_ENV === 'production'`**, used only to refuse
   a start without the gate. *Cost:* on a host that sets neither, a missing gate fails open,
   with a loud `Basic Auth is OFF` line.
2. **Build command `npm ci --include=dev && npm run build`.** Render installs devDependencies
   by default (`NODE_ENV=production` is runtime only); the flag makes it explicit.
3. **Production refuses to start without `dist/client/index.html`.**
4. **Basic Auth compares SHA-256 hashes with `timingSafeEqual`, both comparisons always run.**
5. **One of the two auth variables set without the other → refuse, locally too.**
6. **Node pinned by an `engines` upper bound (`>=24.2.0 <25`)**, not an exact version: Render
   takes the newest 24.x. An unbounded range would have put it on 25.
7. **Region Ohio** (see 6b).
8. **The port bug (`b025171`):** Express 5 hands a listen error to the success callback, so a
   port in use printed `listening` and exited 0. Now exits 1. Found by accident.
9. **Left as "Lexicon":** backup filenames, `reference/lexicon-v3.jsx`, the loader's "not a
   Lexicon backup" messages, and the local folder (renamed later, when no worktree is open).
10. **`.env.example` gained a two-line comment on the gate's rules**, so Q18's copy of it in
    this file no longer matches word for word. The file is authoritative.
11. **README: "a word comes back just before you would forget it" became "a word you know well
    comes back less often than one you struggled with"**, to avoid overclaiming.
12. **Render's start command is `node server/src/index.ts`, not `npm start`.** *Why:* the
    SIGTERM test. *Strongest argument against:* the failure was bounded (a 30-second hard
    kill; Neon reclaims the connections), and `npm start` is what a reader expects. *Cost:*
    the dashboard setting and `package.json`'s `start` script can drift apart. The README
    says why.
13. **Diagnosed by experiment, not by reading npm's source.** Two free redeploys. It shows
    that removing npm fixes it, not where in npm → shell → node the signal is lost.

**Working notes, recorded so they are not relearned:**
- **One project per terminal window, each titled** (`$host.UI.RawUI.WindowTitle = "INKHORN"`).
  On 2026-10-29 a backgrounded Claude Code conversation reopened as a different project's
  session (Auracle), which looked like a crash.
- **This planning session must not run git commands that write**, such as `pull`: it cannot
  delete git's lock files, and a stray `maintenance.lock` was left under `.git` (moved aside,
  not deleted).
- **Pasting a multi-line block into PowerShell runs each line.** Clear an accidental paste with
  Esc.

### Step 10 — verification, the gate (RESOLVED 2026-10-31)

**Status: BUILT, RUN AND PASSED. Commits `3527bd2` (loader words line) and `1c2270f`
(`server/scripts/verify.ts`), pushed 2026-10-31 (`0f02873..1c2270f`).** Built by Claude
Code in one session. Reviewed by the planning session against the diff, the v3.1 source
and the backup file before Jonathan ran it.

**THE EVIDENCE OF RECORD — Jonathan's terminal, 2026-10-31:**
- **`verify.ts <-b file> --target dev --strict`: seven PASSes, 0 warnings.** Read-only
  proven before reading: `SHOW transaction_read_only -> on`, and Postgres refused the probe
  write ("cannot execute UPDATE in a read-only transaction"). Check 4 compared all 1,070
  rows, all eight columns, 0 differ. Check 5: file and Postgres spans identical to the
  millisecond, 2026-03-01T03:28:13.250Z to 2027-08-07T02:30:47.553Z, 0 outside. Check 7:
  971 / 971 as of 2026-08-04, and 971 / 971 at 2026-10-31T14:27Z.
- **Loader `--dry-run --strict --target dev`: PASS, 0 failures, 0 warnings.**
  `words: 1,070 rows inserted` is now Postgres's own `rowCount`. Rolled back.
- *Session-side, from the build session's report, not re-checked:* 15 mutated backups and
  4 deliberate breaks of verify's own rules each failed as predicted (scratch files outside
  the repo). `npm run typecheck` clean.

**Checked by the planning session against the files, not the report:**
- verify.ts imports only `db-config.ts` and `format-database-error.ts` (read from its
  import block).
- `intervalDays` matches v3.1's `getInterval` (`reference/lexicon-v3.jsx`, line 59); the
  Study Due rule matches v3.1's `dueWords` (lines 151–155: fetched words only, no record
  = due). The Q27 rules match Q27; `last_rated` is Step 9's decision 1.
- The dated claims in verify's comments, recomputed from the `-b` file in Python: Study Due
  971 on 2026-08-04 and on 2026-10-31; the last value due before the baseline is
  `a fortiori`, 2026-05-17 04:08 UTC; `accede` falls due 2026-11-17 15:23 UTC; 4 promoted
  and 72 superseded; `moribund` has the longest usage note, 1,314 characters.
- The schema has no triggers, so the probe write cannot fire one.

**THREE DECISIONS TAKEN WITH JONATHAN BEFORE BUILDING (2026-10-31):**
1. **Verify is its own file, `server/scripts/verify.ts`, importing nothing from the
   loader.** Reverses 5f's "in the same script." *Why:* independence is provable from the
   import list. *Cost:* the loader no longer ends with verify (5d step 8); they are two
   commands, and step 11's checklist names both.
2. **Study Due = 971 as of 2026-08-04T00:00Z, from the file and from Postgres; plus file
   = Postgres at now, with no number.** *Why:* 971 counted at now fails on correct data
   from 2026-11-17 15:23 UTC, when `accede` falls due (972), and again on 2027-08-07.
   **After 2026-11-17 the now line reads 972 on both sides; that is correct.** Until then
   the two sub-checks see the same number and cannot be told apart.
3. **Check 5's window is fixed, [2026-01-01, 2028-01-01) UTC, never relative to today.**
   *Why:* frozen data does not age, and the faults the check exists for (a missing value
   read as 1970, seconds taken for milliseconds) land decades out, not months. A time-zone
   shift is check 3's to catch, not this one's.

**FIVE IN-STEP DECISIONS, RATIFIED BY JONATHAN 2026-10-31.** The build session took them
without listing them; the planning session surfaced them from the code.
1. **`main`'s typed phrase is `verify main`, not `load main`:** a phrase typed from habit
   should not carry from one program to the other. A wrong phrase exits; it costs nothing.
2. **Check 1 compares the headword sets, and check 4 compares every row, not only the three
   spot words.** Broadens 5f. The spot words print lengths and "ok", not text, so they were
   never a human read; the sweep compares every character, and it is the only part that
   reaches the words Q27 alters (`satrap`, `importunate`).
3. **`audacious` fills two of check 4's slots:** `example`-only, and em dash plus quotation
   marks. 5f allows it ("one of the three"), and the sweep covers every em dash anyway.
4. **A file verify cannot fully read stops it before the database is opened.** A file of
   record that fails is almost certainly the wrong file, and a comparison against it would
   mean nothing.
5. **An unknown key is a warning, and `--strict` makes it a failure** (5e, kept). *Strongest
   argument against:* without `--strict`, verify can PASS with a blind spot. *Answer:* the
   gate always runs `--strict` (step 17), and the frozen file has no unknown key. Not a
   security exposure: the file is only parsed, never executed, and verify cannot write.

**Notes, none queued as fixes:**
- Check 7's file side looks progress up by exact headword, as v3.1 does; check 3 matches
  case-insensitively, as the loader does. No progress key in the frozen file differs in case
  (checked in Python), so the two cannot disagree on it.
- Verify filters by no user; checks 1 and 6 fail, not pass, once a second user exists.
  Carried to Q8.
- The TLS line prints an em dash, from `describeTls` in `db-config.ts`; verify's "ASCII
  only" holds for its own text. It rendered correctly in PowerShell.
- The loader's banner still reads "(step 9)". Still accurate: step 9 was its last data step.
- **The PowerShell paste hazard recurred (see Step 8):** verify's output was pasted into
  PowerShell after Claude Code had exited. Every line failed harmlessly. `mode` was the only
  real program reached, and it refused its arguments; the `->` line created no file; no file
  in the repo changed (checked). **Before pasting, read the window's last line: an input box
  is Claude Code; a bare `PS …>` takes commands only.**

### Q32 — the widened phantom-dependency hole (RESOLVED 2026-10-29, at step 8)

**Resolved as the lean said: the step-8 deploy was the check, and no tooling is needed.** A
clean `npm ci` and boot on Render's Linux, with 117 packages, surfaced no undeclared import.
The audit fix added one nested production package (`content-type` under `body-parser`).
**Any future deploy re-runs the same check for free.** The question as it stood:

**The installed dependency
closure went from roughly 17 packages to roughly 80 at step 7a, and Q16's
phantom-dependency cost was accepted partly on the old number.**
**MEASURED 2026-08-22, after step 7b: 117 packages install on this machine.** Counted
from `package-lock.json` rather than from an install log. The lock file holds 161
entries; 44 are optional Rolldown platform bindings for other OS/CPU pairs and never
install here. 161 − 44 = 117. **Of the 117, 84 are production and 33 dev-only** — and
it is the production closure that reaches Render, so the number that matters for the
phantom-dependency hole at deploy time is 84, not 117. Vite 8 is Rolldown-based and
the React plugin's Babel/oxc peers are optional, so this is lighter than it could have
been. Q16 chose npm over pnpm knowing npm's flat
`node_modules` permits importing a package that was never declared — working locally,
failing on deploy — and judged it "a narrow hole against an unfamiliar tool, at ~a dozen
dependencies." **The hole is now roughly five times wider, and step 7b adds Vite and
React on top.**
*The question is not whether to switch package managers* — that would trade a known
narrow risk for an unfamiliar tool mid-build, which is exactly what Q16 rejected.
**It is whether anything cheap closes the hole**: a lockfile-aware check, a lint rule, or
simply the observation that a deploy at step 8 surfaces the failure early and often
enough to be self-correcting. **Lean: the step-8 deploy is the answer and no tooling is
needed** — Q20 put the deploy early for precisely this class of Windows-to-Linux
surprise. Recorded so the premise change is not silent.

### Q30 — renaming the project to Inkhorn (RESOLVED 2026-10-26)

**Does the project get renamed to Inkhorn?** *Inkhorn term* is the
sixteenth-century insult for ostentatiously Latinate vocabulary. **Deliberately
deadlined at step 8** because renaming gets more expensive with each step: at step 1 it
was a repo name; after step 8 it is a repo name, a Render service, and a URL people may
have. **The risk is not the decision but the drift.** [interacts with: 23, and the
step-8 README]
**RESOLVED 2026-10-26: YES — the project becomes Inkhorn.** Jonathan's reasoning: wry,
but the joke is on itself. **Cost accepted:** the word is obscure, and to a student or
ESL reader it is opaque; **a tagline carries the legibility the name gives up.** The
rename (repo, Render service, README, `package.json` name) lands at step 8, before the
first deploy. **Still open:** the tagline, and a trademark/domain check before a
domain is bought (Q23).
**DONE at step 8 (2026-10-28):** the GitHub repo, `package.json`, the README, `CLAUDE.md`, the
page title and the Render service all say Inkhorn. **Still open:** the tagline (before step
13; candidates kept in Jonathan's notes) and the local folder rename.

## Working environment and data notes

### Environment — verified 2026-08-06, extended 2026-08-08 and 2026-08-11

- **Node v24.14.1** (LTS), **npm 11.11.0**, **git 2.53.0.windows.2**. Replaces
  "versions unrecorded." Node 24 is what Render pins at step 8.
- Windows native, PowerShell in VS Code's integrated terminal. WSL/Ubuntu available but
  Windows-native preferred.
- **Repo folder renamed to lowercase 2026-08-08: `C:\Users\<user>\code\lexicon`.**
  Confirmed with `(Get-Item ...).Name`, which reports the name as the filesystem stores it
  rather than as typed. Purely tidiness — the local folder is not a tracked filename and
  never travels to Linux, so Q19's rule did not strictly reach it. Done so that "the
  lexicon folder" has one referent and the local path matches the GitHub repo name.
  *Windows gotcha, recorded:* `Lexicon` and `lexicon` are the same name to Windows, so a
  direct rename is refused; it takes two `Rename-Item` calls through a temporary name.
  VS Code will also restore the old capitalized path on launch and open it happily —
  re-open the folder fresh once to fix the recent-folders entry.
  *Observed 2026-08-11: the prompt still reads `C:\Users\<user>\code\Lexicon`.* Cosmetic,
  from the shell's own path string rather than the filesystem. Harmless.
- **POWERSHELL DISPLAYS UTF-8 AS MOJIBAKE, AND THE FILES ARE FINE (2026-08-08).**
  Windows PowerShell 5.1 reads files through the legacy system codepage rather than UTF-8,
  so a correctly stored em dash renders as `â€"`, and accented characters mangle the same
  way. **Diagnosed on `package.json`'s description field; `Get-Content -Encoding UTF8`
  returned a clean em dash, proving the bytes on disk are correct.**
  *Why this is worth a Map line rather than a shrug:* **the backup contains *coup de grâce*,
  *vis-à-vis*, and 60 other multi-word or accented headwords**, and the loader prints
  headwords. At steps 6 and 9 this will look exactly like data corruption in a project whose
  entire subject is orthographic precision. **Check the encoding before believing the
  screen** — `Get-Content -Encoding UTF8`, or read the file in VS Code, which handles UTF-8
  correctly. A future `chcp 65001` or a move to PowerShell 7 would remove the illusion
  entirely; neither is done, and neither is required.
  **Refinement 2026-08-11: the clipboard is cleaner than the screen.** Em dashes in
  `migrate` and loader output arrived intact when pasted into chat, having mojibaked on
  screen. A copy-paste fact about the terminal's clipboard, not evidence about the files —
  the files were already proven correct by `-Encoding UTF8`.
- **PASTING A MULTI-LINE BLOCK INTO POWERSHELL 5.1 RUNS EACH LINE AS IT ARRIVES
  (found 2026-08-11).** The interactive prompt does not wait for the whole paste; it
  executes at every line break. A complete `if` on line one runs immediately, and the
  `elseif` and `else` that follow arrive as orphans and error. **The same block in a `.ps1`
  file works, because a file is parsed whole.** PowerShell 7 handles pasted blocks; 5.1
  does not.
  *Consequence for this project:* **any command given in chat must be a single line, or a
  series of independently complete statements.** Never a multi-line construct.
- **Three-window sessions.** From step 7b onward a working session needs three PowerShell
  windows: one running the server (`npm run dev:server`, **no prompt**, last lines are
  `server: listening…` / `server: try…`), one running Vite (`npm run dev:client`, **no
  prompt**; `strictPort: true` means it is either on 5173 or it has failed), and one at a
  prompt for everything else.
  **Was two windows from step 7a. The third arrived at step 7b, when Q31's single manifest
  forced `npm run dev` to split into `dev:server` and `dev:client` — there is no script
  that starts both.**
  **Windows accumulate across a session and become genuinely indistinguishable.**
  - **Identify a window by what is on its screen, never by the order it was opened.**
    A prompt means idle; no prompt means busy.
  - **Ctrl+C only stops. There is no keyboard "start" — starting is always a typed
    command.** Old output sitting above a live prompt is history, not a running process.
  - *Optional habit, not adopted:* `$host.UI.RawUI.WindowTitle = "SERVER"` puts a label in
    the title bar and the taskbar.
- **TypeScript execution — NO RUNNER, and none is needed (verified 2026-08-08).**
  - **Node 24 runs `.ts` files directly.** Plain `node`, no wrapper; a throwaway `.ts` file
    carrying a type annotation executed straight through.
  - **The mechanism:** Node **strips** the type annotations and runs what is left. It does
    **not** check them. Checking is a separate job, done by `npm run typecheck`.
  - **`tsconfig.json` sets `erasableSyntaxOnly`**, which rejects any TypeScript syntax Node
    cannot simply erase — enums, namespaces, parameter properties. That converts a
    "passes the checker, crashes at runtime" class of bug into a checker error.
  - **Consequence: no `ts-node`, no `tsx`, no build step, no dependency.**

**NODE FLAG POSITION — `--env-file` GOES BEFORE THE FILENAME (recorded 2026-08-11).**
Everything before the script filename is an instruction to **Node**; everything after is
passed to **the script**. `node --env-file=.env server/scripts/import-json.ts …` works;
the same flag after the filename would be handed to the loader's own argument parser.
*Why this earns a line:* **the only loader command written down in this Map was step 5's,
which correctly has no `--env-file`** — at step 5 no database was in the picture. Retyped
at step 6 or later it fails. It failed exactly that way on 2026-08-11.
**The failure was loud and self-describing** — the loader printed that `DATABASE_URL_DEV`
was unset, said where it belongs, and said the command needs `--env-file=.env`. That is
Q18's three-variable design paying out: a missing variable is an immediate stop with
instructions, not a cheerful connection to the wrong place. **The canonical command is now
recorded under "Step 6 — the run of record."**

**Dependency list — TWELVE declared packages (read from `package.json` 2026-08-22).**
Supersedes the six-package list; React and the Vite toolchain landed at step 7b.

| | Package | Declared | |
|---|---|---|---|
| dependency | `express` | ^5.2.1 | new at 7a |
| dependency | `pg` | ^8.22.0 | |
| dependency | `react` | ^19.2.8 | new at 7b |
| dependency | `react-dom` | ^19.2.8 | new at 7b |
| dev | `@types/express` | ^5.0.6 | new at 7a |
| dev | `@types/node` | ^24.13.3 | |
| dev | `@types/pg` | ^8.21.0 | |
| dev | `@types/react` | ^19.2.18 | new at 7b |
| dev | `@types/react-dom` | ^19.2.4 | new at 7b |
| dev | `@vitejs/plugin-react` | ^6.1.0 | new at 7b |
| dev | `typescript` | ^7.0.2 | |
| dev | `vite` | ^8.2.2 | new at 7b |

Four dependencies, eight devDependencies. **Twelve items, twelve rows — counted by reading
the items, per the step-5 habit.**

**`pg`'s transitive count is RESOLVED at 13, and the Map's old "11" was wrong.**
Computed from `package-lock.json` at step 7a. The thirteen are exactly the thirteen the
Map already named: `pg-pool`, `pg-protocol`, `pg-types`, `pgpass`, `postgres-array`,
`postgres-bytea`, `postgres-date`, `postgres-interval`, `pg-int8`, `pg-connection-string`,
`pg-cloudflare`, `split2`, `xtend`. **The count was wrong; the list was right** — which is
precisely what the step-5 habit predicted ("when a report gives both a number and the
items, count the items"). This closes the open item that said 11 was unverified and should
not be quoted.

**`express` pulls 64 transitive packages; `@types/express` pulls 10.** npm printed
"added 67 packages" on install, which disagrees with the name counts. **The gap is real and
boring:** `content-type` is installed three times at different versions — top level, plus
nested copies under `body-parser` and `type-is`. npm counts installed *directories*; the
closure counts distinct *names*. 65 names + 2 duplicate directories = 67.

- **TypeScript 7 pulls ~18 platform-specific binary packages** (`@typescript/typescript-
  win32-x64` and siblings) — the native-Go compiler. Only the one matching this machine
  actually installs.
- **Watch item: TypeScript 7 is the new native compiler, not the old JavaScript one.**
  Fast, and working here, but much newer than the rest of this stack. **If the toolchain
  ever behaves oddly, suspect this first.**
- **`package.json` scripts and fields (re-read 2026-08-22, after step 7b):**
  `"migrate": "node --env-file=.env server/src/migrate.ts"` ·
  `"dev:server": "node --env-file=.env server/src/index.ts"` · `"dev:client": "vite"` ·
  `"start": "node server/src/index.ts"` · `"build": "vite build"` ·
  `"typecheck": "tsc -p tsconfig.json && tsc -p client/tsconfig.json"` ·
  `"type": "module"` · `"engines": { "node": ">=24.2.0" }`.
  **The `engines` field is what Render reads at step 8** to pin the Node version, so Q16's
  pinning decision is already in the file rather than waiting on a dashboard setting.
  **`npm run dev:server` passing `--env-file=.env` was confirmed on screen 2026-08-11** —
  it prints in the command echo, under the name `npm run dev` the script then had. Q18's
  local/production asymmetry is visible where it was designed to be visible.
  **~~`engines` IS NOW INACCURATE~~ — CLOSED at step 7b. It reads `>=24.2.0`.**
  **`typecheck` runs two configs since step 7b**, the Node half and the browser half.

**TWO COUNTING ERRORS IN THE STEP-5 SESSION REPORT — recorded, not silently corrected.**
- **It said "five declared packages" and listed four.** Four was correct at the time.
- **It said `pg` pulls in "11 transitive packages" and then named thirteen.** **Now
  resolved: thirteen is correct**, computed from `package-lock.json` at step 7a.
- *Why this stays in the Map rather than being quietly deleted:* both errors were caught
  only because a stated count disagreed with an adjacent list. **The habit worth keeping:
  when a report gives both a number and the items, count the items.** It has now paid out
  twice.

- **GitHub CLI 2.97.0 installed and authenticated**, token scopes `gist`, `read:org`,
  `repo`, `workflow`. `gh auth setup-git` has been run, so git pushes to github.com over
  HTTPS using that token.
- **GitHub username renamed to `jonathanmilder`** (2026-08-06), before anything linked
  to it. Real name is deliberate: `user.name` already stamps every commit, so a
  pseudonymous account would only produce a mismatch.
- **Commit email is a personal Gmail address and is now in public commits.** Switching
  to GitHub's `noreply` alias is one config line, deferred to step 8 with the other
  public-facing items.
- No existing accounts at any host or database provider as of 2026-08-06. **Neon account
  created 2026-08-08** — project in US East, `main` and `dev` branches, free plan.
  Render signup remains at step 8.
- **APPLIED 2026-08-09 (Q21b): both computes pinned to 0.25 CU** — size lines read `.25 CU`
  where they read `.25 ↔ 2 CU` before. **Free offers no fixed-size control; the pin is the
  autoscale slider with both ends at 0.25.** **Scale to zero confirmed non-configurable on
  Free, on screen.** Recorded here as well as in Q21 because it is console state with no
  representation anywhere in the repo, and unrecorded console state is exactly what cost a
  session with the artifact. **Still open, one click: the project DEFAULT compute size.**
- **Neon role passwords are per branch, and resetting one is genuinely buried in the
  console** (found the hard way 2026-08-08). A rotation is **two resets, not one** — `main`
  and `dev` hold separate role passwords.
- **Credential-exposure incident, 2026-08-08 — closed, no residue.** A Neon role password
  reached a Claude Code session transcript stored locally, and nowhere else. Both roles
  rotated; all three connection strings re-verified afterward. **Verified four ways that
  nothing reached git:** `.env` never committed on any branch at any point; `.env` not
  tracked now; no `npg_`-format string anywhere in history; no `neondb_owner` anywhere. The
  only `neon.tech` hit in the entire history is `.env.example` holding its placeholders.
  **The commit history is clean and safe to leave public.**
  **Two habits kept it clean, both worth keeping:** `.gitignore` was already correct before
  any credential existed — Q7's "decided at the safest possible moment" paying off — and
  every `git add` named explicit paths rather than `git add .`.

**THE PRE-PUSH CREDENTIAL CHECK — now a standing habit (2026-08-11).**
Before any push containing code that handles connection strings:

```
git log --oneline origin/main..HEAD
git diff origin/main..HEAD | Select-String -Pattern "neon\.tech|npg_|neondb_owner"
```

*Terminal commands.* The first confirms the commit count is what was expected; the second
should print nothing.

**It fired for the first time on 2026-08-11, and the hits were safe** — two added *comment*
lines inside the masking function documenting the shape `ep-<adjective>-<noun>-<id>.
<region>.aws.neon.tech` and the constant `aws.neon.tech` tail. Placeholders and a vendor
suffix; no adjective, noun, id, or region. Pushed.
*Why the outcome is the good one:* **a check that never returns anything trains you to skim
past it.** One that occasionally returns something requiring ten seconds of reading keeps
the habit real.

### The v3 source — location, sufficiency, and what it settles

- **`lexicon-v3.jsx` is now at `reference/lexicon-v3.jsx` in the repo** (2026-08-06),
  plus a copy in Dropbox. **The single-copy fragility is retired.**
- **`lexicon-brief-v2.md` and `lexicon-brief-v3.md` also live in `reference/`.**
- **Reading the local file carries no risk and is not "opening LEXICON LIVE."** It is a
  text file; nothing writes back and it has no hidden state. **Confirmed in practice
  2026-08-05 — targeted paste of four regions settled 24k, Q27's shape, and Q29.**
- **The v3 → v3.1 delta is fully known, and none of it matters for leg one**
  (established 2026-08-05 from the JSDoc changelog). v3.1 added: bulk delete via checkbox
  selection; unfetched words made expandable with a remove option; single-word remove
  cleaning up orphaned progress; a confirmation dialog on single-word remove; and all
  `confirm()` dialogs replaced with inline confirmation UI.
  **Every item is either below the Q15a parity line, or curation deferred post-cutover, or
  a sandbox workaround this Map says to remove rather than port.**
- **The fetch prompt is not at risk either.** The v3.1 changelog records no change to the
  source-steering prompt, so the prompt in `lexicon-v3.jsx` *is* the v3.1 prompt. It gets
  one revision regardless, for canonical orthography (step 16 and 26a).
- **`DEFAULT_SOURCES` in the code holds 3 dictionaries + 3 usage guides; the file holds
  4 + 6.** General rule: for *data*, read the backup; for *logic*, read the source.
- **Filenames are not evidence; the JSDoc changelog block at the top of the source is.**
- **The brief is the specification; the source is the reference implementation.**
- **Opening LEXICON LIVE remains trigger-based, not pre-emptive.**

### The data

- Export shape: `{ words, progress, sources }`.
- **Verified against all 1,070 records (2026-08-04), correcting two earlier claims:**
  - **`sources` is NOT a flat array.** It is an object with two named arrays,
    `dictionaries` (4) and `usageGuides` (6) — `usageGuides` is **camelCase**. The current
    ten: MW Unabridged, AHD 5th, New Oxford, Webster's New International 2nd; Fowler's,
    MW Usage, Bernstein's, Garner's, Pinker's *A Sense of Style*, *Dreyer's English*.
  - **`mnemonics` is present on all 974 fetched words.**
  - Word keys are snake_case; `definitions` and `examples` are true JSON arrays;
    `mnemonics` is a plural key holding a singular string.
- **Field coverage (of 974 fetched):** definitions 974, mnemonics 974, part_of_speech 974,
  usage_note 974, etymology 973, pronunciation 973, examples 970, `example` (singular) 76.
  **All eight re-confirmed by machine 2026-08-08 and again 2026-08-11.**
- **Fetched fields remain independently optional** — `bromide` has no pronunciation,
  `portentous` no etymology. Only `definitions` marks fetched vs unfetched. Missing
  optional keys are normal and must not be warned on.
- **The 96 unfetched words carry the `word` key and NOTHING ELSE — zero exceptions.**
  This is what makes `definitions` a reliable fetched/unfetched marker.
- **Five stray keys exist that the schema has no column for** — `example`, `confusables`,
  `etymology_note`, `pronunciation_note`, and the typo `definitons`. **All five resolved
  by Q27 — none adds a column.** **No sixth stray key exists.**
- **62 multi-word or hyphenated headwords** — *a fortiori*, *coup de grâce*,
  *will-o'-the-wisp*, *vis-à-vis*, and 58 more. Two (`epi-`, `ur-`) are prefixes rather
  than words — curation, not schema. Matters for string matching, and Q25.
- **All 1,070 headwords are lowercase; zero exceptions.** **1,070 distinct compared
  case-insensitively** — so the functional unique index of 24h cannot collide on load.
- A progress record is `{ ease, repetition, nextReview }` — only for words actually rated.
  95 exist. Zero orphans; zero point at unfetched words. `last_rated` is derived (24e):
  exact except where an interval crosses a daylight-saving change, where five named
  records are one hour off (Step 9, decision 1). Still not to be trusted for streaks or
  precise history. Post-migration values are exact.
- **Progress-record detail, verified 2026-08-08:**
  - **All 95 hold a numeric `ease`, an integer `repetition`, and a parseable `nextReview`.**
  - **`nextReview` spans 2026-03-01 to 2027-08-07.** See the calibration note on 5f check 5.
  - **`ease` runs 2.36 to 2.60** — a narrow band, nothing near SM-2's 1.3 floor.
  - **All 95 progress keys match their headword EXACTLY today**, so 24h's case-insensitive
    match is currently **inert.** It stops being inert the moment 26a's capitals land.
- **Ids are internal plumbing. The word string is the public identity** — in URLs, in
  exports, in anything crossing the app's boundary. Ids regenerate on every wipe-and-
  reload before cutover; nothing outside the database may depend on them.
  **Sharpened 2026-08-11: `GET /api/words` returns `id`, and step 7b will use it as a React
  key. That is fine — a React key never leaves the browser's memory. It must NOT become a
  URL segment, a route parameter, or an export field.** The distinction is *internal to a
  render pass* versus *crossing the app's boundary*.
- Artifacts carry hidden state that cost a full session to untangle (2026-08-03). The live
  artifact is identified by its word counts, not by title, chat title, or publish button.
- **After cutover the JSON export stops being a current backup** — it becomes a snapshot
  of the migration moment. This is the concrete statement of why Q22 is pressing.
- **The 96 unfetched words are fetched AFTER cutover, against `main`, from the deployed
  app.** Fetching them earlier means fetching against `dev`, and step 17 wipes and reloads
  `main` from the JSON — the work would silently evaporate.

