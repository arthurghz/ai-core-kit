#!/usr/bin/env python3
# =============================================================================
# dora.py -- ai-core-kit DORA "four keys" metrics from local git  (META layer)
# =============================================================================
# WHAT THIS IS
#   A stdlib-only, post-hoc analysis tool (a sibling of aggregate.py). It reads
#   the LOCAL git history -- no servers, no pip -- and computes the four DORA
#   "key" metrics over a window:
#
#     1. Deployment frequency   -- number of deploys in the window.
#     2. Lead time for changes  -- median (commit authored -> first deploy that
#                                  contains it).
#     3. Change failure rate    -- share of deploys followed by a failure marker
#                                  (revert / hotfix commit, or a failed CI run on
#                                  the deploy when `gh` is available).
#     4. Mean time to restore   -- median (failure marker -> next deploy that
#        (MTTR)                    resolves it).
#
# WHAT COUNTS AS A "DEPLOY"  (a heuristic; be honest about it)
#   Real DORA needs a deployment event stream, which a git repo does not have.
#   We approximate it with one of two configurable proxies (--deploy-mode):
#
#     tag     (DEFAULT) -- an annotated/lightweight tag matching --deploy-tag-glob
#                          (default "v*", e.g. v1.4.0) is one deploy. This is the
#                          most defensible proxy: a release tag is an explicit,
#                          human-marked release boundary. Lead time then means
#                          "authored -> first release tag that contains the
#                          commit", which is the canonical DORA definition.
#     merge   -- a merge commit onto the default branch (or any commit on it if
#                the project squash-merges) is one deploy. Use this for trunk-/
#                continuous-deployment repos that do not cut release tags. Lead
#                time then means "authored -> the merge/commit that landed it".
#
#   In BOTH modes the deploy carries a timestamp (the tagged commit's commit
#   date, or the merge commit date) and the SET of commits it newly contains
#   (commits reachable from this deploy but not from the previous one), which is
#   what lead-time and change-failure attribution need.
#
# WHAT COUNTS AS A "FAILURE"  (another heuristic)
#   A deploy is counted as a failure if ANY of the following is true:
#     * one of the commits it contains is a revert  (subject starts "Revert ",
#       or a `This reverts commit <sha>` body line);
#     * one of the commits it contains is a hotfix   (subject/branch/tag matches
#       --hotfix-glob, default "*hotfix*", case-insensitive; also "fix!:" /
#       a `[hotfix]` token);
#     * (only when `gh` is present and --use-gh) the latest CI check-run /
#       workflow conclusion for the deploy's commit SHA is "failure".
#   Change failure rate = failed_deploys / total_deploys.
#   MTTR pairs each failure marker (the revert/hotfix commit's time) with the
#   NEXT deploy at or after it, and takes the median of those deltas.
#
# LIMITS (print with --help; do not oversell)
#   * These are PROXIES. A squash-and-rebase repo, force-pushed history, or a
#     repo that deploys without tags will mis-estimate. Pick the --deploy-mode
#     that matches how YOU ship, and read the heuristic notes in the report.
#   * `gh` enrichment is best-effort: if `gh` is missing, unauthenticated, or
#     offline, CI-based failure detection is silently skipped (commit-based
#     revert/hotfix detection still runs). The report says which path was taken.
#   * Lead time uses AUTHOR date (when the work was written), not commit date,
#     per the DORA definition; clock skew / rebases can perturb it slightly.
#
# OUTPUT
#   --format text (default) | json | prom        (also --json / --prom shortcuts)
#   --since 30d | 12w | 2026-01-01               window lower bound
#   --window <same grammar>                       alias for --since
#   --selftest                                    run the offline math self-test
#                                                 on a synthetic fixture (no git)
#
# WHY OFFLINE, LIKE aggregate.py
#   No pip, no network required for the core metrics; everything comes from
#   `git` plumbing you already have. `gh` is the ONLY optional enrichment and it
#   degrades gracefully. The --prom mode emits Prometheus exposition text so the
#   existing exporter could surface DORA later without re-implementing the math.
# =============================================================================

import argparse
import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
from statistics import median


# ---------------------------------------------------------------------------
# errors
# ---------------------------------------------------------------------------
class DoraError(Exception):
    """Fatal, fail-loud DORA error (not a git repo, bad window, etc.)."""


# ---------------------------------------------------------------------------
# data model  (decoupled from git so the self-test can feed synthetic data)
# ---------------------------------------------------------------------------
# A "Commit" is a dict: {sha, author_ts, commit_ts, subject, body, is_merge}.
# A "Deploy"  is a dict: {id, ts, commits:[shas...]} where `commits` are the
#   commit SHAs this deploy NEWLY contains (delta from the previous deploy).
# All timestamps are tz-aware UTC datetimes.
#
# compute_dora() consumes (commits_by_sha, deploys, window_start, window_end)
# and never calls git -- so it is unit-testable on a hand-built fixture.


