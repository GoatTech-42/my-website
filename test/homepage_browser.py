import base64, functools, http.server, json, pathlib, signal, subprocess, threading, time, unittest, urllib.request
import websocket

ROOT = pathlib.Path(__file__).resolve().parents[1]

class HomepageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'goattech')))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.chrome = subprocess.Popen(['/usr/bin/google-chrome', '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-allow-origins=*', '--remote-debugging-port=9223', '--user-data-dir=/tmp/goattech-regression', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(80):
            try:
                tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9223/json'))
                break
            except Exception:
                time.sleep(.1)
        cls.ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'])
        cls.seq = 0
        cls.call('Page.enable')
        cls.call('Network.enable')
        cls.call('Network.setBlockedURLs', {'urls': ['*api.github.com*']})
        cls.call('Page.addScriptToEvaluateOnNewDocument', {'source': 'window.requestAnimationFrame=function(){};'})

    @classmethod
    def call(cls, method, params=None):
        cls.seq += 1
        cls.ws.send(json.dumps({'id': cls.seq, 'method': method, 'params': params or {}}))
        while True:
            r = json.loads(cls.ws.recv())
            if r.get('id') == cls.seq:
                if 'error' in r:
                    raise RuntimeError(r['error'])
                return r.get('result', {})

    @classmethod
    def value(cls, expression):
        r = cls.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
        if 'exceptionDetails' in r:
            raise RuntimeError(r['exceptionDetails'])
        return r['result'].get('value')

    def load(self, width=1440, javascript=True):
        self.call('Emulation.setScriptExecutionDisabled', {'value': not javascript})
        self.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]})
        self.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 1440 if width > 1920 else 900, 'deviceScaleFactor': 1, 'mobile': False})
        self.call('Page.navigate', {'url': 'http://127.0.0.1:' + str(self.server.server_port) + '/'})
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if self.value('!!document.getElementById("latest")'):
                return
            time.sleep(.05)
        self.fail('Homepage did not load')

    def test_timer_starts_hero_when_animation_frames_never_arrive(self):
        self.load()
        time.sleep(2.6)
        state = self.value('({visible:document.getElementById("hero").classList.contains("in-view"),intro:getComputedStyle(document.getElementById("intro")).display})')
        self.assertTrue(state['visible'], 'hero start must not depend on requestAnimationFrame')
        self.assertEqual(state['intro'], 'none')

    def test_css_curtain_clears_without_javascript(self):
        self.load(javascript=False)
        self.value('document.documentElement.className="js"')
        time.sleep(2.6)
        self.assertIn(self.value('getComputedStyle(document.getElementById("intro")).visibility'), ['hidden', 'collapse'])

    def test_latest_push_survives_github_failure(self):
        self.load()
        time.sleep(.7)
        latest = self.value('document.getElementById("latest").textContent')
        self.assertRegex(latest, r'\d.*ago', 'saved push time must remain usable when GitHub is unavailable')

    def test_wide_hero_uses_available_column_and_readable_lead(self):
        self.load(width=2560)
        state = self.value('({width:document.querySelector(".hero .wrap").getBoundingClientRect().width,lead:parseFloat(getComputedStyle(document.querySelector(".hero .lead")).fontSize),scroll:document.documentElement.scrollWidth})')
        self.assertGreaterEqual(state['width'], 2300)
        self.assertGreaterEqual(state['lead'], 34)
        self.assertLessEqual(state['scroll'], 2560)

    @classmethod
    def tearDownClass(cls):
        cls.ws.close()
        cls.server.shutdown()
        cls.chrome.send_signal(signal.SIGTERM)
        cls.chrome.wait(timeout=10)

if __name__ == '__main__':
    unittest.main()
