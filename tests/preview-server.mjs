// The deployed site, in miniature.
//
// Serves dist/ the way Cloudflare Pages will: the rules in public/_headers
// applied to the requested path, duplicate header names appended rather than
// replaced, and a .html URL redirected to its clean form before any rule is
// matched. Tests that check headers, policy or the service worker need the real
// thing, and a Vite dev server is not it.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const dist = join(root, "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

function readRules() {
  const rules = [];
  for (const line of readFileSync(join(dist, "_headers"), "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      const [name, ...rest] = line.trim().split(":");
      rules.at(-1).headers.push([name.trim(), rest.join(":").trim()]);
    } else rules.push({ path: line.trim(), headers: [] });
  }
  return rules;
}

const matches = (rule, path) => (rule.path.endsWith("*") ? path.startsWith(rule.path.slice(0, -1)) : rule.path === path);

// `overrides` lets a test stand in for a later deploy by changing what a path
// answers with, without touching the build on disk.
export async function startPreview({ overrides = new Map() } = {}) {
  if (!existsSync(join(dist, "index.html"))) throw new Error("No build to serve. Run `pnpm build` first.");
  const rules = readRules();

  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    // Pages redirects to the clean URL before it matches a header rule, so the
    // headers a visitor receives are the ones for the extensionless path.
    if (path.endsWith(".html")) {
      response.writeHead(308, { Location: path === "/index.html" ? "/" : path.slice(0, -5) }).end();
      return;
    }

    const override = overrides.get(path);
    const candidates = path.endsWith("/") ? [join(path, "index.html")] : [path, `${path}.html`];
    const file = candidates.map((name) => join(dist, normalize(name).replace(/^(\.\.[/\\])+/, "")))
      .find((full) => full.startsWith(dist) && existsSync(full) && statSync(full).isFile());
    if (!override && !file) { response.writeHead(404).end("not found"); return; }

    for (const rule of rules) {
      if (!matches(rule, path)) continue;
      for (const [name, value] of rule.headers) {
        const existing = response.getHeader(name);
        response.setHeader(name, existing ? `${existing}, ${value}` : value);
      }
    }
    response.setHeader("Content-Type", TYPES[extname(file || path)] || "application/octet-stream");
    response.writeHead(200).end(override ?? readFileSync(file));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}`, overrides, rules };
}
