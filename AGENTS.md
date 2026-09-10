# City Builder 3000

A browser city builder. Vanilla JS, Canvas 2D, no runtime dependencies, original artwork.

`README.md` is the manual and it is kept current. Read the section you need rather than guessing:
**Build and deploy**, **Continuous integration**, **Tests**, **Game interface**, **Building
artwork**, **Playing with an agent**, **The game**, **Controls**, **Project layout**.

This file is the index. It holds only what is expensive to get wrong.

## Commands

```bash
pnpm dev                 # dev server at http://127.0.0.1:5173
pnpm build               # outputs to dist/
pnpm test                # unit suites; run pnpm build first or the header test skips itself
pnpm deploy              # builds, then ships to citybuilder.mulletiq.com
```

Browser suites need Chrome and a dev server on port 4173. `pnpm dev --port 4173` in one terminal,
the suite in another. `CIVIC_TEST_URL` points them somewhere else.

## Deployment

Live at <https://citybuilder.mulletiq.com>, on Cloudflare Workers static assets.

**A push to `main` deploys to a public site.** The `deploy` job in `.github/workflows/ci.yml`
runs after `test` passes. Do not push to `main` on the user's behalf without being asked.

`wrangler.jsonc` is the whole deployment. There is no `main` entry, because every file in the
build is static. The account is named in that file; CI needs one repository secret,
`CLOUDFLARE_API_TOKEN`.

**Never add a second hostname.** `workers_dev` and `preview_urls` are both off on purpose. Each
would publish another address serving the same game, and `src/save-store.js` keeps cities in
IndexedDB, which is scoped to the origin. A player who arrives on the other address finds an
empty map and no route back to the city they built. The same reasoning rules out moving the game
to another domain or path once players exist.

`public/_headers` carries the cache and security policy and is load-bearing. Everything under
`/assets` is content-hashed and cached for a year; the HTML is revalidated on every load. No path
may match two rules that set the same header, because both hosts append rather than replace.
`tests/deploy-headers.test.js` checks a finished build against all of it.

`wrangler` is pinned below the latest release. A global `min-release-age=7` npm policy refuses
packages published in the last week, so bumping it fails the install until the version ages.

**GitHub Actions are pinned to commit SHAs, not tags.** Do not "tidy" them back to `@v7`; the
first step of the `test` job fails the build if you do. A tag can be moved by whoever owns the
action, and that code shares a runner with the deploy token. When bumping one, dereference
annotated tags to a real commit and pin only a release whose `action.yml` says `using: node24`.
`.github/workflows/ci.yml` carries the commands, the Node 20 removal date, and the one action
the annotated-tag trap bites on.

## Things that are failing on purpose

`test:working-set`, `test:transport` and `test:art-production` are left out of the nightly
workflow and still fail. The first two assert counts the game has grown past; those numbers are
for a human to look at rather than raise blindly. Reasons are at the top of
`.github/workflows/nightly.yml`. Do not "fix" them by editing the expected number.

## Conventions

Comments explain why, not what, and they are expected to earn their length. Match the density and
voice of the file you are editing. Tests are real checks against a real browser where the claim
needs one; a passing assertion that proves nothing is worse than no assertion.