def _utc(ts):
    """Coerce an int epoch / ISO string / datetime to a tz-aware UTC datetime."""
    if isinstance(ts, _dt.datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=_dt.timezone.utc)
    if isinstance(ts, (int, float)):
        return _dt.datetime.fromtimestamp(ts, tz=_dt.timezone.utc)
    if isinstance(ts, str):
        return _dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    raise DoraError(f"cannot interpret timestamp: {ts!r}")


_REVERT_SUBJECT = re.compile(r"^Revert\b", re.IGNORECASE)
_REVERT_BODY = re.compile(r"^This reverts commit\b", re.IGNORECASE | re.MULTILINE)


def is_revert(commit):
    subj = commit.get("subject") or ""
    body = commit.get("body") or ""
    return bool(_REVERT_SUBJECT.search(subj) or _REVERT_BODY.search(body))


def _glob_to_re(glob):
    """Translate a shell glob (only * and ?) to an anchored, case-insensitive re."""
    out = ["(?i)^"]
    for ch in glob:
        if ch == "*":
            out.append(".*")
        elif ch == "?":
            out.append(".")
        else:
            out.append(re.escape(ch))
    out.append("$")
    return re.compile("".join(out))


def is_hotfix(commit, hotfix_re):
    """A commit is a hotfix if its subject matches the glob, or carries a
    conventional hotfix marker (`fix!:`, `[hotfix]`), or it sits on a hotfix
    branch/tag recorded on the commit (refs)."""
    subj = commit.get("subject") or ""
    if hotfix_re.match(subj):
        return True
    low = subj.lower()
    if low.startswith("fix!:") or "[hotfix]" in low:
        return True
    for ref in commit.get("refs") or []:
        if hotfix_re.match(ref):
            return True
    return False


# ---------------------------------------------------------------------------
# the core math  (pure; no git, no network -- this is what the self-test pins)
# ---------------------------------------------------------------------------
def compute_dora(commits_by_sha, deploys, window_start, window_end, hotfix_re,
                 ci_failed_shas=None):
    """Compute the four DORA keys from a pure data model.

    Args:
      commits_by_sha: {sha: commit-dict} for every commit referenced.
      deploys:        chronological list of deploy-dicts (id, ts, commits).
      window_start/window_end: tz-aware UTC bounds (deploys outside are dropped).
      hotfix_re:      compiled regex flagging a commit as a hotfix.
      ci_failed_shas: optional set of deploy commit-SHAs whose CI failed (gh).

    Returns a JSON-able result dict. Pure + deterministic.
    """
    ci_failed_shas = ci_failed_shas or set()

    # Window the deploys by their timestamp. Keep them in chronological order.
    win = [
        d for d in sorted(deploys, key=lambda d: _utc(d["ts"]))
        if window_start <= _utc(d["ts"]) <= window_end
    ]

    span_days = max((window_end - window_start).total_seconds() / 86400.0, 1e-9)

    # ---- 1. Deployment frequency ------------------------------------------
    n_deploys = len(win)
    per_day = n_deploys / span_days
    per_week = per_day * 7.0

    # ---- 2. Lead time for changes -----------------------------------------
    # For each deploy, every commit it NEWLY contains gets lead = deploy.ts -
    # commit.author_ts. Median across all (commit, deploy) pairs in the window.
    lead_secs = []
    for d in win:
        dts = _utc(d["ts"])
        for sha in d.get("commits", []):
            c = commits_by_sha.get(sha)
            if not c:
                continue
            delta = (dts - _utc(c["author_ts"])).total_seconds()
            if delta >= 0:  # a negative lead means clock skew/rebase -> drop
                lead_secs.append(delta)
    lead_median_secs = median(lead_secs) if lead_secs else None

    # ---- 3. Change failure rate -------------------------------------------
    # A deploy fails if it contains a revert/hotfix commit OR its commit SHA
    # has a failed CI run (gh). `failure_time` is the earliest such signal so
    # MTTR can pair it with the resolving deploy.
    failed = []  # list of (deploy, failure_ts)
    for d in win:
        fail_ts = None
        commit_failed = False
        for sha in d.get("commits", []):
            c = commits_by_sha.get(sha)
            if not c:
                continue
            if is_revert(c) or is_hotfix(c, hotfix_re):
                commit_failed = True
                cts = _utc(c["commit_ts"])
                fail_ts = cts if fail_ts is None else min(fail_ts, cts)
        ci_failed = d.get("sha") in ci_failed_shas
        if commit_failed or ci_failed:
            if fail_ts is None:  # CI-only failure -> use the deploy time
                fail_ts = _utc(d["ts"])
            failed.append((d, fail_ts))
    n_failed = len(failed)
    cfr = (n_failed / n_deploys) if n_deploys else None

    # ---- 4. Mean time to restore (MTTR) -----------------------------------
    # A failure is "restored" by the first deploy that ships AFTER the failing
    # deploy itself (the failing deploy cannot restore its own failure). We pair
    # each failure_ts with the timestamp of that next deploy and take the median
    # of (restore_deploy.ts - failure_ts). A failure with no later deploy in the
    # window is unresolved (excluded from MTTR but surfaced so it is not silently
    # dropped). Using the failing DEPLOY's ts as the search floor avoids counting
    # the failing deploy as its own restoration when the failure marker (a commit
    # date) predates that deploy.
    restore_secs = []
    unresolved = 0
    deploy_times = [_utc(d["ts"]) for d in win]
    for fdep, fts in failed:
        fdep_ts = _utc(fdep["ts"])
        nxt = None
        for dts in deploy_times:
            if dts > fdep_ts:
                nxt = dts
                break
        if nxt is None:
            unresolved += 1
        else:
            restore_secs.append((nxt - fts).total_seconds())
    mttr_median_secs = median(restore_secs) if restore_secs else None

    return {
        "window": {
            "start": window_start.isoformat(),
            "end": window_end.isoformat(),
            "span_days": round(span_days, 4),
        },
        "deployment_frequency": {
            "deploys": n_deploys,
            "per_day": round(per_day, 6),
            "per_week": round(per_week, 6),
            "rating": _rate_deploy_freq(per_day),
        },
        "lead_time_for_changes": {
            "median_seconds": (round(lead_median_secs, 3)
                               if lead_median_secs is not None else None),
            "median_human": _humanize(lead_median_secs),
            "sample_size": len(lead_secs),
            "rating": _rate_lead_time(lead_median_secs),
        },
        "change_failure_rate": {
            "rate": (round(cfr, 6) if cfr is not None else None),
            "failed_deploys": n_failed,
            "total_deploys": n_deploys,
            "rating": _rate_cfr(cfr),
        },
        "mean_time_to_restore": {
            "median_seconds": (round(mttr_median_secs, 3)
                               if mttr_median_secs is not None else None),
            "median_human": _humanize(mttr_median_secs),
            "sample_size": len(restore_secs),
            "unresolved_failures": unresolved,
            "rating": _rate_mttr(mttr_median_secs),
        },
    }


