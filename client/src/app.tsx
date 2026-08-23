/**
 * app.tsx — the whole client, for now (step 7b).
 *
 * One component: fetch GET /api/words once, render an unstyled list. This is the
 * client half of the first vertical slice, and it is meant to be ugly. What is
 * being proved is that a row in Neon can reach a browser — not that it can look
 * like anything. Styling arrives with the library slice at step 13.
 *
 * A LOWERCASE FILENAME HOLDING A CAPITALISED COMPONENT
 * ----------------------------------------------------
 * React's convention would call this App.tsx. Q19's convention is lowercase-with-
 * hyphens for every file in the repo, because Windows treats App.tsx and app.tsx
 * as one file and Linux treats them as two — so a mis-cased import works on this
 * laptop and fails on Render, at deploy time, where it is expensive to find. A
 * rule that cannot be broken beats a rule that must be remembered.
 *
 * This is the step where the two conventions finally meet, and it was decided in
 * advance: the filename convention wins. The component keeps its capital A, which
 * is not a filename and is not optional either — JSX reads a lowercase tag as an
 * HTML element, so <app /> would compile to an unknown DOM node. The repo reads
 * slightly off-convention to a React programmer. That cost was accepted.
 *
 * NOTHING HERE POLLS, EVER (Q21a)
 * -------------------------------
 * The effect below runs once, on mount, and never again: the dependency array is
 * empty and there is no setInterval in any code that runs. (A grep finds several
 * in reference/lexicon-v3.jsx. That is the frozen v3.1 prototype — imported by
 * nothing, executed by nothing, and it will always have them.) That is a standing
 * rule rather than a preference. A Neon compute on the free plan sleeps after five
 * minutes with NO QUERIES, and the free plan allows 100 compute-hours a month. A
 * client that quietly refetched every thirty seconds would be a compute that never
 * sleeps, a quota exhausted around day seventeen, and not one line printed anywhere
 * until the project suspends itself.
 *
 * The consequence, stated plainly: data on screen goes stale until the page is
 * reloaded. For a library one person edits, that is the right trade.
 */

import { useEffect, useState } from 'react';

/**
 * One row as GET /api/words returns it.
 *
 * Only the two fields this step uses are named. The endpoint sends ten columns and
 * the rest arrive in the response untouched and unnamed — step 13 is where they get
 * read, and typing them now would be describing code that does not exist.
 *
 * `id` IS A STRING, and that is not a mistake. The column is a Postgres bigint,
 * whose range is wider than a JavaScript number can hold exactly, so pg hands it
 * back as a string rather than silently rounding one. React keys are strings
 * anyway, so nothing here has to care — but the day something does arithmetic on
 * an id, this is the reason it will not work.
 *
 * Nothing checks this shape at run time. It is a hand-written claim about what
 * server/src/index.ts selects, and the two are kept in step by hand.
 */
type Word = {
  id: string;
  word: string;
};

export function App() {
  // null is "not answered yet", distinct from [] which would be "the library is
  // empty". Three states — loading, failed, loaded — and they are worth keeping
  // apart, because two of them are how this step reports that it did not work.
  const [words, setWords] = useState<Word[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // An AbortController, not the { cancelled } flag the v3.1 artifact used. That
    // flag was a sandbox workaround — AbortController was unreliable inside the
    // artifact — and the sandbox is gone. In a real browser this cancels the
    // request itself rather than letting it finish and discarding the answer.
    //
    // It is needed at all because StrictMode mounts this component twice in
    // development. Two fetches go out on a dev page load and the first is aborted.
    const controller = new AbortController();

    async function loadWords() {
      try {
        // A relative path, which is the whole reason vite.config.ts has a proxy:
        // this same line reaches Vite-then-Express in development and reaches
        // Express directly in production, with nothing to configure at either end.
        const response = await fetch('/api/words', { signal: controller.signal });

        // fetch rejects only when the request never completed — no network, no
        // server. A 500 from Express is a perfectly successful round trip as far
        // as fetch is concerned, so the status has to be checked by hand, or the
        // error page gets handed to JSON.parse instead.
        if (!response.ok) {
          throw new Error(`the server answered ${response.status} ${response.statusText}`);
        }

        setWords(await response.json());
      } catch (caught) {
        // An abort is this effect cleaning up after itself, not a failure. Left
        // unhandled it would flash an error on every StrictMode mount.
        if (caught instanceof DOMException && caught.name === 'AbortError') return;

        // The console gets the whole object; the page gets a sentence. Same split
        // as the server, for the same reason: detail where a developer is looking.
        console.error('client: GET /api/words failed.', caught);
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    }

    // `void` says the floating promise is deliberate. An effect may not be async
    // itself — React reads its return value as the cleanup function.
    void loadWords();

    return () => controller.abort();
  }, []);

  if (error !== null) {
    return (
      <main>
        <h1>Lexicon</h1>
        <p>Could not load the library: {error}</p>
        <p>Is the server up? `npm run dev:server`, in its own terminal.</p>
      </main>
    );
  }

  if (words === null) {
    return (
      <main>
        <h1>Lexicon</h1>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Lexicon</h1>

      {/*
        The count is the verification, not decoration. A list of 1,070 items is not
        something anyone can eyeball, and "some words appeared" is not the claim
        being made — 1,070 is. The number is the only thing on this page that can
        tell the difference between the whole library and most of it.
      */}
      <p>{words.length.toLocaleString()} words</p>

      <ul>
        {words.map((word) => (
          // key={word.id}, and the id stops here.
          //
          // Ids are internal plumbing: every wipe-and-reload before cutover
          // regenerates them, so nothing outside the database may depend on one.
          // A React key never leaves the browser's memory, which is exactly why
          // this use is allowed. An id must not become a URL segment, a route
          // parameter, or a field in an export. The word string is the public
          // identity; the id is not.
          <li key={word.id}>{word.word}</li>
        ))}
      </ul>
    </main>
  );
}
