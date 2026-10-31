# Map: Lexicon — standalone, multi-user, auto-capture

## Destination

Lexicon runs as a deployed app outside the artifact sandbox, with real accounts, and
the capture loop closed: a word looked up on the phone reaches the library without
manual export. Done planning = every decision needed before building can start.

**Leg one is sequenced (Q20). Steps 1 through 10 are complete. Inkhorn is live at
https://inkhorn-jxxu.onrender.com (2026-10-29): Render, Ohio, behind Basic Auth, reading
the Neon `dev` branch, 1,070 words counted in the browser. Step 10 — verification, the
gate — passed 2026-10-31: seven PASSes under `--strict` against `dev`. Step 11 — the
cutover acceptance checklist — is NEXT.**

**Where things live (split 2026-10-26).** This file holds the destination, the working
rules, the open questions and the build order. **The resolved decision records, the
environment notes and the data notes are in `decisions.md`.** A cross-reference here that
says "above", "below" or "full record" to a resolved Q-number or step record points there.

## Notes

- Jonathan: career editor, 20+ yrs, building his first full-stack app. Must be able to explain
  every layer — legibility beats speed on all stack choices.
- Primary purpose is portfolio evidence for a move toward AI work; daily personal use
  is the secondary goal that keeps it honest.
- Wants active pushback, not deference.
- **The Q20 sequence is sized so each step ends with something pointable.** Steps are an *order*, not a schedule —
  several will take two or three sessions, and the loader steps may take more.
- **Verified baseline, read from the backup file 2026-08-04: 1,070 words / 974 fetched /
  96 unfetched / 95 progress records / 971 Study Due / 974 Study All / 10 sources.**
  Supersedes "~1,071". These are the numbers verification tests against. The three chip
  counts were also read by hand off LEXICON LIVE and agree with the file.
  **Re-proven by machine 2026-08-08** — the step-5 loader read the file and reported
  1,070 / 974 / 96 / 95 with every field-coverage and structural count matching. See
  "Step 5 — the run of record" in `decisions.md`.
  **Re-proven a third time 2026-08-11, over HTTP** — `GET /api/words` returned 1,070
  objects, 974 of them carrying `definitions`. See "Step 7a — the run of record" in `decisions.md`.
- **v3.1 is frozen in data as well as code (see `decisions.md`).** The baseline cannot drift,
  so the verification numbers above stay hard-coded rather than read at run time.
- **`lexicon-backup-2026-08-03-b.json` (2,037,770 bytes) is the artifact of record**, in
  Dropbox at `/AI/Projects/Lexicon/backups/` and in Notion. Contents verified field by
  field 2026-08-04. A second, earlier file `lexicon-backup-2026-08-03.json` (1,302,925
  bytes) sits in the same folder and is **not** the file to load — the loader takes an
  explicit path with no default, and 26a's corrections file is generated from the `-b`
  file. **The byte count is now machine-confirmed:** the loader prints it, and printed
  2,037,770 on 2026-08-08 and again on 2026-08-11.

### Tooling division (REVISED 2026-10-26 — supersedes the 2026-08-05 settlement)

**Why it changed:** the chat/Claude Code split, with the Map living in Notion, made every
step slow (7b ran 2026-08-11 → 08-22, and a full day went to Notion corrupting the Map).
Jonathan adopted the revised method on 2026-10-26 to speed the build and to run several
workstreams in parallel.

- **`map.md` in the repo is the only authoritative copy.** It has been tracked in git
  since `3b4188e` (2026-08-22). **Notion is retired for the Map** — its copy is stale as of
  2026-08-22 and is not reconciled. **Edits are made in place and reviewed as a git
  diff**, which replaces the old wholesale-replacement rule (that rule existed only
  because Notion had no diff). Still true: **never edit the Map through the Notion API.**
