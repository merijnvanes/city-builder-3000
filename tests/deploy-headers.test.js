// What the host is told to do with each file.
//
// Two rules carry the whole deployment. Files under /assets have a content hash
// in the name, so their URL changes whenever their bytes do and a browser may
// keep them forever. The HTML has a fixed URL and names those hashed files, so
// it has to be checked on every load: cache index.html and a returning player
// gets a page pointing at a bundle that was deleted three deploys ago, with no
// way to recover but a hard reload they will never think to try.
//
// Getting that backwards is invisible until it strands somebody, so it is
// checked here against the real build output.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
// `pnpm build` has to have run. CI builds before it tests, so the tree walk
// below is never skipped there.
const built = existsSync(join(dist, "index.html"));
const needsBuild = built ? false : "run pnpm build first";

// The _headers format: a line in column zero is a path, indented lines under it
// are headers for that path, and # starts a comment.
function parseHeaders(text) {
  const rules = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      const [name, ...rest] = line.trim().split(":");
      assert.ok(rules.length, `header "${line.trim()}" has no path above it`);
      rules.at(-1).headers[name.toLowerCase()] = rest.join(":").trim();
    } else {
      rules.push({ path: line.trim(), headers: {} });
    }
  }
  return rules;
}

const matches = (rule, path) =>
  rule.path.endsWith("*") ? path.startsWith(rule.path.slice(0, -1)) : rule.path === path;

// Both hosts apply every matching rule, and a header named twice is appended,
// not replaced: Cloudflare Pages joins the values with a comma. A narrower rule
// therefore cannot override a broader one, and modelling it as an override
// would have this file agree with a deployment that behaves differently.
const headersFor = (rules, path) => {
  const all = {};
  for (const rule of rules.filter((rule) => matches(rule, path))) {
    for (const [name, value] of Object.entries(rule.headers)) {
      all[name] = all[name] ? `${all[name]}, ${value}` : value;
    }
  }
  return all;
};

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