# ---------------------------------------------------------------------------
# DORA performance buckets  (Google's elite/high/medium/low, approximated)
# ---------------------------------------------------------------------------
def _rate_deploy_freq(per_day):
    if per_day is None:
        return "n/a"
    if per_day >= 1.0:            # multiple per day
        return "elite"
    if per_day >= 1 / 7.0:        # weekly+
        return "high"
    if per_day >= 1 / 30.0:       # monthly+
        return "medium"
    return "low"


def _rate_lead_time(secs):
    if secs is None:
        return "n/a"
    day = 86400.0
    if secs < day:
        return "elite"
    if secs < 7 * day:
        return "high"
    if secs < 30 * day:
        return "medium"
    return "low"


def _rate_cfr(cfr):
    if cfr is None:
        return "n/a"
    if cfr <= 0.15:
        return "elite/high"  # DORA elite & high both sit in the 0-15% band
    if cfr <= 0.30:
        return "medium"
    return "low"


def _rate_mttr(secs):
    if secs is None:
        return "n/a"
    hour = 3600.0
    day = 86400.0
    if secs < hour:
        return "elite"
    if secs < day:
        return "high"
    if secs < 7 * day:
        return "medium"
    return "low"


def _humanize(secs):
    if secs is None:
        return None
    secs = float(secs)
    if secs < 60:
        return f"{secs:.0f}s"
    mins = secs / 60.0
    if mins < 60:
        return f"{mins:.1f}m"
    hours = mins / 60.0
    if hours < 24:
        return f"{hours:.1f}h"
    days = hours / 24.0
    return f"{days:.1f}d"


# ---------------------------------------------------------------------------
# window parsing  (Nd / Nw / Nm grammar, or an absolute YYYY-MM-DD)
# ---------------------------------------------------------------------------
_REL = re.compile(r"^(\d+)\s*([dwmy])$", re.IGNORECASE)


