"""Drive the BUILT site in a real browser: nav, /skills index, cover images."""
import functools, http.server, sys, threading
sys.path.insert(0, '.cerebro-tools')
from cdp import Browser

SHOTS = 'C:/Users/seanm/.cerebro/data/cerebro/media'


def serve_dist():
    """Serve ./dist on a FREE port, in-process.

    This used to point at a hard-coded 127.0.0.1:4330 that something else was
    expected to be serving. When nothing was listening, Chrome rendered its
    own error page and the checks below happily reported `broken=0` on it —
    a dead server looked like a pass. Own the server, own the port.
    """
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass  # one line per asset drowns the actual findings

    handler = functools.partial(Handler, directory='dist')
    # Chrome drops keep-alive sockets; that is not an error worth a traceback.
    class Quiet(http.server.ThreadingHTTPServer):
        def handle_error(self, *a):
            pass

    srv = Quiet(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, 'http://127.0.0.1:%d' % srv.server_address[1]


SERVER, BASE = serve_dist()
print('serving ./dist at %s' % BASE)

PAGES = [
    ('/', 'home', '/'),
    ('/projects', 'projects', '/projects'),
    ('/skills', 'skills-index', '/skills'),
    ('/skills/welding-fabrication', 'skills-detail', '/skills'),
    ('/projects/giulietta-spyder-veloce', 'project-detail', '/projects'),
]

fails = []
with Browser() as b:
    for path, name, expect_active in PAGES:
        b.goto(BASE + path, settle=1.0)
        # Force every image to load now — lazy-loading below the fold made a
        # clean page look broken on the first pass of cycle 1.
        b.eval("Array.from(document.images).forEach(i => i.loading = 'eager');")
        try:
            b.wait_for("Array.from(document.images).every(i => i.complete)",
                       timeout=25, label=path + ' images complete')
        except RuntimeError as e:
            fails.append('%s: %s' % (path, e))

        # Prove the page is OURS before trusting anything measured on it.
        # A connection error still yields a document with images in it.
        title = b.eval('document.title')
        h1 = b.eval("document.querySelector('h1')?.textContent?.trim() || ''")
        if 'Sean Melotti' not in (title or ''):
            fails.append('%s: did not load our page (title=%r)' % (path, title))
        if not h1:
            fails.append('%s: no <h1> rendered' % path)

        imgs = b.images()
        broken = [i for i in imgs if not i['w']]
        active = b.eval("Array.from(document.querySelectorAll("
                        "'nav[aria-label=\"Primary\"] a[aria-current=\"page\"]'))"
                        ".map(a => a.getAttribute('href'))")
        print('%-34s imgs=%-3d broken=%-2d nav-active=%s' %
              (path, len(imgs), len(broken), active))
        print('   title: %s' % title)
        for i in imgs[:4]:
            print('     %s  %dx%d' % (i['src'].split('/')[-1], i['w'], i['h']))
        if broken:
            fails.append('%s: %d broken image(s): %s'
                         % (path, len(broken), [i['src'] for i in broken]))
        if active != [expect_active]:
            fails.append('%s: nav active is %s, expected [%r]'
                         % (path, active, expect_active))
        b.shot('%s/cover-render-c2-%s.png' % (SHOTS, name))

    # A first-time visitor's route to the new section: click the nav item.
    b.goto(BASE + '/', settle=1.0)
    b.click("nav[aria-label='Primary'] a[href='/skills']", settle=1.2)
    landed = b.eval('location.pathname').rstrip('/') or '/'
    cards = b.eval("document.querySelectorAll('a[href^=\"/skills/\"]').length")
    print('\nclicked nav Skills -> %s, %d skill card link(s)' % (landed, cards))
    if landed != '/skills':
        fails.append('nav click landed on %s' % landed)
    if cards < 1:
        fails.append('/skills has no card linking into the collection')
    # ...and on into the entry itself.
    b.click("a[href='/skills/welding-fabrication']", settle=1.2)
    landed2 = b.eval('location.pathname').rstrip('/') or '/'
    h1 = b.eval("document.querySelector('h1')?.textContent?.trim()")
    print('clicked skill card   -> %s  h1=%r' % (landed2, h1))
    if landed2 != '/skills/welding-fabrication':
        fails.append('card click landed on %s' % landed2)
    b.shot('%s/cover-render-c2-journey-skill-page.png' % SHOTS)

    errs = [c for c in b.console if 'error' in c.lower()]
    if errs:
        print('\nconsole errors:')
        for e in errs[:10]:
            print('  ' + e)
        fails.append('%d console error(s)' % len(errs))

print('\n' + ('FAILURES:\n  ' + '\n  '.join(fails) if fails else 'ALL SITE CHECKS PASS'))
sys.exit(1 if fails else 0)
