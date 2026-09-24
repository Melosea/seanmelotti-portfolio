"""Drive the Caption Studio in a real browser, end to end.

Covers the three cycle-2 items where they meet a human:
  1. sidebar grouped into Projects / Skills
  2. the save badge telling the truth, including a forced failure
  3. creating a Skill and a Project through the Add dialog, then the full
     photo -> caption -> autosave -> export round trip for the skill
"""
import json
import os
import shutil
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, '.cerebro-tools')
from cdp import Browser

DEV = 'http://localhost:4321'
SHOTS = 'C:/Users/seanm/.cerebro/data/cerebro/media'
STUDIO_DIR = 'src/content/_studio'
PHOTOS_DIR = 'src/assets/photos'
SKILL_SLUG = 'zulu-roundtrip-check'
PROJ_SLUG = 'zulu-regression-project'
SRC_PHOTOS = 'src/assets/photos/welding-fabrication'

fails = []
notes = []


def check(cond, msg):
    print(('  OK   ' if cond else '  FAIL ') + msg)
    if not cond:
        fails.append(msg)


SAVED = ("document.getElementById('save-status').className.trim()"
         " === 'save-status saved'")


def badge(b):
    return b.eval("(() => { const e = document.getElementById('save-status');"
                  " return e ? [e.className, e.textContent.trim()] : null; })()")