def parse_window(since, now=None):
    """Return (window_start, window_end). `since` is '30d'|'12w'|'6m'|'1y' or an
    absolute YYYY-MM-DD. window_end is `now` (UTC). None/empty => 30d default."""
    now = now or _dt.datetime.now(_dt.timezone.utc)
    if not since:
        since = "30d"
    since = since.strip()
    m = _REL.match(since)
    if m:
        n = int(m.group(1))
        unit = m.group(2).lower()
        days = {"d": 1, "w": 7, "m": 30, "y": 365}[unit] * n
        return now - _dt.timedelta(days=days), now
    try:
        start = _dt.datetime.strptime(since, "%Y-%m-%d").replace(
            tzinfo=_dt.timezone.utc)
    except ValueError:
        raise DoraError(
            f"--since/--window must be like '30d', '12w', '6m', '1y' or "
            f"YYYY-MM-DD, got {since!r}")
    return start, now


# ---------------------------------------------------------------------------
# git plumbing  (the ONLY place that shells out; isolated for testability)
# ---------------------------------------------------------------------------
_UNIT_SEP = "\x1f"   # field sep inside a record
_REC_SEP = "\x1e"    # record sep between commits


def _run_git(args, repo):
    try:
        out = subprocess.run(
            ["git", "-C", repo, *args],
            capture_output=True, text=True, check=True,
        )
    except FileNotFoundError:
        raise DoraError("git not found on PATH; DORA needs a local git repo.")
    except subprocess.CalledProcessError as e:
        raise DoraError(
            f"git {' '.join(args)} failed (exit {e.returncode}): "
            f"{(e.stderr or '').strip()}")
    return out.stdout


def ensure_repo(repo):
    out = _run_git(["rev-parse", "--is-inside-work-tree"], repo).strip()
    if out != "true":
        raise DoraError(f"{repo!r} is not inside a git work tree.")


def default_branch(repo):
    """Best-effort default branch name: origin/HEAD -> main -> master -> HEAD."""
    try:
        ref = _run_git(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"],
                       repo).strip()
        if ref:
            return ref.rsplit("/", 1)[-1]
    except DoraError:
        pass
    for cand in ("main", "master"):
        try:
            _run_git(["rev-parse", "--verify", "--quiet", cand], repo)
            return cand
        except DoraError:
            continue
    return "HEAD"


def load_commits(repo, since_iso=None):
    """Return {sha: commit-dict} for the repo (optionally since a date).

    Fields: sha, author_ts, commit_ts (epoch ints), subject, body, is_merge,
    refs (decoration names: branches/tags pointing at the commit)."""
    fmt = _UNIT_SEP.join(["%H", "%at", "%ct", "%P", "%D", "%s", "%b"]) + _REC_SEP
    args = ["log", "--all", f"--pretty=format:{fmt}"]
    if since_iso:
        args.append(f"--since={since_iso}")
    raw = _run_git(args, repo)
    commits = {}
    for rec in raw.split(_REC_SEP):
        rec = rec.strip("\n")
        if not rec:
            continue
        parts = rec.split(_UNIT_SEP)
        if len(parts) < 7:
            continue
        sha, at, ct, parents, decoration, subject, body = parts[:7]
        refs = [r.strip() for r in decoration.split(",") if r.strip()] if decoration else []
        commits[sha] = {
            "sha": sha,
            "author_ts": int(at),
            "commit_ts": int(ct),
            "subject": subject,
            "body": body,
            "is_merge": len(parents.split()) > 1,
            "refs": refs,
        }
    return commits


def _commits_in_range(repo, lo_sha, hi_sha):
    """SHAs reachable from hi_sha but not lo_sha (the delta a deploy introduces).
    When lo_sha is None, all ancestors of hi_sha."""
    rng = f"{lo_sha}..{hi_sha}" if lo_sha else hi_sha
    out = _run_git(["rev-list", rng], repo)
    return [s for s in out.splitlines() if s.strip()]


def load_deploys_tag(repo, tag_glob, commits_by_sha):
    """Deploys = tags matching `tag_glob`, ordered by their commit date.

    Each deploy's `commits` is the delta of SHAs introduced since the previous
    tag (rev-list prev..tag), which is what lead-time/failure attribution use.
    """
    out = _run_git(
        ["tag", "--list", tag_glob,
         "--format=%(refname:short)%(if)%(*committerdate:unix)%(then)"
         "\x1f%(*committerdate:unix)\x1f%(*objectname)%(else)"
         "\x1f%(committerdate:unix)\x1f%(objectname)%(end)"],
        repo)
    rows = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("\x1f")
        if len(parts) != 3:
            continue
        name, ts, sha = parts
        try:
            rows.append((name, int(ts), sha))
        except ValueError:
            continue
    rows.sort(key=lambda r: r[1])  # chronological by (peeled) commit date
    deploys = []
    prev_sha = None
    for name, ts, sha in rows:
        introduced = _commits_in_range(repo, prev_sha, sha)
        deploys.append({"id": name, "ts": ts, "sha": sha, "commits": introduced})
        prev_sha = sha
    return deploys


