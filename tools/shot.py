"""Screenshot einer Seite mit headless Chrome, optional nach Tasten/Klicks (für Cover und Checks).

Braucht Google Chrome unter /Applications und `pip install websocket-client`.
Vorher einen Server starten:  python3 -m http.server 8765

Beispiele:
  python3 tools/shot.py http://localhost:8765/ /tmp/site.png --size 1440x900
  python3 tools/shot.py http://localhost:8765/ /tmp/site_m.png --size 390x844 --mobile
  # Kran-Karl: 4x Leertaste bis ins Spiel, Kran bewegen, dann Screenshot
  python3 tools/shot.py http://localhost:8765/games/kran-karl/ /tmp/kk.png --size 1600x900 \
      --do "key:Space,wait:1.2,key:Space,wait:1.2,key:Space,wait:1.2,key:Space,wait:3,hold:ArrowRight:1.3,hold:ArrowDown:1"
  # Showdown: klicken zum Start, 6 s warten
  python3 tools/shot.py http://localhost:8765/games/good-luck/showdown/ /tmp/sd.png --size 1700x1000 \
      --do "click:850:800,wait:6"

Aktionen in --do (kommagetrennt): key:<Code>, hold:<Code>:<Sek>, click:<x>:<y>, wait:<Sek>
"""
import argparse, base64, json, subprocess, sys, tempfile, time, urllib.request

import websocket

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9399
KEYS = {
    "Space": (" ", 32), "Enter": ("Enter", 13), "Escape": ("Escape", 27),
    "ArrowLeft": ("ArrowLeft", 37), "ArrowUp": ("ArrowUp", 38),
    "ArrowRight": ("ArrowRight", 39), "ArrowDown": ("ArrowDown", 40),
    **{f"Key{c}": (c.lower(), ord(c)) for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
    **{f"Digit{d}": (str(d), 48 + d) for d in range(10)},
}


class Page:
    def __init__(self, w, h, mobile):
        self.proc = subprocess.Popen(
            [CHROME, "--headless=new", f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
             "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required",
             f"--user-data-dir={tempfile.mkdtemp()}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen(f"http://localhost:{PORT}/json"))
                break
            except OSError:
                time.sleep(0.2)
        page = next(t for t in targets if t["type"] == "page")
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"])
        self.n = 0
        self.cmd("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=1, mobile=mobile)

    def cmd(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get("id") == self.n:
                return r.get("result")

    def key(self, code, kind):
        k, v = KEYS[code]
        self.cmd("Input.dispatchKeyEvent", type=kind, code=code, key=k, windowsVirtualKeyCode=v)

    def click(self, x, y):
        for t in ("mouseMoved", "mousePressed", "mouseReleased"):
            self.cmd("Input.dispatchMouseEvent", type=t, x=x, y=y, button="left", clickCount=1)

    def shot(self, path):
        data = self.cmd("Page.captureScreenshot", format="png")["data"]
        open(path, "wb").write(base64.b64decode(data))

    def close(self):
        self.proc.kill()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("out")
    ap.add_argument("--size", default="1440x900")
    ap.add_argument("--mobile", action="store_true")
    ap.add_argument("--do", default="", help="Aktionen, siehe Docstring")
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    p = Page(w, h, a.mobile)
    try:
        p.cmd("Page.navigate", url=a.url)
        time.sleep(2.5)
        for step in filter(None, a.do.split(",")):
            kind, *args = step.split(":")
            if kind == "key":
                p.key(args[0], "keyDown"); time.sleep(0.08); p.key(args[0], "keyUp")
            elif kind == "hold":
                p.key(args[0], "keyDown"); time.sleep(float(args[1])); p.key(args[0], "keyUp")
            elif kind == "click":
                p.click(float(args[0]), float(args[1]))
            elif kind == "wait":
                time.sleep(float(args[0]))
            else:
                sys.exit(f"unbekannte Aktion: {step}")
        p.shot(a.out)
        bad = p.cmd("Runtime.evaluate", returnByValue=True, expression=
                    "performance.getEntriesByType('resource').filter(e=>e.responseStatus>=400).map(e=>e.name)")
        print("url:", p.cmd("Runtime.evaluate", expression="location.href", returnByValue=True)["result"]["value"])
        print("fehlgeschlagene Requests:", bad["result"].get("value"))
    finally:
        p.close()


if __name__ == "__main__":
    main()
