#!/usr/bin/env python3
"""Generate an index.html for GitHub Pages that links to every file in the repo.

Run it from the repo root:  python generate_index.py
Then commit the resulting index.html.
"""

import datetime as dt
import html
from pathlib import Path
from urllib.parse import quote

# ---- Config -------------------------------------------------------------
# Where is your repo? Leave as None to auto-detect (works for a normal script).
# In Databricks, auto-detect won't find your repo — set this explicitly to your
# Git folder path, e.g.:
#   REPO_ROOT = "/Workspace/Repos/you@example.com/your-repo"
REPO_ROOT = None

SITE_TITLE = "Repository Index"

if REPO_ROOT is not None:
    REPO_ROOT = Path(REPO_ROOT)
    SCRIPT_NAME = "generate_index.py"
else:
    # __file__ exists when run as a script, but not in notebooks; fall back to cwd.
    try:
        REPO_ROOT = Path(__file__).resolve().parent
        SCRIPT_NAME = Path(__file__).name
    except NameError:
        REPO_ROOT = Path.cwd()
        SCRIPT_NAME = "generate_index.py"

OUTPUT = REPO_ROOT / "index.html"

# Directory or file names to skip entirely.
EXCLUDE_NAMES = {".git", ".github", "node_modules", "__pycache__", ".DS_Store"}
# Skip hidden files/dirs (names starting with ".") in addition to the above.
SKIP_HIDDEN = True
# ------------------------------------------------------------------------

EXCLUDE_FILES = {OUTPUT.name, SCRIPT_NAME}


def should_skip(rel: Path) -> bool:
    parts = rel.parts
    if any(p in EXCLUDE_NAMES for p in parts):
        return True
    if SKIP_HIDDEN and any(p.startswith(".") for p in parts):
        return True
    return False


def collect_files():
    files = []
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(REPO_ROOT)
        if should_skip(rel) or rel.name in EXCLUDE_FILES:
            continue
        files.append(rel)
    return sorted(files, key=lambda p: p.parts)


def build_tree(files):
    """Nest files into a dict keyed by directory; files live under '__files__'."""
    tree = {}
    for rel in files:
        node = tree
        for part in rel.parts[:-1]:
            node = node.setdefault(part, {})
        node.setdefault("__files__", []).append(rel)
    return tree


def render_tree(node) -> str:
    out = ["<ul>"]
    for name in sorted(k for k in node if k != "__files__"):
        out.append(f'<li class="dir"><span class="folder">{html.escape(name)}/</span>')
        out.append(render_tree(node[name]))
        out.append("</li>")
    for rel in node.get("__files__", []):
        href = html.escape(quote("/".join(rel.parts)))   # URL-safe relative path
        name = html.escape(rel.name)
        out.append(f'<li class="file"><a href="{href}">{name}</a></li>')
    out.append("</ul>")
    return "\n".join(out)


def main():
    if not REPO_ROOT.is_dir():
        raise SystemExit(
            f"\nREPO_ROOT does not exist: {REPO_ROOT}\n"
            "Set it to your repo folder. In Databricks the path usually starts with\n"
            "/Workspace, e.g.  REPO_ROOT = \"/Workspace/Repos/you@example.com/your-repo\"\n"
            "Tip: right-click the Git folder in the sidebar -> Copy path, and add the\n"
            "/Workspace prefix if it's missing.\n"
        )
    files = collect_files()
    tree = build_tree(files)
    listing = render_tree(tree)
    generated = dt.datetime.now().strftime("%Y-%m-%d %H:%M")

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(SITE_TITLE)}</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 760px; margin: 3rem auto; padding: 0 1.25rem;
    line-height: 1.5; color: #1a1a1a; background: #fafafa;
  }}
  @media (prefers-color-scheme: dark) {{
    body {{ color: #e6e6e6; background: #161616; }}
    a {{ color: #6fb3ff; }}
    .folder {{ color: #b9b9b9; }}
  }}
  h1 {{ font-size: 1.5rem; margin-bottom: .25rem; }}
  .meta {{ color: #888; font-size: .85rem; margin-bottom: 1.75rem; }}
  ul {{ list-style: none; padding-left: 1.1rem; margin: .25rem 0; }}
  li {{ margin: .15rem 0; }}
  .folder {{ font-weight: 600; }}
  a {{ text-decoration: none; color: #0b62d6; }}
  a:hover {{ text-decoration: underline; }}
  li.file::before {{ content: "\\1F4C4  "; }}
  li.dir > .folder::before {{ content: "\\1F4C1  "; }}
</style>
</head>
<body>
  <h1>{html.escape(SITE_TITLE)}</h1>
  <p class="meta">{len(files)} files &middot; generated {generated}</p>
  {listing}
</body>
</html>
"""
    OUTPUT.write_text(doc, encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(files)} files indexed)")


if __name__ == "__main__":
    main()