def load_deploys_merge(repo, branch, commits_by_sha):
    """Deploys = first-parent commits on the default branch (each landing =
    one deploy). Each deploy's `commits` is the delta of SHAs it brought in
    relative to the previous first-parent commit (its second-parent line +
    itself), so squash- and merge-workflows both attribute sensibly."""
    out = _run_git(
        ["rev-list", "--first-parent", branch,
         "--pretty=format:%H\x1f%ct"], repo)
    # rev-list --pretty emits a "commit <sha>" header line before each record;
    # filter to our formatted lines (which contain the unit separator).
    fp = []
    for line in out.splitlines():
        if "\x1f" not in line:
            continue
        sha, ts = line.split("\x1f", 1)
        try:
            fp.append((sha, int(ts)))
        except ValueError:
            continue
    # rev-list is newest-first; reverse to chronological (oldest deploy first).
    fp.reverse()
    deploys = []
    prev_sha = None
    for sha, ts in fp:
        introduced = _commits_in_range(repo, prev_sha, sha)
        deploys.append({"id": sha[:12], "ts": ts, "sha": sha, "commits": introduced})
        prev_sha = sha
    return deploys


# ---------------------------------------------------------------------------
# optional gh enrichment  (CI failure detection; degrade gracefully)
# ---------------------------------------------------------------------------
def gh_available():
    return shutil.which("gh") is not None


def ci_failed_shas_via_gh(repo, deploys):
    """Return the subset of deploy SHAs whose latest CI conclusion is 'failure'.

    Best-effort: any error (gh missing, unauthenticated, offline, repo not on a
    supported host) yields an empty set and a note -- it NEVER raises. Uses
    `gh api` for the combined check-runs status of each deploy commit SHA.
    """
    if not gh_available():
        return set(), "gh not on PATH; CI-based failure detection skipped."
    # Resolve owner/repo from gh; if that fails, we cannot query checks.
    try:
        nwo = subprocess.run(
            ["gh", "repo", "view", "--json", "nameWithOwner", "-q",
             ".nameWithOwner"],
            cwd=repo, capture_output=True, text=True, check=True,
        ).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return set(), "gh could not resolve the GitHub repo; CI check skipped."
    if not nwo:
        return set(), "gh returned no repo; CI check skipped."

    failed = set()
    checked = 0
    for d in deploys:
        sha = d.get("sha")
        if not sha:
            continue
        try:
            res = subprocess.run(
                ["gh", "api",
                 f"repos/{nwo}/commits/{sha}/check-runs",
                 "-q", "[.check_runs[].conclusion] | any(. == \"failure\")"],
                cwd=repo, capture_output=True, text=True, check=True,
            ).stdout.strip()
            checked += 1
            if res == "true":
                failed.add(sha)
        except subprocess.CalledProcessError:
            continue  # this SHA has no checks / API hiccup -> not a failure
    return failed, f"gh CI check: queried {checked}/{len(deploys)} deploys ({nwo})."


