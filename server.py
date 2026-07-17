import http.server
import socketserver
from pathlib import Path
import urllib.parse

PORT = 3000
ENV_PATH = Path("hospital_management/.env.local")


def load_env():
    values = {}
    if not ENV_PATH.exists():
        return values
    with ENV_PATH.open("r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


class SupabaseConfigHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/supabaseConfig.js":
            env = load_env()
            supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
            supabase_anon_key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

            config_js = f"export const supabaseConfig = {{ url: '{supabase_url}', anonKey: '{supabase_anon_key}' }};"
            self.send_response(200)
            self.send_header("Content-type", "application/javascript")
            self.send_header("Content-length", str(len(config_js.encode("utf-8"))))
            self.end_headers()
            self.wfile.write(config_js.encode("utf-8"))
            return
        return super().do_GET()


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), SupabaseConfigHandler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