with Browser() as b:
    # ── 1. Sidebar grouping ────────────────────────────────────────────────
    print('\n=== 1. Sidebar grouping ===')
    b.goto(DEV + '/studio', settle=2.0)
    b.wait_for("document.querySelectorAll('.project-btn').length > 0",
               label='sidebar populated')
    heads = b.eval("Array.from(document.querySelectorAll('.project-group-header'))"
                   ".map(h => h.textContent.trim())")
    grouped = b.eval(
        "Array.from(document.querySelectorAll('.project-group')).map(g => ({"
        " head: g.querySelector('.project-group-header').textContent.trim(),"
        " slugs: Array.from(g.querySelectorAll('.project-btn')).map(x => x.dataset.slug) }))")
    print('  groups: %s' % json.dumps(grouped))
    # Sean authors in this Studio while the mission runs, so assert membership
    # rather than an exact list — the entry count is his business, not the test's.
    check([h.split(' (')[0] for h in heads] == ['Projects', 'Skills'],
          'sidebar shows both groups in order: %s' % heads)
    by_head = {g['head'].split(' (')[0]: g['slugs'] for g in grouped}
    check('giulietta-spyder-veloce' in by_head.get('Projects', []), 'giulietta under Projects')
    check('welding-fabrication' in by_head.get('Skills', []), 'welding under Skills')
    check('welding-fabrication' not in by_head.get('Projects', []),
          'a skill does not also appear under Projects')
    b.shot('%s/cover-render-c2-studio-sidebar-grouped.png' % SHOTS)

    # ── 2. Add dialog: probes first ────────────────────────────────────────
    print('\n=== 2. Add dialog ===')
    b.click('#btn-add-project')
    check(b.eval("!document.getElementById('new-entry-modal').hidden"), 'dialog opens')
    check(b.eval("document.querySelector('#new-entry-type button[data-type=\"project\"]')"
                 ".getAttribute('aria-pressed') === 'true'"), 'defaults to Project')
    b.shot('%s/cover-render-c2-studio-add-dialog.png' % SHOTS)

    # probe: submit with an empty name
    b.click('#new-entry-create')
    err = b.eval("(() => { const e = document.getElementById('new-entry-error');"
                 " return e.hidden ? null : e.textContent.trim(); })()")
    print('  empty-name submit -> %r' % err)
    check(bool(err), 'empty name is refused with a visible message, dialog stays open')
    check(b.eval("!document.getElementById('new-entry-modal').hidden"), 'dialog still open')

    # probe: Escape closes, reopening resets the type toggle
    b.click('#new-entry-type button[data-type="skill"]')
    b.key(27, 'Escape')
    check(b.eval("document.getElementById('new-entry-modal').hidden"), 'Escape closes dialog')
    b.click('#btn-add-project')
    check(b.eval("document.querySelector('#new-entry-type button[data-type=\"project\"]')"
                 ".getAttribute('aria-pressed') === 'true'"), 'reopen resets to Project')

    # ── 3. Create a SKILL through the UI ───────────────────────────────────
    print('\n=== 3. Create a Skill ===')
    b.type_text('#new-entry-name', 'Zulu Roundtrip Check')
    b.click('#new-entry-type button[data-type="skill"]')
    hint = b.eval("document.getElementById('new-entry-hint').textContent.trim()")
    print('  hint now: %s' % hint)
    check('skills' in hint, 'hint names the skills collection')
    b.shot('%s/cover-render-c2-studio-add-skill-selected.png' % SHOTS)
    b.click('#new-entry-create', settle=1.6)
    check(b.eval("document.getElementById('new-entry-modal').hidden"), 'dialog closed on success')

    sidecar_path = os.path.join(STUDIO_DIR, SKILL_SLUG + '.json')
    check(os.path.exists(sidecar_path), 'sidecar written: %s' % sidecar_path)
    sc = json.load(open(sidecar_path, encoding='utf-8'))
    print('  sidecar: %s' % json.dumps(sc))
    check(sc.get('type') == 'skill', 'sidecar carries "type":"skill"')
    check(os.path.isdir(os.path.join(PHOTOS_DIR, SKILL_SLUG)), 'photo folder created')
    check(b.eval("location.search.includes('%s')" % SKILL_SLUG), 'new entry is selected')

    grouped = b.eval(
        "Array.from(document.querySelectorAll('.project-group')).map(g => ({"
        " head: g.querySelector('.project-group-header').textContent.trim(),"
        " slugs: Array.from(g.querySelectorAll('.project-btn')).map(x => x.dataset.slug) }))")
    skills_group = [g for g in grouped if g['head'].startswith('Skills')]
    check(skills_group and SKILL_SLUG in skills_group[0]['slugs'],
          'new skill appears under the Skills group')

    # ── 4. Regression: creating a Project still behaves as before ──────────
    print('\n=== 4. Create a Project (regression) ===')
    b.click('#btn-add-project')
    b.type_text('#new-entry-name', 'Zulu Regression Project')
    b.click('#new-entry-create', settle=1.6)
    pj_path = os.path.join(STUDIO_DIR, PROJ_SLUG + '.json')
    check(os.path.exists(pj_path), 'project sidecar written')
    pj = json.load(open(pj_path, encoding='utf-8'))
    print('  sidecar: %s' % json.dumps(pj))
    check(pj.get('type') == 'project', 'project sidecar type is "project"')
    check(pj.get('title') == 'Zulu Regression Project' and pj.get('status') == 'in-progress'
          and pj.get('photos') == [] and pj.get('seqOrder') == [],
          'project sidecar shape unchanged')
    grouped = b.eval(
        "Array.from(document.querySelectorAll('.project-group')).map(g => ({"
        " head: g.querySelector('.project-group-header').textContent.trim(),"
        " slugs: Array.from(g.querySelectorAll('.project-btn')).map(x => x.dataset.slug) }))")
    proj_group = [g for g in grouped if g['head'].startswith('Projects')]
    check(proj_group and PROJ_SLUG in proj_group[0]['slugs'],
          'new project appears under the Projects group')

    # duplicate-name probe
    b.click('#btn-add-project')
    b.type_text('#new-entry-name', 'Zulu Regression Project')
    b.click('#new-entry-create', settle=1.2)
    dup = b.eval("(() => { const e = document.getElementById('new-entry-error');"
                 " return e.hidden ? null : e.textContent.trim(); })()")
    print('  duplicate name -> %r' % dup)
    check(bool(dup) and 'exists' in dup, 'duplicate name refused in-dialog')
    b.key(27, 'Escape')
    b.shot('%s/cover-render-c2-studio-sidebar-after-create.png' % SHOTS)

    # ── 5. Photos onto the new skill, captions, autosave ───────────────────
    print('\n=== 5. Photo -> caption -> autosave ===')
    for n in ('welding-fabrication-001.jpg', 'welding-fabrication-003.jpg'):
        shutil.copy(os.path.join(SRC_PHOTOS, n),
                    os.path.join(PHOTOS_DIR, SKILL_SLUG, n))
    print('  copied 2 photos onto disk for %s' % SKILL_SLUG)

    # Dropping files into src/assets/photos makes Vite full-reload the page, so
    # settle first and then select the entry the way a human would — by clicking
    # its row — rather than trusting a URL param through a reload.
    b.goto(DEV + '/studio', settle=3.0)
    b.wait_for(".project-btn[data-slug='%s']" % SKILL_SLUG,
               label='new skill in sidebar')
    for attempt in range(3):
        b.click(".project-btn[data-slug='%s']" % SKILL_SLUG, settle=1.5)
        if b.eval("!!document.getElementById('btn-import-disk')"):
            break
        time.sleep(1.5)
    b.wait_for("!!document.getElementById('btn-import-disk')", label='import button')
    imp = b.eval("document.getElementById('btn-import-disk').textContent.trim()")
    print('  toolbar offers: %r' % imp)
    b.click('#btn-import-disk', settle=1.0)
    n_cards = b.eval("document.querySelectorAll('.caption-input').length")
    check(n_cards == 2, 'both photos imported onto the canvas (%d cards)' % n_cards)

    # The badge must go dirty the instant an edit happens.
    b.type_text('.caption-input', 'Corner joint run, filler added on the second pass.')
    b.type_text('.alt-input', 'MIG weld bead along a steel corner joint, still showing heat tint')
    st = badge(b)
    print('  badge right after typing: %s' % st)
    check(st and 'unsaved' in st[0], 'badge goes to Unsaved on edit')

    # ...and go to Saved on its own once the debounce fires.
    b.wait_for(SAVED, timeout=15, label='autosave reaches Saved on its own')
    print('  badge after autosave:     %s' % badge(b))
    time.sleep(0.4)
    sc = json.load(open(sidecar_path, encoding='utf-8'))
    on_disk = [p.get('caption') for p in sc.get('photos', [])]
    print('  captions on disk: %s' % json.dumps(on_disk))
    check(any('Corner joint run' in (c or '') for c in on_disk),
          'the caption really is in the sidecar on disk')
    b.shot('%s/cover-render-c2-studio-skill-saved.png' % SHOTS)

    # Put it in the main sequence and make it the hero, so the export produces a
    # real coverImage + a step rather than an empty shell.
    b.eval("(() => { const s = document.querySelector('.dest-select');"
           " s.value = 'main'; s.dispatchEvent(new Event('change', {bubbles: true})); })()")
    time.sleep(0.4)
    # The radio itself is display:none — a human clicks the label.
    b.click('.hero-label', settle=0.6)
    b.wait_for(SAVED, timeout=15, label='hero+dest autosaved')
    sc = json.load(open(sidecar_path, encoding='utf-8'))
    print('  heroFilename=%r seqOrder=%s' % (sc.get('heroFilename'), sc.get('seqOrder')))
    check(sc.get('heroFilename') and sc.get('seqOrder'),
          'hero and sequence position persisted')

    # ── 6. Forced save failure — the badge must not lie ────────────────────
    print('\n=== 6. Forced save failure ===')
    b.block(['*/api/studio/sidecar/*'])
    b.type_text('.caption-input', ' Second pass.')
    b.wait_for("document.getElementById('save-status').className.includes('error')",
               timeout=12, label='badge reaches error state')
    st = badge(b)
    print('  badge while blocked: %s' % st)
    check('error' in st[0] and 'failed' in st[1].lower(),
          'badge says Save failed on a network failure')
    hdr = b.eval("(() => { const e = document.getElementById('save-status-header');"
                 " return e ? [e.className, e.textContent.trim()] : null; })()")
    check(hdr and 'error' in hdr[0], 'header badge shows the failure too: %s' % hdr)
    title = b.eval("document.getElementById('save-status').getAttribute('title')")
    print('  tooltip: %r' % title)
    check(bool(title), 'failure explains itself on hover')
    b.shot('%s/cover-render-c2-studio-save-failed.png' % SHOTS)

    # It must NOT clear itself: keep editing, badge stays in error.
    b.type_text('.alt-input', ' Extra.')
    time.sleep(2.5)
    st = badge(b)
    print('  badge after further edits while still blocked: %s' % st)
    check('error' in st[0], 'failure state survives further edits (does not fall back to Unsaved)')

    # Export must refuse rather than publish a stale sidecar.
    b.dialogs.clear()
    b.click('#btn-export', settle=1.5)
    print('  export dialog(s): %s' % b.dialogs)
    check(any('Not exported' in d for d in b.dialogs),
          'export refuses while the save is failing')

    # Recover: unblock and retry with Ctrl+S.
    b.block([])
    b.press_ctrl('s', settle=1.5)
    b.wait_for(SAVED, timeout=15, label='badge recovers to Saved')
    print('  badge after retry:   %s' % badge(b))
    check(badge(b)[0].strip() == 'save-status saved', 'a real save clears the failure')
    b.shot('%s/cover-render-c2-studio-save-recovered.png' % SHOTS)

    # ── 7. Export the skill ────────────────────────────────────────────────
    print('\n=== 7. Export ===')
    b.dialogs.clear()
    b.click('#btn-export', settle=2.5)
    print('  export dialog(s): %s' % b.dialogs)
    check(any('src/content/skills/%s.mdx' % SKILL_SLUG in d for d in b.dialogs),
          'export reports the skills path')
    mdx_path = 'src/content/skills/%s.mdx' % SKILL_SLUG
    check(os.path.exists(mdx_path), 'MDX landed in src/content/skills/')
    check(not os.path.exists('src/content/projects/%s.mdx' % SKILL_SLUG),
          'nothing written into src/content/projects/')
    if os.path.exists(mdx_path):
        print('  --- %s ---' % mdx_path)
        print(open(mdx_path, encoding='utf-8').read())

    errs = [c for c in b.console if 'error' in c.lower()]
    if errs:
        print('\nconsole errors (expected: the blocked-save one):')
        for e in errs[:10]:
            print('  ' + e)

print('\n' + ('FAILURES:\n  ' + '\n  '.join(fails) if fails else 'ALL STUDIO CHECKS PASS'))
sys.exit(1 if fails else 0)
