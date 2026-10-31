/**
 * verify.ts — the gate (Q5f, step 10).
 *
 * WHAT THIS IS FOR
 * ----------------
 * The loader says what it wrote. This program checks it from outside: it reads
 * the backup file again, asks Postgres what it actually holds, and runs Q5f's
 * seven checks between the two. Seven PASSes is the gate before cutover.
 *
 * HOW TO RUN IT
 * -------------
 *   node --env-file=.env server/scripts/verify.ts \
 *        <path-to-backup.json> --target dev|main [--strict]
 *
 * --target has the loader's rules: no default, no fallback, never DATABASE_URL,
 * and `main` asks for a typed confirmation. --strict turns warnings into
 * failures. There is no --dry-run, because there is nothing to dry-run: this
 * program cannot write.
 *
 * WHY A SEPARATE FILE (decided 2026-10-31, reversing 5f's "same script")
 * ----------------------------------------------------------------------
 * 5f requires that verification share no state with the loader and re-implement
 * its transformations rather than import them: a bug in a shared copy would be
 * made on both sides of the comparison and pass. In a file of its own that is
 * provable by one look at the imports below. Nothing comes from import-json.ts.
 * The two modules it does import are plumbing, not transformations:
 *
 *   db-config.ts               how to open a TLS connection
 *   format-database-error.ts   how to print a Postgres error
 *
 * So the frozen baseline, the 26a rule, Q27's five rules and the last_rated rule
 * are all written out again here, deliberately. If one of them changes in the
 * loader it must change here too, by hand, and that is the point.
 *
 * Cost of the separate file: the loader no longer ends with verify (5d step 8,
 * "summary, then verify"). They are two commands, and step 17's checklist has to
 * name both.
 *
 * READ-ONLY, ENFORCED BY POSTGRES
 * -------------------------------
 * Every query runs inside one transaction opened as
 *
 *   BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY
 *
 * READ ONLY makes Postgres refuse any write for the life of the transaction.
 * REPEATABLE READ makes every query see the same snapshot, so the seven checks
 * describe one moment of the database rather than seven. The transaction is
 * rolled back at the end, never committed. Two checks before any reading:
 * `SHOW transaction_read_only` must say `on`, and a write is attempted — an
 * UPDATE that matches no rows — and must be refused. A run that cannot prove
 * it is read-only stops.
 */

import { readFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import type { Client as PgClient } from 'pg';
import { buildConnectionConfig, describeTarget, describeTls } from '../src/db-config.ts';
import { formatDatabaseError } from '../src/format-database-error.ts';
import type { PostgresErrorFields } from '../src/format-database-error.ts';

const { Client } = pg;

/** The repo root, found from this file rather than from the current directory. */
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 26a's decisions file. Read here independently; only `accepted` entries apply. */
const CORRECTIONS_PATH = path.join(REPO_ROOT, 'data', 'capitalizations.json');

/** As in the loader: --target selects one of these, and DATABASE_URL is absent. */
const TARGET_VARIABLES = {
  dev: 'DATABASE_URL_DEV',
  main: 'DATABASE_URL_MAIN',
} as const;

type Target = keyof typeof TARGET_VARIABLES;

/**
 * Not the loader's `load main`. Verify is read-only, but a phrase typed from
 * muscle memory should not carry over from one program to the other.
 */
const MAIN_CONFIRMATION = 'verify main';

// ---------------------------------------------------------------------------
// The frozen baseline, written out again rather than imported. Read from
// lexicon-backup-2026-08-03-b.json on 2026-08-04; v3.1 is frozen in data as well
// as code, so these are facts and they stay hard-coded.
// ---------------------------------------------------------------------------
const BASELINE = {
  words: 1070,
  fetched: 974,
  unfetched: 96,
  progress: 95,
  dictionaries: 4,
  usageGuides: 6,
  studyDue: 971,
} as const;

/**
 * Check 7's moment (decided 2026-10-31). 971 was read off the artifact on
 * 2026-08-04, and it is only true for a window: from 2026-05-17 04:08 UTC until
 * 2026-11-17 15:23 UTC, when `accede` falls due and the count becomes 972. A
 * hard-coded 971 counted at "now" would fail on correct data from that day on.
 * So 971 is counted as of the day it was read, and "now" is a second sub-check
 * with no number in it: file and database must agree with each other.
 */
const STUDY_DUE_AS_OF = '2026-08-04T00:00:00.000Z';

/**
 * Check 5's window (decided 2026-10-31): fixed, and blind to today's date.
 * The data is frozen, so it does not age, so the window should not move with the
 * calendar. The frozen span is 2026-03-01 to 2027-08-07. The faults a sanity
 * check exists for — a missing value read as 1970, seconds taken for
 * milliseconds, a misparsed year — land decades outside, not months.
 *
 * DO NOT make this relative to today. "One year either side of today" fails on
 * the earliest value from March 2027, and even one year either side of the
 * export date fails on the latest, which is four days past it.
 *
 * `from` is inclusive and `until` exclusive. A time-zone shift is NOT caught
 * here; check 3's per-row comparison catches that.
 */
const NEXT_REVIEW_WINDOW = {
  from: '2026-01-01T00:00:00.000Z',
  until: '2028-01-01T00:00:00.000Z',
} as const;

/** The eight columns of `words` that come from the file, in schema order. */
const WORD_COLUMNS = [
  'word',
  'part_of_speech',
  'pronunciation',
  'definitions',
  'etymology',
  'usage_note',
  'examples',
  'mnemonics',
] as const;

type WordColumn = (typeof WORD_COLUMNS)[number];

/** Columns holding text[]; the rest hold text. */
const ARRAY_COLUMNS: ReadonlySet<WordColumn> = new Set(['definitions', 'examples']);

/**
 * Every key a word may carry: the eight columns and Q27's five strays. Verify
 * only knows how to predict a row from these. A thirteenth key is a warning,
 * because the prediction would silently ignore it.
 */
const KNOWN_WORD_KEYS = new Set<string>([
  ...WORD_COLUMNS,
  'example',
  'confusables',
  'etymology_note',
  'pronunciation_note',
  'definitons',
]);

const TOP_LEVEL_KEYS = new Set(['words', 'progress', 'sources']);
const PROGRESS_KEYS = new Set(['ease', 'repetition', 'nextReview']);

// ---------------------------------------------------------------------------
// Check 4's three words, chosen adversarially (5f), each with the test that it
// still deserves its place. The file is frozen, so on the file of record these
// always hold; on any other file a failed qualification is itself a finding.
// ---------------------------------------------------------------------------

interface SpotCheck {
  readonly word: string;
  readonly why: string;
  readonly qualifies: (record: FileWord, all: readonly FileWord[]) => boolean;
}

const usageNoteLength = (record: FileWord): number =>
  typeof record['usage_note'] === 'string' ? record['usage_note'].length : 0;

const SPOT_CHECKS: readonly SpotCheck[] = [
  {
    word: 'moribund',
    why: 'the longest usage note in the file',
    qualifies: (record, all) =>
      all.every((other) => other === record || usageNoteLength(other) < usageNoteLength(record)),
  },
  {
    // One of the four `example`-only words, so Q27's fallback rule is exercised
    // (5f): aver, audacious, avoirdupois, aureole. audacious also carries the
    // em dash and the quotation marks, and an IPA pronunciation besides.
    word: 'audacious',
    why: '`example` only (Q27 fallback); em dash and quotation marks in the usage note',
    qualifies: (record) => {
      const note = record['usage_note'];
      return (
        typeof record['example'] === 'string' &&
        record['examples'] === undefined &&
        typeof note === 'string' &&
        note.includes('—') &&
        /["'‘’“”]/.test(note)
      );
    },
  },
  {
    word: 'imperious',
    why: 'three definitions',
    qualifies: (record) => Array.isArray(record['definitions']) && record['definitions'].length === 3,
  },
];

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** One word as the file has it. Nothing is trusted until it has been read. */
interface FileWord {
  readonly [key: string]: unknown;
}

interface BackupFile {
  readonly words: readonly FileWord[];
  readonly progress: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly sources: Readonly<Record<string, unknown>>;
  readonly topLevelKeys: readonly string[];
  readonly bytes: number;
}

/** A row of `words` — what the file predicts, or what Postgres returned. */
type StoredWord = {
  readonly [column in WordColumn]: column extends 'definitions' | 'examples'
    ? readonly string[] | null
    : column extends 'word'
      ? string
      : string | null;
};

/** One progress record, as the file predicts it will be stored. */
interface ExpectedProgress {
  /** The key as written in the file. */
  readonly key: string;
  readonly ease: number;
  readonly repetition: number;
  /** Milliseconds since 1970, UTC. */
  readonly nextReview: number;
  /** Milliseconds since 1970, UTC — re-derived here (24e), not read from anywhere. */
  readonly lastRated: number;
}

/** What Q27's rules did, by word: report lines, so the re-derivation shows its work. */
interface Q27Tally {
  readonly examplePromoted: string[];
  readonly exampleSuperseded: string[];
  readonly etymologyNoteAppended: string[];
  readonly pronunciationNoteAppended: string[];
  readonly definitonsDiscarded: string[];
  readonly confusablesDiscarded: string[];
}

/** Everything the file predicts, built before a connection is opened. */
interface Expectations {
  /** lower(headword) -> the row Postgres should hold. */
  readonly words: ReadonlyMap<string, StoredWord>;
  /** lower(key) -> the progress row Postgres should hold. */
  readonly progress: ReadonlyMap<string, ExpectedProgress>;
  readonly dictionaries: readonly string[];
  readonly usageGuides: readonly string[];
  readonly tally: Q27Tally;
  readonly correctionsTotal: number;
  readonly correctionsAccepted: number;
  /** `word -> Word`, for the headwords 26a changed. */
  readonly capitalized: readonly string[];
}

/** What Postgres said, all of it read in one read-only snapshot. */
interface Snapshot {
  readonly wordCount: number;
  readonly fetched: number;
  readonly unfetched: number;
  readonly words: readonly StoredWord[];
  readonly progressCount: number;
  readonly progress: ReadonlyArray<{
    readonly word: string | null;
    readonly ease: number;
    readonly repetition: number;
    readonly next_review: Date;
    readonly last_rated: Date | null;
  }>;
  readonly earliest: Date | null;
  readonly latest: Date | null;
  readonly outsideWindow: number;
  readonly settings: ReadonlyArray<{
    readonly dictionaries: readonly string[];
    readonly usage_guides: readonly string[];
  }>;
  readonly dueAsOf: number;
  readonly dueNow: number;
  /** Postgres's own words for the refused write, shown as proof of read-only. */
  readonly refusedWrite: string;
}

/** The outcome of one of the seven checks. */
interface CheckResult {
  readonly number: number;
  readonly title: string;
  /** Printed whatever the outcome: what was compared. */
  readonly lines: readonly string[];
  /** Empty means PASS. */
  readonly problems: readonly string[];
}

class Findings {
  readonly failures: string[] = [];
  readonly warnings: string[] = [];

  fail(message: string): void {
    this.failures.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }
}

// ---------------------------------------------------------------------------
// Formatting. Output is ASCII only: Windows PowerShell 5.1 reads it through the
// legacy codepage, and these runs get pasted into chat as evidence.
// ---------------------------------------------------------------------------

const n = (value: number): string => value.toLocaleString('en-US');

function count(value: number, noun: string, plural = `${noun}s`): string {
  return `${n(value)} ${value === 1 ? noun : plural}`;
}

function series(items: readonly string[], limit = 8): string {
  const shown = items.slice(0, limit);
  const tail = items.length > limit ? `, and ${n(items.length - limit)} more` : '';
  if (shown.length <= 1) return (shown[0] ?? '') + tail;
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}${tail}`;
}

const iso = (ms: number): string => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// Reading the file — verify's own reader. It shares nothing with the loader's.
// ---------------------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readBackup(sourcePath: string): BackupFile {
  let bytes: number;
  try {
    bytes = statSync(sourcePath).size;
  } catch {
    console.error(`\nNo such file: ${sourcePath}\n`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(sourcePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nThat file is not valid JSON: ${message}\n`);
    process.exit(1);
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed['words'])) {
    console.error('\nNo object with a `words` array. That is not a Lexicon backup.\n');
    process.exit(1);
  }
  if (!isPlainObject(parsed['progress']) || !isPlainObject(parsed['sources'])) {
    console.error('\nThe file has no `progress` object or no `sources` object.\n');
    process.exit(1);
  }

  return {
    words: parsed['words'] as FileWord[],
    progress: parsed['progress'] as Record<string, Record<string, unknown>>,
    sources: parsed['sources'],
    topLevelKeys: Object.keys(parsed),
    bytes,
  };
}

