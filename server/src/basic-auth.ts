/**
 * basic-auth.ts — the temporary access gate (20d, landed at step 8).
 *
 * From step 8 the app sits on a public onrender.com URL that anyone can guess.
 * HTTP Basic Auth is the smallest thing that closes it: the browser asks for a
 * username and password once, then sends them with every request. The analogy is
 * a doorman with one name on the list. Where it breaks: a doorman remembers your
 * face, and Basic Auth remembers nothing — the browser resends the password on
 * every request, which is safe only because Render serves everything over HTTPS.
 *
 * It is deleted in leg two (Q8), when real accounts replace it.
 *
 *
 * IT DOES NOT FAIL OPEN IN PRODUCTION
 * -----------------------------------
 * If BASIC_AUTH_USER or BASIC_AUTH_PASSWORD is missing on Render, the server
 * refuses to start. A deploy that cannot start is marked failed and the previous
 * version stays live, so a forgotten variable costs a failed deploy, never an
 * open door.
 *
 * Locally, with both unset, the gate is off and the server says so on every boot.
 * That keeps `dev:server` + `dev:client` working exactly as before step 8.
 *
 * "Production" is decided by two signals, either one enough: RENDER, which Render
 * sets to "true" on every service, and NODE_ENV=production, which Render sets at
 * run time for Node. Two because the cost of getting this wrong is asymmetric —
 * mistaking the laptop for production is a refused start; the reverse is an open
 * door.
 *
 * Setting only ONE of the pair is refused everywhere, locally too. That is never
 * what anyone meant.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

/** What the browser shows in its password prompt. */
const REALM = 'Inkhorn';

/**
 * Compare two strings without leaking, through timing, how much of them matched.
 *
 * A plain `===` stops at the first differing character, so in principle an
 * attacker can learn a password one character at a time by measuring how long a
 * refusal takes. Hashing both sides first gives two equal-length buffers, which
 * `timingSafeEqual` requires, and hides the real length as well.
 */
function sameSecret(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Read the two variables and return the gate, or null if it is deliberately off.
 * Exits the process when the configuration is unsafe (see the header).
 */
export function createBasicAuth(inProduction: boolean): RequestHandler | null {
  const user = process.env.BASIC_AUTH_USER ?? '';
  const password = process.env.BASIC_AUTH_PASSWORD ?? '';

  if (user === '' && password === '') {
    if (inProduction) {
      console.error('server: BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are not set.');
      console.error('  In production the access gate is required (20d). Not starting.');
      process.exit(1);
    }
    console.log('server: Basic Auth is OFF (BASIC_AUTH_* not set; allowed only off Render).');
    return null;
  }

  if (user === '' || password === '') {
    console.error('server: only one of BASIC_AUTH_USER and BASIC_AUTH_PASSWORD is set.');
    console.error('  Set both, or (locally only) neither. Not starting.');
    process.exit(1);
  }

  console.log('server: Basic Auth is ON.');

  return (request, response, next) => {
    // The header looks like:  Authorization: Basic dXNlcjpwYXNzd29yZA==
    // The part after "Basic " is base64 of "user:password".
    const header = request.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');

    if (scheme === 'Basic' && encoded !== undefined) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      // Split at the FIRST colon: a username cannot contain one, a password can.
      const colon = decoded.indexOf(':');
      if (colon !== -1) {
        // Both comparisons always run, so a right username with a wrong password
        // takes as long to refuse as a wrong username.
        const userOk = sameSecret(decoded.slice(0, colon), user);
        const passwordOk = sameSecret(decoded.slice(colon + 1), password);
        if (userOk && passwordOk) return next();
      }
    }

    // 401 plus this header is what makes a browser show its password prompt.
    response.set('WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`);
    response.status(401).send('Authentication required.');
  };
}
