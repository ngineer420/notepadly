"""blanknotepad.com navigation data — the single source of truth for the toolbar.

This is the ONLY file that differs between sites. `sync_nav.py` is generic and
copies verbatim. Nothing here is computed at runtime by the browser: sync_nav
renders it into the static HTML of every page.

blanknotepad.com is the portfolio's one-tool site. The notepad IS the site, so
there is no set of sibling tools to rail across and the tier rule (a page is
tier 1 only if it answers a different question) has exactly one tool to sort.
The toolbar therefore carries this site's four real destinations and invents
nothing: the notepad itself, About, Privacy and Terms. Sibling SITES are a
different job and live in the footer's related-tools block, where a visitor
looks for them, not in the chrome that navigates this site.

Four destinations is under the renderer's group threshold of nine, so the sheet
comes out as one flat list and GROUPS is never read. The keys stay declared so
the file has the same shape as every other site's, and so a fifth page can be
added without a redesign.

NOUN is "pages", not "tools". "All 4 tools" would be a lie on a site with one
tool, and the count in the trigger is the affordance that tells a visitor how
much is behind it — a wrong noun there is worse than no trigger at all.

The four links were in the header until the mobile audit: flex-wrap broke them
onto a second row below 500px and the header grew from 54px to 99px. They moved
to the footer, which left every page with no chrome-level route to anything.
The rail is the fix for both faults at once — one row that never wraps, and a
native scroll container when the row runs out of width.
"""

# Noun used in the menu trigger: "All 4 pages".
NOUN = "pages"

# Tier-1 destinations, in rail order.
#   label -> rail chip text, <= 18 chars
#   long  -> anchor text in the sheet
#   group -> sheet grouping key, unread below 9 destinations but already decided
TOOLS = [
    {"href": "/",             "label": "Notepad", "long": "Blank Notepad",       "group": "write", "tier": 1},
    {"href": "/about.html",   "label": "About",   "long": "About Blank Notepad", "group": "site",  "tier": 1},
    {"href": "/privacy.html", "label": "Privacy", "long": "Privacy Policy",      "group": "site",  "tier": 1},
    {"href": "/terms.html",   "label": "Terms",   "long": "Terms of Use",        "group": "site",  "tier": 1},
]

# Sheet groups, in order. Unread at four destinations: the renderer draws one
# flat list below nine. Declared so the shape matches the other sites.
GROUPS = [
    ("write", "Write"),
    ("site", "About this site"),
]

# No category hub page exists on this site, so there is nothing to link here.
HUBS = []

# No tier-2 family here.
FOOTER = []

# ---------------------------------------------------------------------------
# The footer's peers region: the sibling sites, then one route to a person.
#
# These were hand-copied into the footer of all five pages, which is how five
# copies of a block drift. `sync_nav.py` renders the region now, so the block
# has one owner and `--check` catches a page that falls behind.
#
# Link text is each site's own meta description, so the promise on the link is
# the promise on the page it lands on.
PEERS = [
    ("https://drawlots.net/", "Spinners, dice and random pickers", "drawlots.net"),
    ("https://clocklab.net/", "Timers, stopwatch and world clock", "clocklab.net"),
    ("https://paperprintouts.com/", "Printable graph, lined and staff paper", "paperprintouts.com"),
    ("https://textkitpro.com/", "Text cleanup, conversion and comparison", "textkitpro.com"),
]

# The contact address, in plain text. `sync_nav.py` encodes every character of
# the href and the link text as a decimal numeric character reference before it
# writes them, so neither "@" nor "mailto:hello" appears in the bytes a scraper
# downloads. The HTML parser decodes them while it parses, so the anchor keeps
# a real mailto: URL, its place in the tab order, and a plain address for a
# screen reader. No JavaScript is involved.
#
# The sentence names the notepad, not "a tool". This site is one notepad and
# has no tool collection, so "a problem with a tool" would ask about something
# that is not here.
CONTACT_ADDRESS = "hello@goodbotbad.bot"
CONTACT_TEXT = "Questions or a problem with the notepad?"

# ---------------------------------------------------------------------------
# Sitemap. One row per indexed page: the path, how often it changes, and its
# priority. `<lastmod>` is NOT here — `build_sitemap.py` computes it from git,
# because a date written by hand is a date nobody updates.
#
# 404.html is absent on purpose. A crawler must not be invited to index it.
SITE = "https://blanknotepad.com"

SITEMAP = [
    ("/", "weekly", "1.0"),
    ("/about.html", "monthly", "0.5"),
    ("/privacy.html", "yearly", "0.2"),
    ("/terms.html", "yearly", "0.2"),
]

# The marker pairs are already in every page, so --migrate has nothing to do.
MIGRATE = []