- **The planning session (a Claude session linked to Jonathan's computer) does planning
  and review.** It reads the repo directly, talks decisions through with Jonathan, writes
  them into `map.md`, writes `handoff.md` for each step, and checks finished work against
  the files and the git diff — not against the build session's summary. It also
  coordinates parallel sessions, including across projects.
- **Claude Code does the building.** One session per step, in its own git worktree when
  steps run in parallel. **Runs in auto-accept mode.** It writes code, runs `npm`, runs the
  dev servers, iterates, and commits. The planning session cannot stand in for this: its
  shell on Jonathan's computer is a separate Linux environment with a few minutes per
  command, so it cannot run the Windows toolchain, hold a server up, or look at the app in
  a browser.
- **Decisions inside a step.** Claude Code may settle small decisions itself and must list
  each one in its report, with the honest cost; the planning session ratifies or reverses
  them. **It stops and asks only for architecture, cost, or anything that becomes
  public** (the repo, a URL, a pushed commit).
- **Review is graded by risk.** Full independent re-checking stays for steps 16 (spends
  the Anthropic key) and 17 (cutover). Other steps get a lighter review of the diff.
- **Neither half substitutes for Jonathan's own run.** A session report is a summary
  written by the thing being checked; the terminal paste is the evidence. **When direct
  observation conflicts with inference, observation wins.**
- **Label code blocks as commands or file contents.** Say which, every time.

### A QUEUED FIX MUST QUOTE THE LINE IT PROPOSES TO CHANGE (new 2026-08-11)

The step-6 handoff queued two report fixes. **Fix 2 — "print the `sslmode` actually
stripped, not a hardcoded one" — was already satisfied when it was queued.** `describeTls`
had never hardcoded anything; it reads the stripped value back out of the strip function.
The queued fix described a defect that did not exist.

This is the **third** time a claim about file contents entered the Map from a session
report rather than from the file: after Q18's `verify-full` amendment, after amendment 2's
guess at `migrate.ts`'s connection shape, and now this.

**The existing constraint — a Map line asserting file contents must say how it was
checked — catches these, but always one session late.** So it is tightened:

> **A queued fix must quote the line it proposes to change.** A fix that cannot quote its
> target has not looked at its target.

*Why this is the right shape:* it is a rule that cannot be followed without doing the
checking, rather than a rule that must be remembered — the same form as `.gitattributes`
over `core.autocrlf`, lowercase filenames, and wholesale Map replacement. **A rule that
cannot be broken beats a rule that must be remembered.**

**Cost accepted:** queueing a fix now requires opening the file, so a fix noticed in
passing cannot be jotted down for free.

### Standing constraints

- Cost discipline is a design principle: Jonathan's API key must not fund strangers.
- Build so a product remains possible later without a rewrite — user-scoped data from
  day one, per-account key storage, simple auth. Budget ~a day for this.
- Sandbox constraints that disappear on deployment: no confirm()/alert(), no programmatic
  downloads, per-artifact storage. Existing workarounds can be removed, not ported.
- Standing budget: ~$7/month, accepted. All of it is the always-on server. **The Q20
  sequence starts that meter at step 8**, some weeks before cutover.
  **PACE, CORRECTED 2026-08-09.** Steps 1 through 5 took about a week. **Nothing in this Map should quote a month figure, and no
  decision should be justified by "that is months away."**
- Escape hatch if the free database tier is outgrown: Neon's paid tier is usage-based
  with no monthly minimum, so the step up is gradual rather than a cliff.
- **A MAP LINE THAT ASSERTS WHAT A FILE CONTAINS MUST SAY HOW THAT WAS CHECKED.**
  Added 2026-08-09 after Q18's amendment 1 claimed for a full day that three connection
  strings said `verify-full` when they said `require`, with a test result attached.
  **Now tightened by the queued-fix rule above** — see "A queued fix must quote the line it
  proposes to change."
  *Follow-on, still not done:* **a sweep of every "done" claim against the actual repo**,
  a cheap Claude Code task. **Step 7a's session did a
  partial sweep by accident** and found one (queued fix 2). The full sweep still owes.
- **NOTHING IN THIS PROJECT QUERIES THE DATABASE ON A SCHEDULE (Q21a).** No DB-touching
  health check, no uptime pinger, no cron, no polling `fetch` in the client. One query every
  five minutes or less is a compute that never sleeps, and the free tier gone around day
  seventeen with no error printed anywhere. Applies to every step from 7a onward.
- Prices and free-tier terms verified 2026-08-03; Neon re-verified 2026-08-09. **Render
  re-checked 2026-10-28 against Render's own pages: matches decision 6.**
- **Express 5's `app.listen` callback receives errors** (found at step 8): a port in use
  printed `listening` and exited 0. Any future `listen` call must check its argument.
- **On Render, production starts with `node server/src/index.ts`, never `npm start`**:
  through npm the shutdown signal never reached the server (step 8, decision 12).
- Question numbers are stable. Resolved items leave the frontier; survivors keep their
  numbers so cross-references hold across sessions.

## Open questions (the frontier)

**Leg 1 — deployed, single-user**

22. **[urgent at step 17; now slightly more pressing]** Backups and restore for the hosted
    database. Free-tier restore history is limited, and the current safety net (JSON exports
    in Notion) is manual. **The JSON export ceases to be a current backup the moment cutover
    happens.** Also decides whether ids are durable post-cutover. The export has already
    outgrown a Notion code block (~2 MB). **Q28's no-down-migrations decision makes
    restore-from-backup one of only two recovery paths.** [interacts with: 5, 28]

23. Custom domain — whether, what name, and when. **Resolved "not yet" at step 8:**
    shipped on the free `inkhorn-jxxu.onrender.com` subdomain. Buy a domain (~$12/yr)
    before the URL goes anywhere professional. The name is settled (Inkhorn); **check
    trademark and domain availability first**, and consider a project contact address
    (`hello@…`) for the README when it's bought.

25. Homographs. v3.1 cannot hold minute (n.) and minute (adj.) as separate entries —
    `definitions[]` holds multiple senses fine, but pronunciation and part_of_speech are
    single-valued. Also a pedagogy question: two entries means two cards and two independent
    SM-2 schedules. Not solved in leg one; the schema must not foreclose it.
    **Adjacent: case-distinguishing pairs (Byzantine/byzantine) are the same shape of
    problem.** [interacts with: 24]

29. **[step 14]** The four SM-2 rating tier labels — **a design choice, not an unknown.**
    **Confirmed from `lexicon-v3.jsx` (2026-08-05).** `RATING_LABELS`: No idea (quality 1,
    "Complete blank") / Struggled (3, "Recalled with effort") / Got it (4, "Solid recall") /
    Knew it (5, "Instant"). **Note the quality mapping skips 2.** **Open only as: keep them,
    or choose fresh.** Lean keep. The governing constraint stands either way: the tiers must
    not let a half-remembered word count as known.

**Leg 2 — accounts**

8. Auth provider and data model. UNBLOCKED. Constrained to stay simple: **email link, not
   passwords** — nothing to hash, reset, or leak; it is why `users` has `email` and no
   `password_hash`. The real work is session handling and making every query filter by the
   logged-in user. `DEFAULT_USER_ID` is deleted, not worked around — **and Q18 made it
   greppable.** **The Basic Auth gate (20d) is deleted here too.** Budget ~a day.
   **`server/scripts/verify.ts` filters by no user (step 10)** — e.g.
   `'SELECT dictionaries, usage_guides FROM user_settings'` reads every row. Once a second
   user exists, checks 1 and 6 fail (they do not falsely pass). Scope verify here.
   [interacts with: 24i, 20d, 18]

9. Cost control. Constrained toward BYOK with per-account key storage. The key lands on
   `user_settings` (24g) and will need encryption at rest.

10. What a new user sees on first load — empty library or seeded starter set? **Also the
    sources default: do new users inherit Jonathan's ten, or start empty?** Schema is
    identical either way; purely a product choice.

**Leg 3 — capture loop**

11. iOS capture path: Shortcut → Lexicon's own endpoint, or → Notion as inbox? UNBLOCKED.
12. Ingestion trigger: poll, push, or a manual "check inbox" action?
13. Captured word behaviour: fetch its definition immediately, or queue it unfetched?
14. Does a captured word carry the sentence it appeared in? Editorially valuable;
    iOS won't hand it over for free.

**Cross-cutting**

15. What is the finish line for the whole effort — what has to be true for this to be
    showable, and what is explicitly *not* required. **Deliberately deferred until after
    leg one.** Portfolio pieces die from open-ended polish, so this does not get deferred
    twice.

## Q20 — build order for leg one (RESOLVED)

**20a. Route — database-first, in vertical slices.** A *vertical slice* is one thin path
through every layer at once — Postgres → `pg` → Express → `fetch` → React — completed
before any layer is finished, then widened. The original anti-stall plan (port the UI
against the JSON export first) is **rejected**: it does not stay small; it defers the
unfamiliar part, which is the portfolio evidence; and **a file-backed layer cannot exercise
SM-2**, a multi-day algorithm whose state would die at every restart.
The anti-stall property survives, restated: *a long stretch with nothing running is a long
stretch with nothing tested.*

**20b. The sequence.**

1. ~~**Repo and guardrails.**~~ **DONE 2026-08-06.** Commit `0b0b6f8`, pushed public.
2. ~~**The 26a proposal script.**~~ **DONE 2026-08-06.** → *45 proposals in
   `data/capitalizations.json`, dossier in `data/capitalization-review.md`.* Hand review
   runs in the background; **all 45 still unreviewed as of 2026-08-11**; finish before
   step 17.
3. ~~**24k and Q27.**~~ **DONE 2026-08-05.**
4. ~~**Q18, then Neon, then schema + migration runner.**~~ **DONE 2026-08-08.**
   Commits `882e985`, `3dee034`. → *four application tables plus `schema_migrations` in a
   real cloud Postgres.*
5. ~~**Loader, part one — read and validate.**~~ **DONE 2026-08-08.** PASS, 0/0, in
   Jonathan's own terminal. Commits `051cb94`, `19b2b34`, `a60c642`, pushed.
6. ~~**Loader, part two — words.**~~ **DONE 2026-08-09.** Transaction, `TRUNCATE`, user,
   settings, 1,070 words verbatim. `--dry-run` landed here. Q18's amendments 2 and 3 landed
   here — `db-config.ts`, `migrate.ts` refactored onto it, the wrong-CA test. **Verified
   from Neon's SQL Editor: 1,070 / 1 / 1 / 0 / 1.** Commits `9966b81`, `725636e`, **pushed.**
7. **a. ~~The wire, server side.~~ ✅ DONE 2026-08-11.** Express + `pg` pool (21c's values,
   `createPool` shape ratified) + `GET /api/words`, counted at 1,070 / 974. The Q28 boot
   hook fires before `app.listen`, observed in the output ordering. The pool inherits
   `db-config.ts`. `formatDatabaseError` extracted at its third caller. **21d closed by
   `pg_stat_activity` rather than by the seven-minute check, which could not have worked.**
   Commits `65df801`, `f0103a5`, `813ceac`, `403a12e`, pushed. Full record in `decisions.md`.
   → *1,070 records as JSON from a real database.*

   **b. ~~The wire, client side.~~ ✅ DONE 2026-08-22.** Vite + React + one `fetch` + an
   unstyled `<ul>`, **1,070 `<li>` counted in the DOM.** Q19's lowercase-filename
   convention met React's capitalized-component convention and **the filename convention
   won** — `app.tsx` holds `App`, and the repo reads slightly off-convention to a React
   reader. **Q31's single-manifest cost landed**, and forced `npm run dev` to split into
   `dev:server` and `dev:client`. **21a is live and holds** — no `setInterval` in any code
   that runs. **All three carried items closed:** `.env.example`'s `sslmode` note (Q18
   amendment 3), `engines` → `>=24.2.0`, `id`-as-React-key confined to the render.
   Commit `1684f46`. Full record in `decisions.md`.
   → *1,070 words in a browser, ugly, coming out of Postgres.*