/** 26a: lower(word) -> capitalization, for `accepted` entries only. */
function readAcceptedCorrections(findings: Findings): { accepted: Map<string, string>; total: number } {
  const accepted = new Map<string, string>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(CORRECTIONS_PATH, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    findings.fail(`Could not read data/capitalizations.json: ${message}.`);
    return { accepted, total: 0 };
  }

  const entries = isPlainObject(parsed) ? parsed['corrections'] : undefined;
  if (!isPlainObject(entries)) {
    findings.fail('data/capitalizations.json has no `corrections` object.');
    return { accepted, total: 0 };
  }

  for (const [key, entry] of Object.entries(entries)) {
    if (!isPlainObject(entry) || entry['status'] !== 'accepted') continue;

    const capitalization = entry['capitalization'];
    // A correction changes case and nothing else. The loader refuses any other,
    // so verify cannot predict what an invalid one would have done: a failure.
    if (typeof capitalization !== 'string' || capitalization.toLowerCase() !== key.toLowerCase()) {
      findings.fail(
        `Correction \`${key}\` is accepted but its capitalization is not the same word in ` +
          'another case. The loader would have refused it.',
      );
      continue;
    }
    accepted.set(key.toLowerCase(), capitalization);
  }

  return { accepted, total: Object.keys(entries).length };
}

/** text: absent -> NULL; a string -> itself; anything else is unpredictable. */
function text(record: FileWord, field: string, word: string, findings: Findings): string | null {
  const value = record[field];
  if (value === undefined) return null;
  if (typeof value === 'string') return value;
  findings.fail(`\`${field}\` on ${word} is not a string, so verify cannot say what was stored.`);
  return null;
}

/** text[]: absent -> NULL; an array of strings -> itself; anything else is unpredictable. */
function textList(
  record: FileWord,
  field: string,
  word: string,
  findings: Findings,
): readonly string[] | null {
  const value = record[field];
  if (value === undefined) return null;
  if (Array.isArray(value) && value.every((element) => typeof element === 'string')) {
    return value as string[];
  }
  findings.fail(`\`${field}\` on ${word} is not an array of strings.`);
  return null;
}

/** SM-2's interval in days, as v3.1 has it (reference/lexicon-v3.jsx, getInterval). */
function intervalDays(ease: number, repetition: number): number {
  if (repetition === 0) return 0;
  if (repetition === 1) return 1;
  if (repetition === 2) return 3;
  return Math.round(intervalDays(ease, repetition - 1) * ease);
}

/**
 * Everything the file predicts Postgres holds, from verify's own copies of the
 * rules. Each rule is stated as decided, not as the loader happens to code it.
 */
