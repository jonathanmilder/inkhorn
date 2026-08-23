/**
 * vite.config.ts — the client's dev server and its build (step 7b).
 *
 * WHY THIS SITS AT THE REPO ROOT AND NOT IN client/
 * -------------------------------------------------
 * Q31: one package.json for the whole repo, no workspaces. Vite is a devDependency
 * in that single manifest, beside Express, so its configuration belongs beside the
 * manifest — next to package.json and tsconfig.json, where the repo's other
 * toolchain files already are. `root: 'client'` is the line that points it at the
 * client source; every path Vite resolves is relative to that, not to this file.
 *
 * THE PROXY IS THE POINT OF THIS FILE
 * -----------------------------------
 * In development there are two servers: Vite on 5173 serving the React source, and
 * Express on 3000 holding the database. A page served from 5173 that fetched
 * http://localhost:3000/api/words would be making a cross-origin request, and the
 * browser would refuse to hand over the response unless Express grew CORS headers.
 *
 * In production there is one server. Express serves the built client AND the API
 * from a single origin, and CORS does not arise at all.
 *
 * The proxy makes development resemble production rather than the other way round.
 * Vite forwards anything starting with /api through to Express, so the client can
 * fetch the relative path '/api/words' and that one line is correct in both places.
 * No cors dependency on the server, no VITE_API_URL, no branch on an environment
 * variable to decide where the API lives.
 *
 * WHAT THIS DOES NOT READ
 * -----------------------
 * Vite loads .env files from `envDir`, which defaults to `root` — so it looks in
 * client/, not at the repo root, and never opens the .env holding DATABASE_URL.
 * That default is doing real work: anything Vite loads can end up inlined into a
 * bundle that ships to a browser. Do not set envDir to the repo root.
 */

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Where Express is listening in development.
 *
 * Hardcoded, and coupled to PORT in .env — 3000 is the server's fallback when PORT
 * is unset. If PORT ever changes, change it here too.
 *
 * THIS IS A CHOICE, NOT A LIMITATION, and the distinction matters to whoever reads
 * it next. Vite exports `loadEnv`, and this file is a Node program that runs before
 * the dev server starts — so `loadEnv(mode, process.cwd(), 'PORT')` would read the
 * repo-root .env and hand back that one variable. It works. It was not done.
 *
 * The reason: to return one variable, loadEnv opens and parses the WHOLE file — the
 * one holding DATABASE_URL — and holds it in memory. Nothing would reach a browser.
 * A proxy target is a dev-server setting, evaluated here in Node, and it is never
 * bundled; Vite also expands into a copy of the environment rather than the real
 * one. The objection is not leakage. It is that reading the file with the database
 * password in it would become a normal thing for the client's toolchain to do, and
 * the whole of what it buys is not retyping one number.
 *
 * Stated rather than hidden: a two-line coupling whose failure is a confusing 404
 * from the proxy, in development, with someone watching. That is a cheaper thing to
 * own than the habit is.
 *
 * Same instinct as the envDir note above, pointing the same way.
 */
const API_SERVER = 'http://localhost:3000';

export default defineConfig({
  root: 'client',

  plugins: [react()],

  server: {
    port: 5173,

    // Fail loudly if something already holds 5173 rather than quietly moving to
    // 5174. A dev server whose address changes underneath you is a bad thing to
    // debug, and worse to describe over a terminal.
    strictPort: true,

    proxy: {
      '/api': API_SERVER,
    },
  },

  build: {
    // Relative to `root`, so this writes <repo>/dist/client. Nothing serves it yet
    // — step 8 is where Express learns to. dist/ is already gitignored.
    outDir: '../dist/client',

    // Vite will not empty an outDir that sits outside its root unless told to,
    // in case the path is a mistake and the directory is someone's home folder.
    emptyOutDir: true,
  },
});