8. **~~Render, and the first deploy.~~ ✅ DONE 2026-10-29.** Live at
   https://inkhorn-jxxu.onrender.com, behind Basic Auth; 1,070 counted in the browser;
   shutdown handler verified; `dev` idle confirmed. Commits `c5d42ea`..`dd96ab0`, pushed.
   **CU-hours reading due 2026-11-05 (reminder set).** Full record in `decisions.md`.
   *As planned:* Signup (re-check pricing),
   connect repo, `DATABASE_URL` → the **dev** branch, deploy. **Q21's two step-8
   obligations: leave Render's health check on the DEFAULT TCP probe (21a), and run 21d's
   ten-minute idle check afterward.** Q23 resolves as "not yet." Basic Auth (20d) may land
   here.
   **Also at step 8:** the real README, **the Inkhorn rename (Q30, resolved
   2026-10-26)**, the `noreply` commit email, **and the SIGTERM handler's
   three obligations (see step 7a).**
   **Also confirm Render's pre-deploy command exists** — not needed under Q28's Option A,
   but worth knowing before it is ever wanted.
   *Why this early:* Q19's failures are deploy-time-only and cannot reproduce on Windows.
9. **~~Loader, part three — progress.~~ ✅ DONE 2026-10-27.** 95 records, case-insensitive
   matching, `nextReview` → `timestamptz`, `last_rated` derived, orphan check. Built in a
   parallel worktree while step 8 waited, the first step under the revised method.
   **Verified from Neon's SQL Editor on `dev`: 1,070 / 1 / 1 / 95 / 1**, and three rows
   checked against the backup file by the planning session. Commit `b85372c`, pushed.
   Full record in `decisions.md`.
   → *the library and its study history in Postgres.*