function buildExpectations(backup: BackupFile, findings: Findings): Expectations {
  const { accepted, total } = readAcceptedCorrections(findings);
  const words = new Map<string, StoredWord>();
  const capitalized: string[] = [];
  const tally: Q27Tally = {
    examplePromoted: [],
    exampleSuperseded: [],
    etymologyNoteAppended: [],
    pronunciationNoteAppended: [],
    definitonsDiscarded: [],
    confusablesDiscarded: [],
  };
  const unknownKeys = new Map<string, string[]>();

  for (const record of backup.words) {
    const original = record['word'];
    if (typeof original !== 'string') {
      findings.fail('A record in `words` has no string `word`.');
      continue;
    }

    for (const key of Object.keys(record)) {
      if (KNOWN_WORD_KEYS.has(key)) continue;
      unknownKeys.set(key, [...(unknownKeys.get(key) ?? []), original]);
    }

    // 26a: headwords are stored verbatim, except where an accepted correction
    // supplies the capitals.
    const word = accepted.get(original.toLowerCase()) ?? original;
    if (word !== original) capitalized.push(`${original} -> ${word}`);

    // Q27, `example`: use `examples`; if it is absent or empty, use the singular
    // `example`. A fallback, never a merge.
    let examples = textList(record, 'examples', word, findings);
    const example = text(record, 'example', word, findings);
    if (example !== null) {
      if (examples !== null && examples.length > 0) {
        tally.exampleSuperseded.push(word);
      } else {
        examples = [example];
        tally.examplePromoted.push(word);
      }
    }

    // Q27, the two notes: appended to the field they annotate, after a blank line.
    let etymology = text(record, 'etymology', word, findings);
    const etymologyNote = text(record, 'etymology_note', word, findings);
    if (etymologyNote !== null) {
      etymology = etymology === null ? etymologyNote : `${etymology}\n\n${etymologyNote}`;
      tally.etymologyNoteAppended.push(word);
    }

    let pronunciation = text(record, 'pronunciation', word, findings);
    const pronunciationNote = text(record, 'pronunciation_note', word, findings);
    if (pronunciationNote !== null) {
      pronunciation =
        pronunciation === null ? pronunciationNote : `${pronunciation}\n\n${pronunciationNote}`;
      tally.pronunciationNoteAppended.push(word);
    }

    // Q27, the two discards: nothing stored, but counted.
    if (record['definitons'] !== undefined) tally.definitonsDiscarded.push(word);
    if (record['confusables'] !== undefined) tally.confusablesDiscarded.push(word);

    if (words.has(word.toLowerCase())) {
      findings.fail(`Two headwords collide case-insensitively on \`${word}\`.`);
    }
    words.set(word.toLowerCase(), {
      word,
      part_of_speech: text(record, 'part_of_speech', word, findings),
      pronunciation,
      definitions: textList(record, 'definitions', word, findings),
      etymology,
      usage_note: text(record, 'usage_note', word, findings),
      examples,
      mnemonics: text(record, 'mnemonics', word, findings),
    });
  }

  for (const [key, carriers] of [...unknownKeys].sort()) {
    findings.warn(
      `Unrecognised word key \`${key}\` on ${count(carriers.length, 'word')}: ${series(carriers)}. ` +
        'Verify has no rule for it, so its prediction of those rows ignores it.',
    );
  }
  const strayTopLevel = backup.topLevelKeys.filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (strayTopLevel.length > 0) {
    findings.warn(`Top-level keys beyond words, progress and sources: ${series(strayTopLevel)}.`);
  }

  // --- progress, with last_rated re-derived (24e; Step 9, decision 1) ---------
  // last_rated = next_review - getInterval(ease, repetition) x 24 hours, in UTC.
  // Plain millisecond arithmetic: no calendar, no local time zone.
  const progress = new Map<string, ExpectedProgress>();

  for (const [key, record] of Object.entries(backup.progress)) {
    const { ease, repetition, nextReview } = record;
    const moment = typeof nextReview === 'string' ? Date.parse(nextReview) : Number.NaN;

    if (
      typeof ease !== 'number' ||
      !Number.isFinite(ease) ||
      typeof repetition !== 'number' ||
      !Number.isInteger(repetition) ||
      repetition < 0 ||
      Number.isNaN(moment)
    ) {
      findings.fail(`Progress record \`${key}\` is malformed, so verify cannot predict its row.`);
      continue;
    }

    for (const field of Object.keys(record)) {
      if (!PROGRESS_KEYS.has(field)) {
        findings.warn(`Unrecognised key \`${field}\` inside the progress record for \`${key}\`.`);
      }
    }

    progress.set(key.toLowerCase(), {
      key,
      ease,
      repetition,
      nextReview: moment,
      lastRated: moment - intervalDays(ease, repetition) * 24 * 60 * 60 * 1000,
    });
  }

  const listOf = (field: string): readonly string[] => {
    const value = backup.sources[field];
    if (Array.isArray(value) && value.every((element) => typeof element === 'string')) {
      return value as string[];
    }
    findings.fail(`sources.${field} is not an array of strings.`);
    return [];
  };

  return {
    words,
    progress,
    // 24k: usageGuides -> usage_guides, order preserved.
    dictionaries: listOf('dictionaries'),
    usageGuides: listOf('usageGuides'),
    tally,
    correctionsTotal: total,
    correctionsAccepted: accepted.size,
    capitalized,
  };
}

// ---------------------------------------------------------------------------
// Reading the database — one read-only snapshot
// ---------------------------------------------------------------------------

/** Writes nothing even where writes are allowed; used only to prove they are not. */
const WRITE_PROBE = 'UPDATE words SET word = word WHERE false';

/** Postgres's code for "cannot execute ... in a read-only transaction". */
const READ_ONLY_VIOLATION = '25006';

/** Fetched and due, as v3.1 defines it: no progress record, or next_review at or before the moment. */
const STUDY_DUE_SQL = `
  SELECT count(*)::int AS due
  FROM words w
  LEFT JOIN progress p ON p.word_id = w.id
  WHERE w.definitions IS NOT NULL
    AND (p.word_id IS NULL OR p.next_review <= $1::timestamptz)`;

async function readSnapshot(client: PgClient, now: Date): Promise<Snapshot> {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

  const mode = await client.query<{ transaction_read_only: string }>('SHOW transaction_read_only');
  if (mode.rows[0]?.transaction_read_only !== 'on') {
    throw new Error('The transaction did not open read-only. Refusing to read anything.');
  }

  // The probe. Inside a savepoint, so the refusal does not end the transaction.
  await client.query('SAVEPOINT write_probe');
  let refusedWrite: string | null = null;
  try {
    await client.query(WRITE_PROBE);
  } catch (error) {
    if ((error as PostgresErrorFields).code !== READ_ONLY_VIOLATION) throw error;
    refusedWrite = (error as Error).message;
  }
  if (refusedWrite === null) {
    throw new Error('A write was accepted. This transaction is not read-only. Stopping.');
  }
  await client.query('ROLLBACK TO SAVEPOINT write_probe');

  // Counts are Postgres's own, from count(*), not the length of a JavaScript array.
  const counts = await client.query<{ words: number; fetched: number; unfetched: number; progress: number }>(`
    SELECT
      (SELECT count(*)::int FROM words) AS words,
      (SELECT count(*)::int FROM words WHERE definitions IS NOT NULL) AS fetched,
      (SELECT count(*)::int FROM words WHERE definitions IS NULL) AS unfetched,
      (SELECT count(*)::int FROM progress) AS progress`);

  const words = await client.query<StoredWord>(`SELECT ${WORD_COLUMNS.join(', ')} FROM words`);

  // ease is `real`. Cast to double precision so the exact stored value comes
  // back, not a shortened decimal rendering of it; check 3 compares at real's
  // precision.
  const progress = await client.query<Snapshot['progress'][number]>(`
    SELECT w.word, p.ease::float8 AS ease, p.repetition, p.next_review, p.last_rated
    FROM progress p
    LEFT JOIN words w ON w.id = p.word_id`);

  const span = await client.query<{ earliest: Date | null; latest: Date | null; outside: number }>(
    `SELECT min(next_review) AS earliest, max(next_review) AS latest,
            count(*) FILTER (WHERE next_review < $1::timestamptz
                                OR next_review >= $2::timestamptz)::int AS outside
     FROM progress`,
    [NEXT_REVIEW_WINDOW.from, NEXT_REVIEW_WINDOW.until],
  );

  const settings = await client.query<Snapshot['settings'][number]>(
    'SELECT dictionaries, usage_guides FROM user_settings',
  );

  const dueAsOf = await client.query<{ due: number }>(STUDY_DUE_SQL, [STUDY_DUE_AS_OF]);
  const dueNow = await client.query<{ due: number }>(STUDY_DUE_SQL, [now.toISOString()]);

  await client.query('ROLLBACK');

  const totals = counts.rows[0];
  const window = span.rows[0];
  return {
    wordCount: totals?.words ?? -1,
    fetched: totals?.fetched ?? -1,
    unfetched: totals?.unfetched ?? -1,
    words: words.rows,
    progressCount: totals?.progress ?? -1,
    progress: progress.rows,
    earliest: window?.earliest ?? null,
    latest: window?.latest ?? null,
    outsideWindow: window?.outside ?? -1,
    settings: settings.rows,
    dueAsOf: dueAsOf.rows[0]?.due ?? -1,
    dueNow: dueNow.rows[0]?.due ?? -1,
    refusedWrite,
  };
}

