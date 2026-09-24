"""Minimal Chrome DevTools Protocol driver for verifying the site and the Studio.

Launches a real headless Chrome, navigates, dispatches real mouse/keyboard input
and captures screenshots. Used because verification means driving the surface a
human touches, not curling the API underneath it.

Usage: import from a verification script;
    with Browser() as b:
        b.goto('http://localhost:4321/skills')
        b.click_text('Skills')
        b.shot('out.png')
"""
import base64
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request

import websocket

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def _free_port():
    """Never hard-code 9222 — other agents on this box run their own headless
    Chrome and attaching to theirs is how you end up debugging somebody else."""
    import socket
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


class Browser:
    def __init__(self, port=None, width=1440, height=980, headless=True):
        self.port = port or _free_port()
        self.width = width
        self.height = height
        self.headless = headless
        self.profile = tempfile.mkdtemp(prefix='cdp-profile-')
        self.proc = None
        self.ws = None
        self._id = 0
        self.console = []
        self.dialogs = []

    # ── lifecycle ──────────────────────────────────────────────────────────
    def __enter__(self):
        args = [
            CHROME,
            '--remote-debugging-port=%d' % self.port,
            '--user-data-dir=' + self.profile,
            '--no-first-run', '--no-default-browser-check',
            '--disable-extensions', '--disable-background-networking',
            '--remote-allow-origins=*',
            '--window-size=%d,%d' % (self.width, self.height),
            'about:blank',
        ]
        if self.headless:
            args.insert(1, '--headless=new')
        self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)
        target = None
        for _ in range(100):
            try:
                raw = urllib.request.urlopen(
                    'http://127.0.0.1:%d/json/list' % self.port, timeout=1).read()
                for t in json.loads(raw):
                    if t.get('type') == 'page':
                        target = t
                        break
                if target:
                    break
            except Exception:
                pass
            time.sleep(0.2)
        if not target:
            raise RuntimeError('Chrome did not expose a page target')
        # suppress_origin: Chrome rejects a WS handshake that carries an Origin
        # it did not whitelist, and websocket-client sends one by default.
        self.ws = websocket.create_connection(target['webSocketDebuggerUrl'],
                                              timeout=60,
                                              suppress_origin=True,
                                              max_size=200 * 1024 * 1024)
        self.send('Page.enable')
        self.send('Page.setInterceptFileChooserDialog', {'enabled': False})
        self.send('Runtime.enable')
        self.send('Network.enable')
        self.send('Log.enable')
        self.send('Emulation.setDeviceMetricsOverride', {
            'width': self.width, 'height': self.height,
            'deviceScaleFactor': 1, 'mobile': False})
        return self

    def __exit__(self, *exc):
        try:
            if self.ws:
                self.ws.close()
        except Exception:
            pass
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except Exception:
                self.proc.kill()
        shutil.rmtree(self.profile, ignore_errors=True)

    # ── protocol ───────────────────────────────────────────────────────────
    def send(self, method, params=None, timeout=60):
        self._id += 1
        mid = self._id
        self.ws.send(json.dumps({'id': mid, 'method': method,
                                 'params': params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.ws.settimeout(max(0.1, deadline - time.time()))
            msg = json.loads(self.ws.recv())
            if msg.get('method') == 'Page.javascriptDialogOpening':
                # alert()/confirm() block the renderer until answered. Record the
                # text — it is often the assertion — then dismiss it.
                self.dialogs.append(msg['params'].get('message', ''))
                self._id += 1
                self.ws.send(json.dumps({
                    'id': self._id, 'method': 'Page.handleJavaScriptDialog',
                    'params': {'accept': True}}))
            elif msg.get('method') == 'Runtime.consoleAPICalled':
                args = msg['params'].get('args', [])
                text = ' '.join(str(a.get('value', a.get('description', '')))
                                for a in args)
                self.console.append('[%s] %s' % (msg['params']['type'], text))
            elif msg.get('method') == 'Log.entryAdded':
                e = msg['params']['entry']
                self.console.append('[%s] %s' % (e['level'], e['text']))
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError('%s -> %s' % (method, msg['error']))
                return msg.get('result', {})
        raise RuntimeError('timeout waiting for %s' % method)

    def drain(self, seconds=0.2):
        """Pump events (console messages) without issuing a command."""
        deadline = time.time() + seconds
        while time.time() < deadline:
            try:
                self.ws.settimeout(max(0.05, deadline - time.time()))
                msg = json.loads(self.ws.recv())
            except Exception:
                break
            if msg.get('method') == 'Page.javascriptDialogOpening':
                self.dialogs.append(msg['params'].get('message', ''))
                self._id += 1
                self.ws.send(json.dumps({
                    'id': self._id, 'method': 'Page.handleJavaScriptDialog',
                    'params': {'accept': True}}))
            elif msg.get('method') == 'Runtime.consoleAPICalled':
                args = msg['params'].get('args', [])
                text = ' '.join(str(a.get('value', a.get('description', '')))
                                for a in args)
                self.console.append('[%s] %s' % (msg['params']['type'], text))

    # ── actions ────────────────────────────────────────────────────────────
    def goto(self, url, settle=1.2):
        self.send('Page.navigate', {'url': url})
        time.sleep(settle)
        self.eval('1')  # forces a round-trip on the new document

    def eval(self, expr, await_promise=False):
        r = self.send('Runtime.evaluate', {
            'expression': expr, 'returnByValue': True,
            'awaitPromise': await_promise, 'userGesture': True})
        if r.get('exceptionDetails'):
            raise RuntimeError('eval failed: %s' %
                               json.dumps(r['exceptionDetails'])[:400])
        return r['result'].get('value')

    def box(self, selector):
        """Viewport-centre coordinates of a selector, or None."""
        return self.eval(
            "(() => { const e = document.querySelector(%s);"
            " if (!e) return null; const r = e.getBoundingClientRect();"
            " if (r.width === 0 && r.height === 0) return null;"
            " return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()"
            % json.dumps(selector))

    def click(self, selector, settle=0.35):
        """A real mouse press/release at the element's centre."""
        # Mouse events are in viewport coordinates, so anything below the fold
        # has to be scrolled to first — otherwise the click lands on nothing.
        self.eval("document.querySelector(%s)?.scrollIntoView("
                  "{block: 'center', behavior: 'instant'})" % json.dumps(selector))
        time.sleep(0.25)
        b = self.box(selector)
        if not b:
            raise RuntimeError('not clickable / not found: %s' % selector)
        for kind in ('mousePressed', 'mouseReleased'):
            self.send('Input.dispatchMouseEvent', {
                'type': kind, 'x': b['x'], 'y': b['y'],
                'button': 'left', 'clickCount': 1})
        # Pump rather than sleep: a click can raise an alert(), and an unanswered
        # alert freezes the renderer until we handle it.
        self.drain(settle)

    def type_text(self, selector, text, settle=0.2):
        self.click(selector, settle=0.1)
        for ch in text:
            self.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'text': ch})
            self.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'text': ch})
        time.sleep(settle)

    def key(self, code, key_name, settle=0.2):
        for kind in ('keyDown', 'keyUp'):
            self.send('Input.dispatchKeyEvent', {
                'type': kind, 'windowsVirtualKeyCode': code, 'key': key_name})
        time.sleep(settle)

    def press_ctrl(self, letter, settle=0.4):
        code = ord(letter.upper())
        self.send('Input.dispatchKeyEvent', {
            'type': 'keyDown', 'modifiers': 2,
            'windowsVirtualKeyCode': code, 'key': letter.lower()})
        self.send('Input.dispatchKeyEvent', {
            'type': 'keyUp', 'modifiers': 2,
            'windowsVirtualKeyCode': code, 'key': letter.lower()})
        time.sleep(settle)

    def block(self, patterns):
        self.send('Network.setBlockedURLs', {'urls': patterns})

    def wait_for(self, expr, timeout=15, label=None):
        # A bare CSS selector is the common case; anything else is JS.
        if expr.strip()[:1] in '.#':
            expr = 'document.querySelector(%s)' % json.dumps(expr)
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.eval('!!(%s)' % expr):
                return True
            time.sleep(0.2)
        raise RuntimeError('wait_for timed out: %s' % (label or expr))

    def shot(self, path, full=False):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        params = {'format': 'png'}
        if full:
            params['captureBeyondViewport'] = True
        r = self.send('Page.captureScreenshot', params)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))
        return path

    def images(self):
        """Every <img> on the page with its loaded state — catches silent 404s."""
        return self.eval(
            "Array.from(document.images).map(i => ({"
            " src: i.currentSrc || i.src, w: i.naturalWidth,"
            " h: i.naturalHeight, complete: i.complete }))")