10. **~~Verification.~~ ✅ DONE 2026-10-31. The gate passed:** seven PASSes under
    `--strict` against `dev`, 0 warnings, in Jonathan's terminal; the loader's dry run
    PASS, 0 failures, 0 warnings. **`server/scripts/verify.ts` is its own file and imports
    nothing from the loader** (reverses 5f's "same script"). Read-only is enforced by
    Postgres and proven on every run. Check 5's window is fixed, [2026-01-01, 2028-01-01)
    UTC; check 7 is 971 as of 2026-08-04 plus file = Postgres now. All three carried items
    closed. Eight decisions, all Jonathan's or ratified by him. Commits `3527bd2`,
    `1c2270f`, pushed. Full record in `decisions.md`.
    → *seven PASSes.*
11. **The cutover acceptance checklist** (Q15a), written now — before the UI exists.
    **Written with the planning session.** **Must include: read the stray-key report lines, and the progress plan's
    case-insensitive matches** (nonzero once 26a's capitals land; a report line, never a
    warning, so only the checklist makes someone read it).
    **Also, from step 10:** name both commands, the loader then verify, each with
    `--strict` (separate programs since step 10). **Verify's check 7 "now" line reads 972,
    not 971, from 2026-11-17 15:23 UTC** (`accede` falls due) — correct, not a failure;
    the 971 sub-check is the as-of line.
12. **Inventory pass on `lexicon-v3.jsx`.** *(Partially pre-empted 2026-08-05.)*
13. **Slice — library.** Search, word detail with all seven fields, dark/amber/Georgia
    styling ported. **The pool's second consumer arrives here — 21c's cost lands now.**
14. **Slice — flashcards.** SM-2 scheduling, the four rating tiers (**Q29**), session
    length 10/20/30/All. Highest-risk port.
15. **Slice — quizzes.** All three modes, fill-in-the-blank targeting repetitions 2–4, the
    80/20 weighting. **Spot-check the four `example`-only words.**
16. **Slice — fetch, add a word, export.** Anthropic key on the server, prompt revised for
    canonical orthography. **Basic Auth (20d) required before this ships — landed at step 8.**
17. **Cutover.** Migrations against `main`, load with typed confirmation, `verify --strict`
    (its own command since step 10; its typed phrase is `verify main`),
    *then* flip Render's `DATABASE_URL`, then walk the acceptance checklist by hand.
    Q22 becomes urgent the moment this completes.

**20c. Session sizing** — each step ends with something pointable. Steps are an order, not
a schedule.

**20d. Temporary access gate.** From step 8 the app is on a guessable public URL with no
auth until leg two. Steps 8–15 are harmless, but step 16 adds an endpoint that **spends
Jonathan's Anthropic key.** Fix: HTTP Basic Auth middleware, one env var, ~15 lines.
**Required before step 16 ships; free to add at step 8.** **LANDED at step 8 (`e088dd1`):**
two env vars, no new dependency, refuses to start in production without them.

**20e. What was placed but not answered.** ~~Q7/Q16/Q19 → step 1~~ **(done)**.
~~24k/Q27 → step 3~~ **(done)**. ~~Q18 → step 4~~ **(done)**. ~~Q28 → step 4~~ **(done)**.
~~Q31 → step 4~~ **(done)**. ~~Q21 → precondition of step 8~~ **(done 2026-08-09; closed
completely 2026-08-11)**.
~~Q32 → step 8~~ **(done: the deploy was the check)**. ~~Q23 → step 8~~ **("not yet")**.
Q22 → urgent at step 17.

## Not yet specified (fog)

- **Near-synonym discrimination — the successor to `confusables` (post-cutover).** The
  fetch prompt already asks `usage_note` for *"distinctions from near-synonyms."* The open
  question is: **should near-synonym discrimination be pulled out of `usage_note` into its
  own structured field — pairs of *word plus how it differs* — or strengthened where it
  is?** Prose reads better; structure is quizzable, and could feed a fourth quiz mode a
  paragraph never could. *specious / spurious / sophistic / plausible* is the worked
  example. Would need a schema change and a backfill across 974 words. **Under Q28 that is
  a `002` migration plus a data-moving migration, which is exactly the case the tracking
  table exists for.**
- Whether v3.1 in-artifact survives as a personal tool after cutover, or is retired.
  **Leaning retired — the data freeze already retired it in practice.**
- Mobile UX past "works": PWA install, offline study, gestures.
- Whether the sources-editing UI ports forward. Below the parity line, so post-cutover.
  **v3.1's version maps directly onto 24k's two columns.**
- Whether Jonathan wants to know if anyone actually uses it (analytics).
- Aggregate value of other people's words — shared decks, frequency data. Far off.
- Curation backlog, post-cutover: `epi-` and `ur-` are prefixes rather than words; other
  junk entries likely exist. Deleting them is safe once the standalone owns the data.
- Existing backlog: Dictionary.com import, bulk ops, study stats, quiz refinements.
  **Study stats are unblocked by 24e.** Honest ceiling: only 95 words have ever been rated.
- **The fetch prompt's revision for canonical orthography (step 16) is specified in purpose
  but not in wording.** **The current prompt is on record** — two labelled source lines,
  seven requested fields, JSON-only response.
- Whether the SIGTERM handler should also catch SIGINT. Surfaced 2026-08-11; a design
  question, not a bug.

## Out of scope

- In-artifact MCP ingestion. Possible, ruled out: fragile, single-user, no portfolio value.
- Native iOS app. A Shortcut plus a PWA covers capture; an app is a different project.
- Rewriting SM-2 logic, quiz design, or the source-steering prompt. Settled and good —
  they port as-is. **Caveat: the prompt does get one revision (orthography).**
- Running Lexicon as a business. Door left open architecturally; not pursued.
- **Switching package managers.** Q32 notes npm's phantom-dependency hole widened at step
  7a; the answer is not pnpm mid-build. Q16's reasoning stands.