// ---------------------------------------------------------------------------
// The seven checks (5f)
// ---------------------------------------------------------------------------

/** `found 1,070 / 1,070 expected`, one side of a comparison. */
const side = (label: string, found: number, expected?: number): string =>
  `${label.padEnd(9)}${n(found).padStart(7)}` + (expected === undefined ? '' : `   expected ${n(expected)}`);

/** Check 1. Word count = 1,070, and the same headwords on both sides. */
function checkWordCount(backup: BackupFile, expected: Expectations, db: Snapshot): CheckResult {
  const problems: string[] = [];
  const fileCount = backup.words.length;

  if (fileCount !== BASELINE.words) problems.push(`The file holds ${n(fileCount)} words.`);
  if (db.wordCount !== BASELINE.words) problems.push(`Postgres holds ${n(db.wordCount)} words.`);

  // A count passes a swap, so the headwords themselves are compared too, as
  // stored: verbatim, with 26a's accepted capitals applied.
  const stored = new Set(db.words.map((row) => row.word));
  const predicted = new Set([...expected.words.values()].map((row) => row.word));
  const missing = [...predicted].filter((word) => !stored.has(word));
  const extra = [...stored].filter((word) => !predicted.has(word));
  if (missing.length > 0) problems.push(`In the file, not in Postgres: ${series(missing)}.`);
  if (extra.length > 0) problems.push(`In Postgres, not in the file: ${series(extra)}.`);

  return {
    number: 1,
    title: `Word count = ${n(BASELINE.words)}`,
    lines: [
      side('file', fileCount, BASELINE.words),
      side('Postgres', db.wordCount, BASELINE.words),
      'headwords compared as stored (verbatim, 26a applied): ' +
        (missing.length + extra.length === 0 ? 'the same on both sides' : 'they differ'),
    ],
    problems,
  };
}

/** Check 2. Fetched / unfetched = 974 / 96. Only `definitions` marks a word fetched. */
function checkSplit(backup: BackupFile, db: Snapshot): CheckResult {
  const problems: string[] = [];
  const fetched = backup.words.filter((record) => Array.isArray(record['definitions'])).length;
  const unfetched = backup.words.length - fetched;

  const pair = (a: number, b: number): string => `${n(a)} / ${n(b)}`;
  const want = pair(BASELINE.fetched, BASELINE.unfetched);

  if (fetched !== BASELINE.fetched || unfetched !== BASELINE.unfetched) {
    problems.push(`The file splits ${pair(fetched, unfetched)}, not ${want}.`);
  }
  if (db.fetched !== BASELINE.fetched || db.unfetched !== BASELINE.unfetched) {
    problems.push(`Postgres splits ${pair(db.fetched, db.unfetched)}, not ${want}.`);
  }

  return {
    number: 2,
    title: `Fetched / unfetched = ${want}`,
    lines: [
      `file     ${pair(fetched, unfetched).padStart(9)}   (a \`definitions\` array, or none)`,
      `Postgres ${pair(db.fetched, db.unfetched).padStart(9)}   (definitions IS NOT NULL, or NULL)`,
    ],
    problems,
  };
}

/**
 * Check 3. Progress = 95, every word_id resolving, and every row's values equal
 * to the file's record for the same word. A swap passes a count (carried from
 * step 9), so ease, repetition, next_review and last_rated are compared per row.
 */
function checkProgress(expected: Expectations, db: Snapshot): CheckResult {
  const problems: string[] = [];
  const fileCount = expected.progress.size;

  if (fileCount !== BASELINE.progress) problems.push(`The file holds ${n(fileCount)} progress records.`);
  if (db.progressCount !== BASELINE.progress) {
    problems.push(`Postgres holds ${n(db.progressCount)} progress rows.`);
  }

  // The file side of "resolving": every key names a word in the file (24h).
  const unresolvedInFile = [...expected.progress.keys()].filter((key) => !expected.words.has(key));
  if (unresolvedInFile.length > 0) {
    problems.push(`File progress records naming no word: ${series(unresolvedInFile)}.`);
  }

  const mismatches: string[] = [];
  const landed = new Set<string>();
  let unresolved = 0;

  for (const row of db.progress) {
    if (row.word === null) {
      unresolved += 1;
      continue;
    }
    const lower = row.word.toLowerCase();
    const record = expected.progress.get(lower);
    if (record === undefined) {
      mismatches.push(`${row.word}: a row in Postgres, no record in the file`);
      continue;
    }
    landed.add(lower);

    const differs = (field: string, stored: string, file: string): void => {
      if (stored !== file) mismatches.push(`${row.word}: ${field} is ${stored}, the file says ${file}`);
    };
    // `real` cannot hold 2.36 exactly. Math.fround rounds the file's value to
    // the nearest `real`, which is what Postgres stored if nothing went wrong.
    differs('ease', String(row.ease), String(Math.fround(record.ease)));
    differs('repetition', String(row.repetition), String(record.repetition));
    differs('next_review', row.next_review.toISOString(), iso(record.nextReview));
    differs(
      'last_rated',
      row.last_rated === null ? 'NULL' : row.last_rated.toISOString(),
      iso(record.lastRated),
    );
  }

  if (unresolved > 0) problems.push(`${count(unresolved, 'progress row')} in Postgres resolve to no word.`);

  const notLanded = [...expected.progress.values()]
    .filter((record) => !landed.has(record.key.toLowerCase()))
    .map((record) => record.key);
  if (notLanded.length > 0) problems.push(`In the file, no row in Postgres: ${series(notLanded)}.`);

  if (mismatches.length > 0) {
    problems.push(`${count(mismatches.length, 'difference')} from the file:`);
    problems.push(...mismatches.slice(0, 10).map((line) => `  ${line}`));
    if (mismatches.length > 10) problems.push(`  and ${n(mismatches.length - 10)} more`);
  }

  return {
    number: 3,
    title: `Progress records = ${n(BASELINE.progress)}, each on its own word, values equal`,
    lines: [
      side('file', fileCount, BASELINE.progress),
      side('Postgres', db.progressCount, BASELINE.progress),
      `word_id resolving: ${n(db.progress.length - unresolved)} of ${n(db.progress.length)}`,
      `compared per row: ease (at real precision), repetition, next_review, last_rated`,
      `last_rated re-derived here: next_review - getInterval(ease, repetition) x 24 h, UTC`,
    ],
    problems,
  };
}

