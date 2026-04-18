import os
import threading
import http.server
import socketserver
import webbrowser

PORT = 8502
base = os.path.dirname(os.path.abspath(__file__))

# Write API key to config.js
gemini_key = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
config_path = os.path.join(base, "config.js")
with open(config_path, "w", encoding="utf-8") as f:
    f.write(f'window.__GEMINI_KEY__ = "{gemini_key}";\n')
    f.write('console.log("Gemini API key loaded");\n')

os.chdir(base)

handler = http.server.SimpleHTTPRequestHandler

def start():
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        httpd.serve_forever()

t = threading.Thread(target=start, daemon=True)
t.start()

webbrowser.open(f"http://localhost:{PORT}/index.html")

print("Press Ctrl+C to stop the server")
try:
    threading.Event().wait()
except KeyboardInterrupt:
    print("Server stopped")
