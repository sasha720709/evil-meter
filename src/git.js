import { execFileSync } from "node:child_process";
import path from "node:path";

const ZERO_SHA = /^0+$/;
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

export function repoRoot() {
  return git(["rev-parse", "--show-toplevel"], { allowFail: true });
}

export function hooksDir() {
  // Respects core.hooksPath and worktrees.
  return path.resolve(git(["rev-parse", "--git-path", "hooks"]));
}

function exists(rev) {
  return git(["cat-file", "-e", `${rev}^{commit}`], { allowFail: true }) !== null;
}

function excludeSpecs(cfg) {
  return ["--", ".", ...cfg.exclude.map((g) => `:(exclude,glob)${g}`)];
}

function describeCommits(shas) {
  return shas.map((sha) => {
    const [short, author, subject] = git(["log", "-1", "--format=%h%x00%an%x00%s", sha]).split("\0");
    return { sha: short, author, subject };
  });
}

// Work out base..tip for one ref update from the pre-push stdin.
function rangeFor(localSha, remoteSha) {
  let commits;
  let base;
  if (!ZERO_SHA.test(remoteSha) && exists(remoteSha)) {
    base = git(["merge-base", remoteSha, localSha], { allowFail: true }) || remoteSha;
    commits = git(["rev-list", "--reverse", `${base}..${localSha}`]).split("\n").filter(Boolean);
  } else {
    // New branch (or unknown remote state): only judge commits no remote has seen yet.
    commits = git(["rev-list", "--reverse", localSha, "--not", "--remotes"]).split("\n").filter(Boolean);
    if (commits.length === 0) return null;
    base = git(["rev-parse", "--verify", "-q", `${commits[0]}^`], { allowFail: true }) || EMPTY_TREE;
  }
  if (commits.length === 0) return null;
  return { base, tip: localSha, commits };
}

function buildChangeSet(ranges, cfg) {
  const commits = [];
  const seen = new Set();
  let stat = "";
  let diff = "";
  for (const r of ranges) {
    for (const c of describeCommits(r.commits)) {
      if (!seen.has(c.sha)) {
        seen.add(c.sha);
        commits.push(c);
      }
    }
    stat += git(["diff", "--stat=120", r.base, r.tip, ...excludeSpecs(cfg)]) + "\n";
    diff += git(["diff", "--no-color", "--no-ext-diff", "-U3", r.base, r.tip, ...excludeSpecs(cfg)]) + "\n";
  }
  const fullLength = diff.length;
  const truncated = fullLength > cfg.maxDiffChars;
  if (truncated) diff = diff.slice(0, cfg.maxDiffChars);
  return { commits, stat: stat.trim(), diff, truncated, fullLength };
}

// stdin format: "<local ref> <local sha> <remote ref> <remote sha>" per line.
export function changesFromPushInput(stdinText, cfg) {
  const ranges = [];
  for (const line of stdinText.split(/\r?\n/)) {
    const [, localSha, , remoteSha] = line.trim().split(/\s+/);
    if (!localSha || ZERO_SHA.test(localSha)) continue; // branch deletion
    const r = rangeFor(localSha, remoteSha || "0");
    if (r) ranges.push(r);
  }
  if (ranges.length === 0) return null;
  return buildChangeSet(ranges, cfg);
}

export function changesFromLastCommit(cfg, rev = "HEAD") {
  const tip = git(["rev-parse", rev]);
  const base = git(["rev-parse", "--verify", "-q", `${tip}^`], { allowFail: true }) || EMPTY_TREE;
  return buildChangeSet([{ base, tip, commits: [tip] }], cfg);
}
