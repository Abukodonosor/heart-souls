# Local dev server: serves the game folder and lets the editor POST /save to assets/darkheart.json.
import http.server, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def do_POST(self):
        if self.path != '/save':
            self.send_error(404); return
        n = int(self.headers.get('Content-Length', 0))
        if n > 8_000_000:
            self.send_error(413); return
        try:
            d = json.loads(self.rfile.read(n))
            ok = isinstance(d.get('frames'), list) and isinstance(d.get('anims'), dict) \
                and all(isinstance(f, str) and f.startswith('data:image/png;base64,') for f in d['frames'])
        except Exception:
            ok = False
        if not ok:
            self.send_error(400); return
        with open(os.path.join(ROOT, 'assets', 'darkheart.json'), 'w') as f:
            json.dump(d, f)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', 8000), H).serve_forever()
