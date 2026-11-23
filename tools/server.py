# Dev / deploy server: serves the game folder. Config via environment:
#   HOST (default 127.0.0.1)   PORT (default 8000)   ENABLE_SAVE (1 = editor may POST /save, default 1; the container sets 0)
import http.server, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = os.environ.get('HOST', '127.0.0.1')
PORT = int(os.environ.get('PORT', '8000'))
ENABLE_SAVE = os.environ.get('ENABLE_SAVE', '1') == '1'

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        if self.path in ('/', '/index.html'):             # land on the game, not a directory listing
            self.send_response(302); self.send_header('Location', '/arena.html'); self.end_headers(); return
        super().do_GET()
    def list_directory(self, path):                       # never expose folder listings
        self.send_error(404, 'Not found'); return None
    def do_POST(self):
        if self.path != '/save':
            self.send_error(404); return
        if not ENABLE_SAVE:                               # production: the editor cannot overwrite game art
            self.send_error(403, 'saving is disabled'); return
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
        os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
        with open(os.path.join(ROOT, 'assets', 'darkheart.json'), 'w') as f:
            json.dump(d, f)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    print(f'Darkheart on http://{HOST}:{PORT}  (save {"on" if ENABLE_SAVE else "off"})', flush=True)
    http.server.ThreadingHTTPServer((HOST, PORT), H).serve_forever()
