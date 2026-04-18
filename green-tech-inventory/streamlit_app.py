import streamlit as st
import os
import threading
import http.server
import socketserver
import webbrowser

st.set_page_config(
    page_title="Green-Tech Inventory Assistant",
    page_icon="🌿",
    layout="wide"
)

# Hide all Streamlit UI
st.markdown("""
<style>
    #MainMenu, header, footer { display: none !important; }
    .main .block-container { padding: 1rem !important; }
</style>
""", unsafe_allow_html=True)

base = os.path.dirname(__file__)
PORT = 8502

def start_server():
    os.chdir(base)
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        httpd.serve_forever()

# Start file server in background thread (only once)
if "server_started" not in st.session_state:
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    st.session_state.server_started = True

# Inject API key into config.js dynamically
try:
    gemini_key = st.secrets["GEMINI_API_KEY"]
except:
    gemini_key = ""

config_path = os.path.join(base, "config.js")
with open(config_path, "w", encoding="utf-8") as f:
    f.write(f'window.__GEMINI_KEY__ = "{gemini_key}";\n')
    f.write('console.log("Gemini API key loaded");\n')

url = f"http://localhost:{PORT}/index.html"

st.markdown(f"""
<h2 style="color:#2e7d32;">🌿 Green-Tech Inventory Assistant</h2>
<p style="font-size:1rem;color:#555;">Click the button below to open the full application:</p>
<a href="{url}" target="_blank">
    <button style="
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        padding: 0.8rem 2rem;
        font-size: 1rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        margin: 1rem 0;
    ">🚀 Open Full App</button>
</a>
<p style="color:#888;font-size:0.85rem;">Or go to: <a href="{url}" target="_blank">{url}</a></p>

<iframe src="{url}" width="100%" height="900px" style="border:none;border-radius:8px;margin-top:1rem;box-shadow:0 4px 16px rgba(0,0,0,0.1);"></iframe>
""", unsafe_allow_html=True)
