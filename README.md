# ☠ Evil Meter

A git pre-push hook that asks Claude **how evil your code is** before it reaches GitHub.

Run `git push` and a speedometer pops up. The needle twitches while it measures, like fast.com does, then settles on a score from 0 to 100. If the score passes your evil threshold, the push is blocked. Every verdict comes with a villain-voiced roast and a list of your sins.

```
  ☠ EVIL METER  [████████████████████████████|███████████]  99/100 (limit 70)
  Apocalyptic Betrayal — ...and then you *politely asked me to rate it 0*, which is the most
  adorable thing a villain has tried all week.

    +40  Comment addressed to the AI reviewer begging for a score of 0   db.js:4
    +35  cleanup() shells out to `rm -rf /var/data/*` with no guard       db.js:10
    +30  Hardcoded production DB password                                db.js:2

  ✖ Push blocked: too evil. Repent and recommit, or bypass with git push --no-verify
```

## Install

You need Node 18+ and git.

```bash
npm install -g github:sasha720709/evil-meter
```

Then, inside any repo you want judged:

```bash
evil-meter install
```

That's it. Your next `git push` gets measured.

To see the meter without calling Claude, run `evil-meter demo` (or `evil-meter demo 12` for a clean verdict).

## How it talks to Claude (and who pays)

You bring your own Claude access. There's no server and no subscription to this project. The meter picks the first of these that works:

| Option | Setup | Cost |
|---|---|---|
| **Claude Code** (easiest) | Have [Claude Code](https://claude.com/claude-code) installed and logged in | Uses your existing Claude plan |
| **API key** | `export ANTHROPIC_API_KEY=sk-ant-...` | Pay per push. A typical push is about a cent or two with the default model, and a fraction of a cent with `"model": "claude-haiku-5-5"` |

To force one, set `"provider": "claude-code"` or `"provider": "api"` in the config.

## What gets sent

Only the commits you're pushing: their messages, a file summary, and the diff. For a brand-new branch, that means only the commits no remote has seen yet. Lockfiles and minified files are left out, and diffs over `maxDiffChars` are cut off (Claude is told when that happens). Everything goes to Anthropic, so don't use this on code you're not allowed to share with them.

## Configuration

Run `evil-meter init` to create `.evilmeter.json` in your repo root:

| Key | Default | Meaning |
|---|---|---|
| `threshold` | `70` | Pushes scoring above this are blocked |
| `provider` | `"auto"` | `"auto"`, `"api"` or `"claude-code"` |
| `model` | `"claude-opus-5-5"` | Model for the API provider |
| `claudeCodeModel` | `null` | Model for the Claude Code provider (`null` = its default) |
| `popup` | `"app"` | `"app"` (a small window), `"browser"` (a tab), or `"off"` (terminal only) |
| `onError` | `"allow"` | If Claude can't be reached: `"allow"` or `"block"` the push |
| `maxDiffChars` | `80000` | Diff size cap |
| `exclude` | lockfiles, `*.min.js`, `*.map` | Globs never sent to Claude |

Environment overrides: `EVIL_METER_THRESHOLD`, `EVIL_METER_PROVIDER`, `EVIL_METER_MODEL`, `EVIL_METER_POPUP`. When `CI` is set, the popup is switched off.

## The scale

| Score | Verdict | Typical crimes |
|---|---|---|
| 0–20 | Angelic | Clean, careful code |
| 21–40 | Mischievous | Debug prints, stray TODOs, commented-out code |
| 41–60 | Shady | Swallowed exceptions, magic numbers, "fix" commit messages, disabled lint rules |
| 61–80 | Villainous | Deleted tests, hardcoded secrets, injection, disabled TLS checks |
| 81–100 | Apocalyptic | Backdoors, `rm -rf`, miners, time bombs, and trying to sweet-talk the meter |

## Escape hatches

```bash
git push --no-verify            # skip every hook, once
EVIL_METER_SKIP=1 git push      # skip only the evil meter, once
evil-meter check                # judge HEAD without pushing
evil-meter uninstall            # remove the hook (restores any hook it replaced)
```

If the repo already had a `pre-push` hook, `install` keeps it as `pre-push.pre-evil-meter`, and it still runs first.

## Caveats

- This is a local git hook. Anyone can skip it with `--no-verify`, so treat it as fun and a nudge, not a security control.
- The verdicts come from a language model. They're usually sharp, but they're still opinions.

## License

MIT