const urlOf = (file) => `/${relative(dist, file).split(/[\\/]/).join("/")}`;
// index-Dg5ktMD0.js, airport-apron-day-0.d2c729ac48.webp: a long opaque token
// before the extension, put there by Vite or by tools/civic_art/package.py.
const hashed = (path) => /[-.][A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(path);

const rules = parseHeaders(readFileSync(join(root, "public/_headers"), "utf8"));

describe("deploy headers", () => {
  test("hashed assets are kept for a year, and nothing else is", () => {
    const assets = headersFor(rules, "/assets/index-abcd1234.js")["cache-control"];
    assert.match(assets, /immutable/);
    assert.match(assets, /max-age=31536000/);

    // The artwork catalogue keeps one fixed name, so it must stay outside
    // /assets where nothing can hand it a year-long cache.
    const catalog = headersFor(rules, "/civic-catalog.json")["cache-control"];
    assert.doesNotMatch(catalog, /immutable/, "a file with a fixed name is never immutable");
    assert.match(catalog, /max-age=0/);

    // Cloudflare Pages serves a page at its clean URL and matches these rules
    // against the path the browser asked for.
    for (const page of ["/", "/index.html", "/civic-gallery", "/civic-gallery.html"]) {
      const control = headersFor(rules, page)["cache-control"];
      assert.ok(control, `${page} has no cache rule`);
      assert.match(control, /max-age=0/, `${page} must be checked on every load`);
      assert.match(control, /must-revalidate/, page);
      assert.doesNotMatch(control, /immutable/, `${page} must never be immutable`);
    }
  });

  test("no path is claimed by two rules setting the same header", { skip: needsBuild }, () => {
    // A header named twice is appended by the host, not replaced. Two rules
    // matching one path would send "immutable, max-age=0" together, and a
    // browser that honours immutable keeps the file for a year anyway. The way
    // to narrow a policy is to move the file, not to add a second rule.
    const paths = [...filesUnder(dist).map(urlOf), "/", "/civic-gallery"];
    for (const path of paths) {
      const seen = new Map();
      for (const rule of rules.filter((rule) => matches(rule, path))) {
        for (const name of Object.keys(rule.headers)) seen.set(name, [...(seen.get(name) || []), rule.path]);
      }
      for (const [name, claiming] of seen) {
        assert.equal(claiming.length, 1,
          `${path} gets ${name} from ${claiming.join(" and ")}, and both values would be sent`);
      }
    }
  });

  test("every response carries the security headers", () => {
    // One rule for every path, so nothing served can be framed, sniffed, or
    // allowed to reach out to somewhere the game never talks to. Checked on
    // each kind of path the site answers on, not just the front page.
    for (const path of ["/", "/index.html", "/civic-gallery", "/assets/index-abcd1234.js", "/civic-catalog.json", "/fonts/OFL.txt"]) {
      const headers = headersFor(rules, path);
      assert.equal(headers["x-content-type-options"], "nosniff", path);
      assert.equal(headers["referrer-policy"], "no-referrer", path);
      assert.equal(headers["cross-origin-opener-policy"], "same-origin", path);
      assert.equal(headers["cross-origin-resource-policy"], "same-origin", path);
      assert.match(headers["strict-transport-security"], /max-age=\d{7,}/, path);
      assert.match(headers["permissions-policy"], /geolocation=\(\), gyroscope=\(\)/, path);
      assert.ok(headers["content-security-policy"], `${path} has no policy`);
    }

    const policy = headersFor(rules, "/")["content-security-policy"];
    const csp = Object.fromEntries(policy.split(";")
      .map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values.join(" ")]));
    assert.equal(csp["default-src"], "'none'", "everything is denied before anything is allowed");
    assert.equal(csp["script-src"], "'self'", "no inline script, no third-party script");
    assert.equal(csp["style-src"], "'self'", "no inline style either");
    assert.equal(csp["img-src"], "'self' data:", "same-origin sprites, plus the empty inline favicon");
    assert.equal(csp["font-src"], "'self'");
    assert.equal(csp["connect-src"], "'self'", "the game never calls out");
    // worker-src falls back to script-src when it is absent, so leaving it out
    // would quietly permit same-origin workers under a policy claiming to be
    // shut. Nothing here runs off the main thread.
    for (const shut of ["media-src", "worker-src", "object-src", "frame-ancestors", "base-uri", "form-action"]) {
      assert.equal(csp[shut], "'none'", shut);
    }
    assert.doesNotMatch(policy, /unsafe-/, "the policy needs no escape hatch");
  });

  test("no page carries inline script or style for the policy to have to allow", { skip: needsBuild }, () => {
    for (const page of filesUnder(dist).filter((file) => file.endsWith(".html"))) {
      const html = readFileSync(page, "utf8");
      assert.doesNotMatch(html, /<style[\s>]/i, `${urlOf(page)} has an inline stylesheet`);
      assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, `${urlOf(page)} has an inline script`);
      assert.doesNotMatch(html, /\sstyle="/i, `${urlOf(page)} has a style attribute`);
      assert.doesNotMatch(html, /\son[a-z]+=/i, `${urlOf(page)} has an inline event handler`);
    }
  });

  test("no script builds CSS out of a string at runtime", { skip: needsBuild }, () => {
    // style.cssText parses CSS from a string, which a strict style policy is
    // entitled to refuse and which browsers disagree about. Individual property
    // setters and classes are not in doubt, and there is no reason to be.
    for (const script of filesUnder(dist).filter((file) => file.endsWith(".js"))) {
      assert.doesNotMatch(readFileSync(script, "utf8"), /\.cssText\s*=/,
        `${urlOf(script)} sets style.cssText; use a class instead`);
    }
  });

  test("every file in the build is covered, and only hashed ones forever", { skip: needsBuild }, () => {
    const files = filesUnder(dist).map(urlOf).filter((path) => path !== "/_headers");
    assert.ok(files.length > 100, `expected a full build, found ${files.length} files`);

    for (const path of files) {
      const control = headersFor(rules, path)["cache-control"];
      assert.ok(control, `${path} ships with no cache rule`);
      if (/immutable/.test(control)) {
        assert.ok(hashed(path), `${path} is cached forever but its name carries no content hash`);
      }
    }
  });

  test("the index is not cached, so a new build reaches a returning player", { skip: needsBuild }, () => {
    // The one that matters most: index.html names the hashed bundle, and a
    // cached copy of it outlives the bundle it names.
    const control = headersFor(rules, "/index.html")["cache-control"];
    assert.match(control, /max-age=0/);

    const html = readFileSync(join(dist, "index.html"), "utf8");
    const referenced = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(referenced.length >= 2, `index.html should name the bundle and stylesheet, found ${referenced.length}`);
    for (const asset of referenced) {
      assert.ok(hashed(asset), `${asset} is named by index.html but carries no content hash`);
      assert.ok(existsSync(join(dist, asset)), `${asset} is named by index.html but is not in the build`);
    }
  });

  test("the font ships once, hashed, and its licence ships with the build", { skip: needsBuild }, () => {
    // Everything in public/ is copied to the build root untouched, so a font
    // kept there shipped twice: once unhashed and unused, once hashed and
    // actually loaded. Only the hashed one can be cached forever.
    const fonts = filesUnder(dist).map(urlOf).filter((path) => path.endsWith(".woff2"));
    assert.equal(fonts.length, 1, `expected one font file, found ${fonts.join(", ")}`);
    assert.ok(fonts[0].startsWith("/assets/"), `${fonts[0]} should be a hashed build asset`);
    assert.ok(existsSync(join(dist, "fonts/OFL.txt")), "the licence ships");
  });

  test("nothing under /assets keeps a fixed name", { skip: needsBuild }, () => {
    // The invariant the year-long cache rests on. A file with a stable name
    // under /assets would be frozen in every returning browser.
    const unhashed = filesUnder(dist).map(urlOf).filter((path) => path.startsWith("/assets/") && !hashed(path));
    assert.deepEqual(unhashed, [], `these would be cached for a year under a name that can change: ${unhashed.join(", ")}`);
  });
});