# ---------------------------------------------------------------------------
# top-level: gather from git, then compute
# ---------------------------------------------------------------------------
def collect_and_compute(repo, deploy_mode, tag_glob, branch, hotfix_glob,
                        since, use_gh):
    ensure_repo(repo)
    window_start, window_end = parse_window(since)
    hotfix_re = _glob_to_re(hotfix_glob)

    # Load commits a little before the window so lead-time can reach back to the
    # authorship of commits a windowed deploy contains (git --since is on commit
    # date; we widen by loading all commits -- cheap for typical repos).
    commits_by_sha = load_commits(repo)

    if deploy_mode == "merge":
        branch = branch or default_branch(repo)
        deploys = load_deploys_merge(repo, branch, commits_by_sha)
    else:
        deploys = load_deploys_tag(repo, tag_glob, commits_by_sha)

    ci_failed, gh_note = (set(), "gh enrichment disabled (--use-gh not set).")
    if use_gh:
        ci_failed, gh_note = ci_failed_shas_via_gh(repo, deploys)

    result = compute_dora(
        commits_by_sha, deploys, window_start, window_end, hotfix_re,
        ci_failed_shas=ci_failed)
    result["meta"] = {
        "repo": os.path.abspath(repo),
        "deploy_mode": deploy_mode,
        "deploy_proxy": ("release tags matching %r" % tag_glob if deploy_mode == "tag"
                         else "first-parent commits on %r" % (branch or "default branch")),
        "hotfix_glob": hotfix_glob,
        "gh": gh_note,
        "total_commits_seen": len(commits_by_sha),
        "total_deploys_all_time": len(deploys),
    }
    return result


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------
def render_text(r):
    out = []
    out.append("=" * 72)
    out.append("ai-core-kit DORA report  (OFFLINE, from local git history)")
    m = r.get("meta", {})
    if m:
        out.append(f"repo={m.get('repo')}")
        out.append(f"deploy proxy: {m.get('deploy_proxy')}  |  "
                   f"hotfix glob: {m.get('hotfix_glob')}")
        out.append(f"gh: {m.get('gh')}")
    w = r["window"]
    out.append(f"window: {w['start']}  ..  {w['end']}  ({w['span_days']:.1f} days)")
    out.append("=" * 72)

    df = r["deployment_frequency"]
    out.append("")
    out.append("1. Deployment frequency")
    out.append(f"   deploys in window : {df['deploys']}")
    out.append(f"   per day / per week: {df['per_day']:.3f} / {df['per_week']:.3f}")
    out.append(f"   rating            : {df['rating']}")

    lt = r["lead_time_for_changes"]
    out.append("")
    out.append("2. Lead time for changes  (commit authored -> first deploy)")
    out.append(f"   median            : {lt['median_human'] or 'n/a'}")
    out.append(f"   sample size       : {lt['sample_size']} commits")
    out.append(f"   rating            : {lt['rating']}")

    cf = r["change_failure_rate"]
    rate_s = "n/a" if cf["rate"] is None else f"{cf['rate'] * 100:.1f}%"
    out.append("")
    out.append("3. Change failure rate  (deploys followed by revert/hotfix/CI-fail)")
    out.append(f"   rate              : {rate_s}  "
               f"({cf['failed_deploys']}/{cf['total_deploys']} deploys)")
    out.append(f"   rating            : {cf['rating']}")

    mt = r["mean_time_to_restore"]
    out.append("")
    out.append("4. Mean time to restore (MTTR)  (failure marker -> next deploy)")
    out.append(f"   median            : {mt['median_human'] or 'n/a'}")
    out.append(f"   resolved/unresolved: {mt['sample_size']} / {mt['unresolved_failures']}")
    out.append(f"   rating            : {mt['rating']}")

    out.append("")
    out.append("-" * 72)
    out.append("HEURISTIC NOTE: deploys/failures are PROXIES from git, not a real")
    out.append("deployment stream. Pick --deploy-mode to match how you ship; see")
    out.append("--help for the exact definitions and limits.")
    out.append("=" * 72)
    return "\n".join(out)


_PROM_HELP = {
    "ack_dora_deploys_total": ("gauge", "Number of deploys (proxy) in the window."),
    "ack_dora_deploy_frequency_per_day": ("gauge", "Deploys per day over the window."),
    "ack_dora_deploy_frequency_per_week": ("gauge", "Deploys per week over the window."),
    "ack_dora_lead_time_seconds": ("gauge", "Median lead time for changes, seconds (commit authored -> first deploy)."),
    "ack_dora_change_failure_rate": ("gauge", "Share of deploys followed by a failure marker (0..1)."),
    "ack_dora_failed_deploys_total": ("gauge", "Number of deploys flagged as failures."),
    "ack_dora_mttr_seconds": ("gauge", "Median mean-time-to-restore, seconds (failure -> next deploy)."),
    "ack_dora_window_span_days": ("gauge", "Span of the analysis window in days."),
}