/** `ok` when two column values are identical: both NULL, equal strings, or equal arrays. */
function sameValue(a: string | readonly string[] | null, b: string | readonly string[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.length === b.length && a.every((element, index) => element === b[index]);
}

const describeValue = (value: string | readonly string[] | null): string =>
  value === null
    ? 'NULL'
    : typeof value === 'string'
      ? `${n(value.length)} chars`
      : count(value.length, 'item');

/**
 * Check 4. The three adversarial words, field by field and printed; then every
 * other row the same way. The three are what a person reads. The full sweep is
 * what exercises verify's copies of 26a and Q27 on the words those rules touch:
 * three words alone would never reach `importunate` or `satrap`.
 */
function checkContent(backup: BackupFile, expected: Expectations, db: Snapshot): CheckResult {
  const problems: string[] = [];
  const lines: string[] = [];
  const stored = new Map(db.words.map((row) => [row.word.toLowerCase(), row]));

  const compare = (want: StoredWord, have: StoredWord): WordColumn[] =>
    WORD_COLUMNS.filter((column) => !sameValue(want[column], have[column]));

  for (const spot of SPOT_CHECKS) {
    const record = backup.words.find((word) => word['word'] === spot.word);
    const want = expected.words.get(spot.word);
    const have = stored.get(spot.word);

    lines.push(`${spot.word} - ${spot.why}`);

    if (record === undefined || want === undefined) {
      problems.push(`${spot.word} is not in the file.`);
      continue;
    }
    if (!spot.qualifies(record, backup.words)) {
      problems.push(`${spot.word} no longer qualifies as ${spot.why}.`);
    }
    if (have === undefined) {
      problems.push(`${spot.word} is not in Postgres.`);
      continue;
    }

    const differing = compare(want, have);
    for (const column of WORD_COLUMNS) {
      const verdict = differing.includes(column) ? 'MISMATCH' : 'ok';
      lines.push(`    ${column.padEnd(16)}${describeValue(have[column]).padStart(14)}   ${verdict}`);
    }
    if (differing.length > 0) problems.push(`${spot.word} differs in ${series(differing)}.`);
  }

  // The full sweep. Words on only one side are check 1's finding, not this one's.
  const differingWords: string[] = [];
  let compared = 0;
  for (const [lower, want] of expected.words) {
    const have = stored.get(lower);
    if (have === undefined) continue;
    compared += 1;
    const differing = compare(want, have);
    if (differing.length > 0) differingWords.push(`${want.word} (${differing.join(', ')})`);
  }

  lines.push(`every row: ${n(compared)} compared, all eight columns, ${n(differingWords.length)} differ`);
  if (differingWords.length > 0) {
    problems.push(
      `${count(differingWords.length, 'word')} ${differingWords.length === 1 ? 'differs' : 'differ'}: ` +
        `${series(differingWords, 10)}.`,
    );
  }

  return { number: 4, title: 'Content: three words chosen adversarially, then every row', lines, problems };
}

/** Check 5. Every next_review inside the fixed window, and the two spans equal. */
function checkTimestamps(expected: Expectations, db: Snapshot): CheckResult {
  const problems: string[] = [];
  const from = Date.parse(NEXT_REVIEW_WINDOW.from);
  const until = Date.parse(NEXT_REVIEW_WINDOW.until);
  const inside = (ms: number): boolean => ms >= from && ms < until;

  const moments = [...expected.progress.values()].map((record) => record.nextReview);
  const outside = [...expected.progress.values()].filter((record) => !inside(record.nextReview));
  const fileEarliest = moments.length > 0 ? Math.min(...moments) : Number.NaN;
  const fileLatest = moments.length > 0 ? Math.max(...moments) : Number.NaN;
  const dbEarliest = db.earliest?.getTime() ?? Number.NaN;
  const dbLatest = db.latest?.getTime() ?? Number.NaN;

  if (outside.length > 0) {
    problems.push(
      `In the file, outside the window: ` +
        `${series(outside.map((record) => `${record.key} ${iso(record.nextReview)}`))}.`,
    );
  }
  if (db.outsideWindow !== 0) problems.push(`In Postgres, ${count(db.outsideWindow, 'row')} outside the window.`);
  if (dbEarliest !== fileEarliest) problems.push('The earliest next_review differs between file and Postgres.');
  if (dbLatest !== fileLatest) problems.push('The latest next_review differs between file and Postgres.');

  const span = (a: number, b: number): string =>
    Number.isNaN(a) || Number.isNaN(b) ? '(none)' : `${iso(a)} to ${iso(b)}`;

  return {
    number: 5,
    title: 'Timestamps: next_review inside a fixed window',
    lines: [
      `window   ${NEXT_REVIEW_WINDOW.from} (inclusive) to ${NEXT_REVIEW_WINDOW.until} (exclusive)`,
      `file     ${span(fileEarliest, fileLatest)}, ${n(outside.length)} outside`,
      `Postgres ${span(dbEarliest, dbLatest)}, ${n(db.outsideWindow)} outside`,
    ],
    problems,
  };
}

/** Check 6. user_settings equals the file's sources, order compared. */
function checkSettings(expected: Expectations, db: Snapshot): CheckResult {
  const problems: string[] = [];

  if (expected.dictionaries.length !== BASELINE.dictionaries) {
    problems.push(`The file lists ${count(expected.dictionaries.length, 'dictionary', 'dictionaries')}.`);
  }
  if (expected.usageGuides.length !== BASELINE.usageGuides) {
    problems.push(`The file lists ${count(expected.usageGuides.length, 'usage guide')}.`);
  }

  const row = db.settings[0];
  if (db.settings.length !== 1 || row === undefined) {
    problems.push(`user_settings holds ${count(db.settings.length, 'row')}, not 1.`);
  } else {
    const firstDifference = (have: readonly string[], want: readonly string[], label: string): void => {
      if (sameValue(have, want)) return;
      const at = want.findIndex((entry, index) => have[index] !== entry);
      problems.push(
        `${label} differ` +
          (at === -1 ? ` in length: ${n(have.length)} stored, ${n(want.length)} in the file.` :
            ` at position ${at + 1}: stored "${have[at] ?? '(nothing)'}", the file says "${want[at]}".`),
      );
    };
    firstDifference(row.dictionaries, expected.dictionaries, 'dictionaries');
    firstDifference(row.usage_guides, expected.usageGuides, 'usage_guides');
  }

  return {
    number: 6,
    title: `user_settings = the file's sources, in order`,
    lines: [
      `file     ${count(expected.dictionaries.length, 'dictionary', 'dictionaries')}, ` +
        `${count(expected.usageGuides.length, 'usage guide')}`,
      row === undefined
        ? 'Postgres (no row)'
        : `Postgres ${count(row.dictionaries.length, 'dictionary', 'dictionaries')}, ` +
          `${count(row.usage_guides.length, 'usage guide')}; compared entry by entry, in order`,
    ],
    problems,
  };
}

/**
 * Check 7. Study Due, counted from the file and from Postgres independently.
 *
 * The file side is v3.1's own rule (reference/lexicon-v3.jsx, `dueWords`): a
 * word with definitions is due when it has no progress record, or its
 * nextReview is at or before the moment. Unfetched words never count. The
 * Postgres side is the same rule in SQL, joined by word_id.
 */
function checkStudyDue(backup: BackupFile, db: Snapshot, now: Date): CheckResult {
  const problems: string[] = [];

  const dueInFile = (moment: number): number =>
    backup.words.filter((record) => {
      if (!record['definitions']) return false;
      const progress = backup.progress[String(record['word'])];
      if (progress === undefined) return true;
      return Date.parse(String(progress['nextReview'])) <= moment;
    }).length;

  const fileAsOf = dueInFile(Date.parse(STUDY_DUE_AS_OF));
  const fileNow = dueInFile(now.getTime());

  if (fileAsOf !== BASELINE.studyDue) problems.push(`As of ${STUDY_DUE_AS_OF} the file counts ${n(fileAsOf)}.`);
  if (db.dueAsOf !== BASELINE.studyDue) problems.push(`As of ${STUDY_DUE_AS_OF} Postgres counts ${n(db.dueAsOf)}.`);
  if (fileNow !== db.dueNow) {
    problems.push(`Now, the file counts ${n(fileNow)} and Postgres ${n(db.dueNow)}. They must agree.`);
  }

  return {
    number: 7,
    title: `Study Due = ${n(BASELINE.studyDue)} as of ${STUDY_DUE_AS_OF.slice(0, 10)}; file = Postgres now`,
    lines: [
      `as of ${STUDY_DUE_AS_OF}   file ${n(fileAsOf).padStart(5)}   Postgres ${n(db.dueAsOf).padStart(5)}   expected ${n(BASELINE.studyDue)}`,
      `now   ${now.toISOString()}   file ${n(fileNow).padStart(5)}   Postgres ${n(db.dueNow).padStart(5)}   must agree`,
    ],
    problems,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportResolved(args: Args, sourcePath: string, connectionString: string): void {
  console.log('\nverify - check a database against the backup file, read-only (step 10).');
  console.log('\nResolved, before anything happens');
  console.log(`  target       ${args.target}  ->  ${TARGET_VARIABLES[args.target]}`);
  console.log(`  database     ${describeTarget(connectionString)}`);
  console.log(`  TLS          ${describeTls(connectionString)}`);
  console.log(`  file         ${sourcePath}`);
  console.log('  mode         READ ONLY - one REPEATABLE READ, READ ONLY transaction, rolled back');
  if (args.strict) console.log('  --strict     warnings are treated as failures');
}

function reportExpectations(backup: BackupFile, expected: Expectations): void {
  const { tally } = expected;
  console.log('\nSource');
  console.log(`  ${n(backup.bytes)} bytes`);

  console.log("\nRe-derived from the file with verify's own copies of the rules");
  console.log(
    `  26a         ${count(expected.correctionsTotal, 'entry', 'entries')}, ` +
      `${n(expected.correctionsAccepted)} accepted, ` +
      (expected.capitalized.length === 0
        ? 'no headword changed'
        : `${n(expected.capitalized.length)} changed: ${series(expected.capitalized)}`),
  );
  console.log(
    `  Q27         example promoted on ${n(tally.examplePromoted.length)} ` +
      `(${series(tally.examplePromoted)}), superseded on ${n(tally.exampleSuperseded.length)}`,
  );
  console.log(
    `              etymology_note appended on ${n(tally.etymologyNoteAppended.length)}, ` +
      `pronunciation_note on ${n(tally.pronunciationNoteAppended.length)}`,
  );
  console.log(
    `              definitons discarded on ${n(tally.definitonsDiscarded.length)}, ` +
      `confusables on ${n(tally.confusablesDiscarded.length)}`,
  );
  console.log(`  last_rated  re-derived for ${count(expected.progress.size, 'progress record')}`);
}

function reportCheck(check: CheckResult): void {
  const verdict = check.problems.length === 0 ? 'PASS' : 'FAIL';
  console.log(`\n${verdict}  ${check.number}  ${check.title}`);
  for (const line of check.lines) console.log(`         ${line}`);
  for (const problem of check.problems) console.log(`      !  ${problem}`);
}

// ---------------------------------------------------------------------------
// Command line — the loader's rules for --target, copied, not imported
// ---------------------------------------------------------------------------

interface Args {
  readonly source: string;
  readonly target: Target;
  readonly strict: boolean;
}

function usage(problem: string): never {
  console.error(`
${problem}

Check a database against a Lexicon backup, read-only: Q5f's seven checks.

  node --env-file=.env server/scripts/verify.ts \\
       <path-to-backup.json> --target dev|main [--strict]

    --target    REQUIRED, no default and no fallback. Selects
                DATABASE_URL_DEV or DATABASE_URL_MAIN. It never reads
                DATABASE_URL. --target main asks for a typed confirmation.
    --strict    treat every warning as a failure.

The path is REQUIRED and has no default. The file of record is
lexicon-backup-2026-08-03-b.json (2,037,770 bytes).
`);
  process.exit(1);
}

function parseArgs(argv: readonly string[]): Args {
  let source: string | null = null;
  let target: string | null = null;
  let strict = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;

    if (arg === '--strict') {
      strict = true;
    } else if (arg === '--target') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) usage('--target needs a value.');
      target = value;
      index += 1;
    } else if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
    } else if (arg.startsWith('--')) {
      usage(`Unknown option: ${arg}`);
    } else if (source === null) {
      source = arg;
    } else {
      usage(`Unexpected extra argument: ${arg}`);
    }
  }

  if (source === null) usage('No backup file given.');
  if (target === null) usage('No --target given. It has no default: say dev or main.');
  if (target !== 'dev' && target !== 'main') usage(`--target must be dev or main, not \`${target}\`.`);

  return { source, target, strict };
}

