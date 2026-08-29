#!/usr/bin/env node
/**
 * Catches a stale HANDOFF.md.
 *
 * Twice now a handover document has been written describing a state of the repo
 * that had already moved on: paths that did not exist, and work built after the
 * document was written and never folded back into it. Both times it was caught by
 * a human asking, which is not a control.
 *
 * Two checks:
 *   1. Every file path mentioned in HANDOFF.md actually exists.
 *   2. Nothing under src/ or docs/ is newer than HANDOFF.md itself. If something
 *      is, the repo changed after the handover was written, and the handover has
 *      not been reconciled with it.
 *
 * Check 2 is deliberately blunt. A false positive costs you thirty seconds of
 * re-reading. A false negative costs somebody a day building the wrong thing.
 *
 * Run: node scripts/check-handoff.mjs
 */
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const HANDOFF = "HANDOFF.md";

if (!existsSync(HANDOFF)) {
  console.log("No HANDOFF.md. Nothing to check.");
  process.exit(0);
}

const text = readFileSync(HANDOFF, "utf8");
const handoffMtime = statSync(HANDOFF).mtimeMs;

/* ---------- check 1: referenced paths exist ---------- */

// Only backticked strings that look like a real path inside this repo. URL routes
// ("/projects"), npm packages ("@astrojs/vercel") and bare filenames are prose here,
// not file references, and flagging them buries the real failures in noise.
const REPO_DIRS = /^(src|docs|scripts|cms|studio|public)\//;
const candidates = new Set();

const consider = (raw) => {
  const s = raw.trim();
  if (!s || s.includes(" ") || s.startsWith("--") || s.startsWith("$")) return;
  if (s.startsWith("http")) return;
  if (!REPO_DIRS.test(s)) return;
  candidates.add(s);
};

// Inline code spans.
for (const [, inner] of text.matchAll(/`([^`\n]+)`/g)) consider(inner);

// Fenced blocks. The file manifests live in these, so skipping them would leave
// the most important list in the document unchecked, which is how the planted
// test case slipped through the first version of this script.
let fenced = false;
for (const line of text.split("\n")) {
  if (line.trimStart().startsWith("```")) {
    fenced = !fenced;
    continue;
  }
  if (!fenced) continue;
  consider(line.split(/\s+/)[0]);
}

// Files the document deliberately describes as not yet built. Listed explicitly so
// that "planned" is a decision someone wrote down, not something the check guesses.
const planned = new Set();
const plannedBlock = text.match(/<!-- planned-files\n([\s\S]*?)-->/);
if (plannedBlock) {
  for (const line of plannedBlock[1].split("\n")) {
    const s = line.trim();
    if (s && !s.startsWith("#")) planned.add(s);
  }
}

const missing = [];
for (const c of candidates) {
  if (planned.has(c)) continue;
  const p = join(ROOT, c.replace(/\/$/, ""));
  if (!existsSync(p)) missing.push(c);
}

/* ---------- check 2: nothing newer than the handover ---------- */

const SKIP = new Set(["node_modules", ".git", ".astro", "dist", ".vercel", "media"]);
const newer = [];

const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith("._") || e.name === ".DS_Store") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(full);
    } else {
      try {
        if (statSync(full).mtimeMs > handoffMtime + 1000) {
          newer.push(relative(ROOT, full));
        }
      } catch {
        /* unreadable, skip */
      }
    }
  }
};

for (const d of ["src", "docs"]) {
  if (existsSync(join(ROOT, d))) walk(join(ROOT, d));
}

/* ---------- report ---------- */

let failed = false;

console.log(
  `HANDOFF.md references ${candidates.size} repo paths ` +
    `(${planned.size} marked as not yet built).`,
);

if (missing.length) {
  failed = true;
  console.log(`\n${missing.length} referenced path(s) do not exist:`);
  for (const m of missing.sort()) console.log(`  ${m}`);
  console.log("\nEither the file was never created or it moved. Fix the document.");
} else {
  console.log("All referenced paths exist.");
}

if (newer.length) {
  failed = true;
  console.log(`\n${newer.length} file(s) changed after HANDOFF.md was last written:`);
  for (const n of newer.sort().slice(0, 25)) console.log(`  ${n}`);
  if (newer.length > 25) console.log(`  ...and ${newer.length - 25} more`);
  console.log(
    "\nThe repo moved after the handover was written. Re-read HANDOFF.md against\n" +
      "what is actually there, update it, and it will pass on the next run.",
  );
} else {
  console.log("Nothing under src/ or docs/ is newer than HANDOFF.md.");
}

if (failed) {
  console.log("\nHandover is stale.");
  process.exit(1);
}
console.log("\nHandover is current.");
