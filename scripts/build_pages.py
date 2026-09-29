"""Generate the static route pages (about/, report/, prop-N/) from index.html.

Each page is a copy of index.html with its own <title>, description, canonical
URL and Open Graph / Twitter tags, so shared links get a per-page preview card.
The app itself (app.js) routes on the URL path, so every page boots the same UI.

Usage (PowerShell):  python scripts/build_pages.py
Re-run after editing index.html or data/measures.json. Run scripts/build_og.js
first if you want new card images.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://fineprintca.com"
data = json.loads((ROOT / "data" / "measures.json").read_text(encoding="utf-8"))
template = (ROOT / "index.html").read_text(encoding="utf-8")

START, END = "<!--OG:START-->", "<!--OG:END-->"
assert START in template and END in template, "index.html is missing the OG markers"


def og_block(path, title, description, image, og_type="article"):
    e = html.escape
    url = f"{SITE}{path}"
    return f"""{START}
  <title>{e(title)}</title>
  <meta name="description" content="{e(description)}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="Fine Print CA">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:image" content="{SITE}/og/{image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{e(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(title)}">
  <meta name="twitter:description" content="{e(description)}">
  <meta name="twitter:image" content="{SITE}/og/{image}">
  {END}"""


def write_page(path, title, description, image, og_type="article"):
    block = og_block(path, title, description, image, og_type)
    page = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, template, flags=re.S)
    out = ROOT / path.strip("/") / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out


written = []
written.append(write_page("/about/", "How Fine Print CA works",
    "Neutral by construction: every measure gets the same template, both sides get the same boxes, and 'what it leaves out' is sourced from the official voter guide and the Legislative Analyst.",
    "site.png", "website"))
written.append(write_page("/report/", "I saw an ad — Fine Print CA",
    "Saw a California ballot-measure ad? Tell us what it claimed and where you saw it. We'll check it against the measure text and add it to the page. Both sides welcome.",
    "site.png", "website"))

for m in data["measures"]:
    n = m["number"]
    title = f"Prop {n}: {m['short_title']} — what the ads leave out"
    desc = (m.get("what_it_does") or "")[:200].rsplit(" ", 1)[0] + "…"
    written.append(write_page(f"/prop-{n}/", title, desc, f"prop-{n}.png"))

# Redirect helper for any old hash-style links is handled client-side in app.js.
print(f"wrote {len(written)} pages:")
for w in written:
    print("  ", w.relative_to(ROOT))