function resolveTarget(target: Target): string {
  const variable = TARGET_VARIABLES[target];
  const connectionString = process.env[variable];

  if (!connectionString) {
    console.error(`\n--target ${target} reads ${variable}, and it is not set.`);
    console.error('  This command needs --env-file=.env; Node does not read .env on its own.\n');
    process.exit(1);
  }
  return connectionString;
}

async function confirmMain(): Promise<void> {
  console.log('\n--target main. This is the branch the deployed app reads at cutover.');
  console.log('  Verify only reads, but main is not touched by accident.');

  const input = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await input.question(`\nType \`${MAIN_CONFIRMATION}\` to proceed: `);
  input.close();

  if (answer.trim() !== MAIN_CONFIRMATION) {
    console.log('\nNot confirmed. Nothing was read.\n');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(args.source);
  const connectionString = resolveTarget(args.target);

  reportResolved(args, sourcePath, connectionString);

  // --- the file side, complete before any connection is opened -------------
  const backup = readBackup(sourcePath);
  const findings = new Findings();
  const expected = buildExpectations(backup, findings);
  reportExpectations(backup, expected);

  // A file verify cannot read fully is a file it cannot predict from. Stop
  // before waking the database for a comparison that would mean nothing.
  if (findings.failures.length > 0) {
    for (const failure of findings.failures) console.log(`\nFAIL  ${failure}`);
    console.log('\nStopping before the database is opened.\n\nResult: FAIL\n');
    process.exit(1);
  }

  if (args.target === 'main') await confirmMain();

  // --- the database side ----------------------------------------------------
  // One moment for "now", shared by both sides of check 7's second count.
  const now = new Date();
  const client = new Client(buildConnectionConfig(connectionString));

  try {
    await client.connect();
  } catch (error) {
    console.error(`\nCould not connect to ${args.target}.`);
    console.error(formatDatabaseError(error));
    console.error('');
    process.exit(1);
  }

  let db: Snapshot;
  try {
    db = await readSnapshot(client, now);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection may already be gone, and with it the transaction.
    }
    await client.end();
    console.error('\nFAILED while reading. Nothing was written: the transaction was read-only.');
    console.error(formatDatabaseError(error));
    console.error('');
    process.exit(1);
  }
  await client.end();

  console.log('\nRead-only, proven before reading');
  console.log('  SHOW transaction_read_only -> on');
  console.log(`  a write was attempted and refused: "${db.refusedWrite}"`);

  // --- the seven checks -----------------------------------------------------
  const checks = [
    checkWordCount(backup, expected, db),
    checkSplit(backup, db),
    checkProgress(expected, db),
    checkContent(backup, expected, db),
    checkTimestamps(expected, db),
    checkSettings(expected, db),
    checkStudyDue(backup, db, now),
  ];
  for (const check of checks) reportCheck(check);

  for (const warning of findings.warnings) {
    console.log(`\n${args.strict ? 'WARN (strict: fails)' : 'WARN'}  ${warning}`);
  }

  const passed = checks.filter((check) => check.problems.length === 0).length;
  const promoted = args.strict && findings.warnings.length > 0;
  const failed = passed !== checks.length || promoted;

  console.log(
    `\nResult: ${failed ? 'FAIL' : 'PASS'} - ${n(passed)} of ${n(checks.length)} checks passed, ` +
      `${count(findings.warnings.length, 'warning')}` +
      (promoted ? ', promoted to failures by --strict' : '') +
      '.\n',
  );
  process.exit(failed ? 1 : 0);
}

await main();
