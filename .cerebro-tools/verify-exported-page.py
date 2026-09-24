"""The last link in the round trip: does the just-exported skill actually render?"""
import sys
sys.path.insert(0, '.cerebro-tools')
sys.stdout.reconfigure(encoding='utf-8')
from cdp import Browser

DEV = 'http://localhost:4321'
SHOTS = 'C:/Users/seanm/.cerebro/data/cerebro/media'
SLUG = sys.argv[1] if len(sys.argv) > 1 else 'zulu-roundtrip-check'

fails = []
with Browser() as b:
    # The index first — a new entry has to be reachable, not just addressable.
    b.goto(DEV + '/skills', settle=3.0)
    b.eval("Array.from(document.images).forEach(i => i.loading = 'eager');")
    b.wait_for("Array.from(document.images).every(i => i.complete)", timeout=30)
    links = b.eval("Array.from(document.querySelectorAll('a[href^=\"/skills/\"]'))"
                   ".map(a => a.getAttribute('href'))")
    imgs = b.images()
    print('/skills links: %s' % links)
    print('/skills images: %d, broken: %d' % (len(imgs), len([i for i in imgs if not i['w']])))
    if '/skills/%s' % SLUG not in links:
        fails.append('the new entry is not linked from /skills')
    b.shot('%s/cover-render-c2-skills-index-dev.png' % SHOTS)

    b.click("a[href='/skills/%s']" % SLUG, settle=2.5)
    b.eval("Array.from(document.images).forEach(i => i.loading = 'eager');")
    b.wait_for("Array.from(document.images).every(i => i.complete)", timeout=30)
    path = b.eval('location.pathname')
    h1 = b.eval("document.querySelector('h1')?.textContent?.trim()")
    imgs = b.images()
    broken = [i for i in imgs if not i['w']]
    print('landed %s  h1=%r  imgs=%d broken=%d' % (path, h1, len(imgs), len(broken)))
    for i in imgs:
        print('   %s %dx%d' % (i['src'].split('/')[-1], i['w'], i['h']))
    if path != '/skills/%s' % SLUG:
        fails.append('click landed on %s' % path)
    if not h1:
        fails.append('no <h1> on the exported page')
    if not imgs or broken:
        fails.append('%d image(s), %d broken' % (len(imgs), len(broken)))
    b.shot('%s/cover-render-c2-exported-skill-page.png' % SHOTS)

print('\n' + ('FAILURES:\n  ' + '\n  '.join(fails) if fails else 'EXPORTED PAGE RENDERS'))
sys.exit(1 if fails else 0)
