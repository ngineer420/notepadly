# Blank Notepad

A distraction-free online notepad at [blanknotepad.com](https://blanknotepad.com). The site is static HTML, CSS, and JavaScript on GitHub Pages. Every note stays in the browser. Nothing goes to a server.

## Offline

A service worker at `sw.js` precaches the site. After the first visit, each page opens without a network connection.

The worker caches these files:

- Every page in `sitemap.xml`
- Every same-origin stylesheet and script that those pages load

`tools/build_sw.py` generates `sw.js`. The precache list comes from `sitemap.xml` and from the `<link rel="stylesheet">` and `<script src>` tags in each page. Nobody types the list by hand.

The cache name is `blanknotepad-` plus a 12-character hash of every precached file. A change to any precached file gives a new cache name. The new worker deletes the old cache when it activates.

The worker handles only GET requests to this origin. It never reads and never caches the AdSense script or any other third-party request.

Before a deploy:

1. Run `python3 tools/build_sw.py` to rewrite `sw.js`.
2. Run `python3 tools/build_sw.py --check` to make sure that `sw.js` is current. The command exits with code 1 when `sw.js` is stale.
3. Commit `sw.js` with the change.