def render_prom(r):
    df = r["deployment_frequency"]
    lt = r["lead_time_for_changes"]
    cf = r["change_failure_rate"]
    mt = r["mean_time_to_restore"]
    vals = {
        "ack_dora_deploys_total": df["deploys"],
        "ack_dora_deploy_frequency_per_day": df["per_day"],
        "ack_dora_deploy_frequency_per_week": df["per_week"],
        "ack_dora_lead_time_seconds": lt["median_seconds"],
        "ack_dora_change_failure_rate": cf["rate"],
        "ack_dora_failed_deploys_total": cf["failed_deploys"],
        "ack_dora_mttr_seconds": mt["median_seconds"],
        "ack_dora_window_span_days": r["window"]["span_days"],
    }
    lines = []
    for name, val in vals.items():
        typ, help_txt = _PROM_HELP[name]
        lines.append(f"# HELP {name} {help_txt}")
        lines.append(f"# TYPE {name} {typ}")
        # A None metric (no data) is emitted as NaN so Prometheus records "no
        # sample" rather than a misleading 0.
        v = "NaN" if val is None else (val if isinstance(val, (int, float)) else float(val))
        lines.append(f"{name} {v}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# self-test  (pins the metric MATH on a synthetic, git-free fixture)
# ---------------------------------------------------------------------------
def _selftest():
    """Run the four-key math on a hand-built fixture and assert exact values.

    Timeline (all UTC; days numbered from an epoch base):
      day 0  c1 authored
      day 1  c2 authored
      day 2  DEPLOY v1 (contains c1, c2)                 -> leads 2d, 1d
      day 3  c3 authored (a normal change)
      day 4  c4 = "Revert ..."  (a failure marker, commit_ts day 4)
      day 5  DEPLOY v2 (contains c3, c4)  -> FAILED (revert); leads 2d, 1d
      day 6  c5 = "hotfix: patch the regression" (hotfix marker, commit_ts d6)
      day 7  DEPLOY v3 (contains c5)      -> FAILED (hotfix); lead 1d
      day 9  DEPLOY v4 (contains nothing new) -> clean; restores v3's failure
    """
    base = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)
    day = lambda n: base + _dt.timedelta(days=n)
    epoch = lambda n: int(day(n).timestamp())

    def C(sha, a, c, subj, body=""):
        return {"sha": sha, "author_ts": epoch(a), "commit_ts": epoch(c),
                "subject": subj, "body": body, "is_merge": False, "refs": []}

    commits = {c["sha"]: c for c in [
        C("c1", 0, 0, "feat: one"),
        C("c2", 1, 1, "feat: two"),
        C("c3", 3, 3, "feat: three"),
        C("c4", 4, 4, "Revert \"feat: three\"", "This reverts commit c3."),
        C("c5", 6, 6, "hotfix: patch the regression"),
    ]}
    deploys = [
        {"id": "v1", "ts": epoch(2), "sha": "dv1", "commits": ["c1", "c2"]},
        {"id": "v2", "ts": epoch(5), "sha": "dv2", "commits": ["c3", "c4"]},
        {"id": "v3", "ts": epoch(7), "sha": "dv3", "commits": ["c5"]},
        {"id": "v4", "ts": epoch(9), "sha": "dv4", "commits": []},
    ]
    win_start, win_end = day(0), day(10)
    hotfix_re = _glob_to_re("*hotfix*")
    r = compute_dora(commits, deploys, win_start, win_end, hotfix_re)

    failures = []

    def check(label, got, want):
        if got != want:
            failures.append(f"{label}: got {got!r}, want {want!r}")

    DAY = 86400.0
    # 1. Deployment frequency: 4 deploys over a 10-day window.
    check("deploys", r["deployment_frequency"]["deploys"], 4)
    check("per_day", round(r["deployment_frequency"]["per_day"], 6), round(4 / 10.0, 6))
    # 2. Lead time: pairs (in days) = v1:[2,1], v2:[2,1], v3:[1] -> [2,1,2,1,1]
    #    sorted [1,1,1,2,2] median = 1 day.
    check("lead_sample", r["lead_time_for_changes"]["sample_size"], 5)
    check("lead_median_s", r["lead_time_for_changes"]["median_seconds"], round(1 * DAY, 3))
    # 3. Change failure rate: v2 (revert) + v3 (hotfix) failed of 4 -> 0.5.
    check("failed_deploys", r["change_failure_rate"]["failed_deploys"], 2)
    check("cfr", r["change_failure_rate"]["rate"], round(2 / 4.0, 6))
    # 4. MTTR: v2 failure_ts = c4 commit day4 -> next deploy v3 day7 => 3d.
    #          v3 failure_ts = c5 commit day6 -> next deploy v4 day9 => 3d.
    #    median([3d,3d]) = 3 days; 0 unresolved.
    check("mttr_sample", r["mean_time_to_restore"]["sample_size"], 2)
    check("mttr_median_s", r["mean_time_to_restore"]["median_seconds"], round(3 * DAY, 3))
    check("mttr_unresolved", r["mean_time_to_restore"]["unresolved_failures"], 0)

    # --- secondary fixtures: edge cases -----------------------------------
    # (a) no deploys -> all-None metrics, no crash.
    r0 = compute_dora({}, [], win_start, win_end, hotfix_re)
    check("empty_deploys", r0["deployment_frequency"]["deploys"], 0)
    check("empty_lead", r0["lead_time_for_changes"]["median_seconds"], None)
    check("empty_cfr", r0["change_failure_rate"]["rate"], None)
    check("empty_mttr", r0["mean_time_to_restore"]["median_seconds"], None)

    # (b) windowing actually drops out-of-window deploys.
    r1 = compute_dora(commits, deploys, day(6), day(10), hotfix_re)
    check("windowed_deploys", r1["deployment_frequency"]["deploys"], 2)  # v3, v4

    # (c) CI-only failure (no revert/hotfix commit) is detected via gh set.
    plain = {"x1": C("x1", 0, 0, "feat: plain")}
    dps = [{"id": "p1", "ts": epoch(1), "sha": "PSHA", "commits": ["x1"]},
           {"id": "p2", "ts": epoch(2), "sha": "QSHA", "commits": []}]
    rci = compute_dora(plain, dps, day(0), day(3), hotfix_re,
                       ci_failed_shas={"PSHA"})
    check("ci_failed", rci["change_failure_rate"]["failed_deploys"], 1)
    check("ci_mttr_s", rci["mean_time_to_restore"]["median_seconds"], round(1 * DAY, 3))

    # (d) parse_window grammar.
    ws, we = parse_window("30d", now=day(30))
    check("win_30d", round((we - ws).total_seconds() / DAY), 30)
    ws2, _ = parse_window("2w", now=day(30))
    check("win_2w", round((day(30) - ws2).total_seconds() / DAY), 14)
    try:
        parse_window("banana")
        failures.append("parse_window: 'banana' should have raised")
    except DoraError:
        pass

    # (e) prom + text render without raising, and prom emits NaN for None.
    _ = render_text(r)
    prom = render_prom(r0)
    if "NaN" not in prom:
        failures.append("render_prom: empty result should emit NaN samples")

    if failures:
        print("DORA SELFTEST: FAIL", file=sys.stderr)
        for f in failures:
            print("  - " + f, file=sys.stderr)
        return 1
    print("DORA SELFTEST: PASS (4 keys + edge cases verified on synthetic fixture)")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser():
    ap = argparse.ArgumentParser(
        prog="dora.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(
            "Compute the four DORA keys from LOCAL git history (stdlib-only, "
            "offline; optional `gh` enrichment).\n\n"
            "HEURISTICS (these are PROXIES, not a real deployment stream):\n"
            "  deploy   = a release tag matching --deploy-tag-glob (default v*),\n"
            "             OR a first-parent commit on the default branch when\n"
            "             --deploy-mode merge. Lead time = commit authored ->\n"
            "             first deploy that contains it (DORA's definition).\n"
            "  failure  = a deploy that contains a revert or hotfix commit, or\n"
            "             (with --use-gh) whose commit SHA has a failed CI run.\n"
            "  MTTR     = median(failure marker -> next deploy that resolves it).\n\n"
            "LIMITS: squash/rebase/force-push histories and tag-less deploy flows\n"
            "        will mis-estimate; gh enrichment degrades silently if gh is\n"
            "        missing/offline. Choose the --deploy-mode that fits how you\n"
            "        actually ship, and treat the ratings as directional."
        ),
    )
    ap.add_argument("--repo", default=".",
                    help="path to the git work tree (default: .)")
    ap.add_argument("--since", "--window", dest="since", default="30d",
                    help="window lower bound: 30d|12w|6m|1y or YYYY-MM-DD (default 30d)")
    ap.add_argument("--deploy-mode", choices=("tag", "merge"), default="tag",
                    help="what counts as a deploy: release tag (default) or "
                         "first-parent commit on the default branch")
    ap.add_argument("--deploy-tag-glob", default="v*",
                    help="tag glob that marks a release/deploy (tag mode; default v*)")
    ap.add_argument("--branch", default=None,
                    help="default branch for merge mode (default: auto-detect)")
    ap.add_argument("--hotfix-glob", default="*hotfix*",
                    help="glob marking a commit subject/ref as a hotfix (default *hotfix*)")
    ap.add_argument("--use-gh", action="store_true",
                    help="enrich change-failure with `gh` CI conclusions (best-effort)")
    ap.add_argument("--format", choices=("text", "json", "prom"), default="text",
                    help="output format (default: text)")
    ap.add_argument("--json", action="store_true", help="shortcut for --format json")
    ap.add_argument("--prom", action="store_true",
                    help="shortcut for --format prom (Prometheus exposition text)")
    ap.add_argument("--selftest", action="store_true",
                    help="run the offline metric self-test on a synthetic fixture and exit")
    return ap


def main(argv=None):
    ap = build_parser()
    args = ap.parse_args(argv)

    if args.selftest:
        return _selftest()

    fmt = args.format
    if args.json:
        fmt = "json"
    if args.prom:
        fmt = "prom"

    try:
        result = collect_and_compute(
            repo=args.repo,
            deploy_mode=args.deploy_mode,
            tag_glob=args.deploy_tag_glob,
            branch=args.branch,
            hotfix_glob=args.hotfix_glob,
            since=args.since,
            use_gh=args.use_gh,
        )
    except DoraError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 1

    if fmt == "json":
        print(json.dumps(result, indent=2, sort_keys=False))
    elif fmt == "prom":
        sys.stdout.write(render_prom(result))
    else:
        print(render_text(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
