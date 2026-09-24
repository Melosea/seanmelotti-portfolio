"""Mobile probe: does the new Skills item work in the hamburger menu?"""
import sys
sys.path.insert(0, '.cerebro-tools')
sys.stdout.reconfigure(encoding='utf-8')
from cdp import Browser

SHOTS = 'C:/Users/seanm/.cerebro/data/cerebro/media'
fails = []

with Browser(width=390, height=844) as b:
    b.goto('http://127.0.0.1:4330/', settle=1.5)
    b.click('#menu-toggle', settle=0.6)
    open_state = b.eval("!document.getElementById('mobile-menu').hidden")
    items = b.eval("Array.from(document.querySelectorAll("
                   "'#mobile-menu nav a')).map(a => a.textContent.trim())")
    print('menu open: %s  items: %s' % (open_state, items))
    if 'Skills' not in items:
        fails.append('Skills missing from the mobile menu')
    b.shot('%s/cover-render-c2-mobile-menu.png' % SHOTS)

    b.click("#mobile-menu a[href='/skills']", settle=1.5)
    print('landed: %s' % b.eval('location.pathname'))
    if b.eval('location.pathname') != '/skills':
        fails.append('mobile Skills link did not navigate')
    b.eval("Array.from(document.images).forEach(i => i.loading = 'eager');")
    b.wait_for("Array.from(document.images).every(i => i.complete)", timeout=30)
    broken = [i for i in b.images() if not i['w']]
    overflow = b.eval("document.documentElement.scrollWidth > window.innerWidth + 1")
    print('broken imgs: %d   horizontal overflow: %s' % (len(broken), overflow))
    if broken:
        fails.append('%d broken image(s) at 390px' % len(broken))
    if overflow:
        fails.append('/skills scrolls sideways at 390px')
    b.shot('%s/cover-render-c2-mobile-skills.png' % SHOTS)

print('\n' + ('FAILURES:\n  ' + '\n  '.join(fails) if fails else 'MOBILE CHECKS PASS'))
sys.exit(1 if fails else 0)
