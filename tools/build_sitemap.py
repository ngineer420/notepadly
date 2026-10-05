#!/usr/bin/env python3
"""Generate sitemap.xml for a hand-duplicated site in the portfolio.

The four `<lastmod>` dates in this repo were typed by hand. A date typed by
hand is a date nobody updates, so every entry read 2026-09-23 whether the page
had changed that day or not. This script computes each date instead.

Stdlib only, no build step. `nav_data.py` next to it holds the two site-specific
tables, `SITE` and `SITEMAP`, exactly as `sync_nav.py` reads its own.

    python3 tools/build_sitemap.py            Rewrite sitemap.xml.
    python3 tools/build_sitemap.py --check    Exit 1 when sitemap.xml is stale.

How the date is chosen, in this order:

    today            if the file is dirty or untracked in the working tree
    git log -1       otherwise
    the file mtime   only where git cannot answer at all

The dirty test is what makes the number converge. The sitemap is written BEFORE
the commit that ships it, so `git log -1` on a page this run just changed
returns the PREVIOUS commit's day. The moment the commit lands, that page's
last commit is the new one, a rebuild moves the date forward, and `--check` on
a clean tree fails with nothing actually changed.

Dating a dirty file today closes the loop:

  * Clean tree, nothing edited. Every date is its last-commit date, the file on
    disk matches, and `--check` passes.
  * A page is edited. The page is dirty, so its date is today and the sitemap
    says today. Both are committed. Now nothing is dirty and the page's last
    commit is today, so the date is still today. `--check` passes.

One residual is accepted rather than hidden: a branch merged on a later day
than it was built moves every date to the merge day, so the committed sitemap
lags by one rebuild. That is one rebuild and one commit to settle, and the page
really did land on the merge day, so the new date is not a lie.

The mtime is never the primary source. A fresh clone gives every file the same
mtime and `git pull` rewrites them, so an mtime-based `--check` fails the next
day with every URL moved forward and nothing changed.
"""

import argparse
import datetime
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nav_data as D  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sitemap.xml"

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def path_for(url_path):
    """The file in this repo that serves a site-root-relative URL."""
    rel = url_path.lstrip("/")
    if rel == "" or rel.endswith("/"):
        rel += "index.html"
    return ROOT / rel


def dirty_paths():
    """Every path git reports as changed or untracked, repo-relative, posix.

    One call for the whole repo. A call per URL would ask git the same question
    four times and get the same answer.

    `--porcelain -z` writes NUL-separated entries and never quotes or escapes a
    path, so a name with a space or a non-ASCII character survives. Columns 0
    and 1 hold the status code, column 2 is a space, and the path starts at
    column 3. A rename or copy entry is two NUL-separated fields, "old" then
    "new"; the second is the file that exists now, so take it and drop the
    first.

    Returns None when git cannot answer, which is not the same as an empty set:
    an empty set means the tree is clean, None means there is no tree to read.
    """
    try:
        out = subprocess.run(["git", "status", "--porcelain", "-z"],
                             cwd=ROOT, capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    fields = out.stdout.split("\0")
    paths, i = set(), 0
    while i < len(fields):
        entry, i = fields[i], i + 1
        if not entry:
            continue
        code, path = entry[:2], entry[3:]
        if "R" in code or "C" in code:
            if i < len(fields):
                path, i = fields[i], i + 1
        if path:
            paths.add(path)
    return paths


def last_commit_date(path):
    """The day of the last commit that touched this file, or None."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", str(path)],
            cwd=ROOT, capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    date = out.stdout.strip()
    return date if DATE_RE.fullmatch(date) else None


def lastmod(path, dirty):
    if dirty is not None and path.relative_to(ROOT).as_posix() in dirty:
        return datetime.date.today().isoformat()
    date = last_commit_date(path)
    if date:
        return date
    return datetime.date.fromtimestamp(path.stat().st_mtime).isoformat()


def render():
    dirty = dirty_paths()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url_path, changefreq, priority in D.SITEMAP:
        path = path_for(url_path)
        if not path.exists():
            raise SystemExit("sitemap lists %s but %s does not exist"
                             % (url_path, path.relative_to(ROOT).as_posix()))
        lines += ["  <url>",
                  "    <loc>%s%s</loc>" % (D.SITE, url_path),
                  "    <lastmod>%s</lastmod>" % lastmod(path, dirty),
                  "    <changefreq>%s</changefreq>" % changefreq,
                  "    <priority>%s</priority>" % priority,
                  "  </url>"]
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main(argv):
    ap = argparse.ArgumentParser(description="Generate sitemap.xml.")
    ap.add_argument("--check", action="store_true",
                    help="exit 1 when sitemap.xml is stale")
    args = ap.parse_args(argv)

    wanted = render()
    current = OUT.read_text(encoding="utf-8") if OUT.exists() else None

    if args.check:
        if current == wanted:
            print("sitemap.xml is current (%d urls)" % len(D.SITEMAP))
            return 0
        print("sitemap.xml is stale")
        return 1

    if current == wanted:
        print("sitemap.xml unchanged (%d urls)" % len(D.SITEMAP))
        return 0
    OUT.write_text(wanted, encoding="utf-8")
    print("wrote sitemap.xml (%d urls)" % len(D.SITEMAP))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
