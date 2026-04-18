import streamlit as st
import streamlit.components.v1 as components
import os

st.set_page_config(
    page_title="Green-Tech Inventory Assistant",
    page_icon="🌿",
    layout="wide"
)

# Read all project files
def read_file(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

base = os.path.dirname(__file__)

css      = read_file(os.path.join(base, "styles.css"))
setup    = read_file(os.path.join(base, "setup.js"))
ai_js    = read_file(os.path.join(base, "ai.js"))
chatbot  = read_file(os.path.join(base, "chatbot.js"))
app_js   = read_file(os.path.join(base, "app.js"))
history  = read_file(os.path.join(base, "history.js"))
sample   = read_file(os.path.join(base, "data/sample.json"))

# Get API key from Streamlit secrets
try:
    gemini_key = st.secrets["GEMINI_API_KEY"]
except:
    gemini_key = ""

# Inject everything into a single self-contained HTML page
full_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Green-Tech Inventory Assistant</title>
  <style>{css}</style>
</head>
<body>

<!-- ===== NAVBAR ===== -->
<header class="navbar">
  <div class="nav-logo">
    <span class="leaf">🌿</span>
    <span class="brand-name">GreenStock</span>
  </div>
  <div class="nav-search">
    <input type="text" id="searchInput" placeholder="Search inventory by name, category, supplier..." />
    <button id="searchBtn" class="btn-search">🔍</button>
  </div>
  <div class="nav-actions">
    <button class="btn-nav" id="openAddModal">➕ Add Item</button>
    <button class="btn-nav" id="importCsvBtn">📂 Import CSV</button>
    <input type="file" id="csvFileInput" accept=".csv" style="display:none" />
  </div>
</header>

<div id="alertBanner" class="alert-banner hidden"></div>

<section class="stats-bar">
  <div class="stat-card">
    <span class="stat-icon">📦</span>
    <div><div class="stat-value" id="statTotal">0</div><div class="stat-label">Total Items</div></div>
  </div>
  <div class="stat-card warn">
    <span class="stat-icon">⚠️</span>
    <div><div class="stat-value" id="statLowStock">0</div><div class="stat-label">Low Stock</div></div>
  </div>
  <div class="stat-card danger">
    <span class="stat-icon">🗓️</span>
    <div><div class="stat-value" id="statExpiring">0</div><div class="stat-label">Expiring Soon (7d)</div></div>
  </div>
  <div class="stat-card green">
    <span class="stat-icon">🌱</span>
    <div><div class="stat-value" id="statSustainScore">—</div><div class="stat-label">Sustainability Score</div></div>
  </div>
  <div class="stat-card">
    <span class="stat-icon">💰</span>
    <div><div class="stat-value" id="statInventoryValue">$0</div><div class="stat-label">Inventory Value</div></div>
  </div>
</section>

<section class="filter-bar">
  <select id="filterCategory">
    <option value="">All Categories</option>
    <option value="Grains & Pulses">Grains & Pulses</option>
    <option value="Fruits & Vegetables">Fruits & Vegetables</option>
    <option value="Dairy">Dairy</option>
    <option value="Beverages">Beverages</option>
    <option value="Bakery">Bakery</option>
    <option value="Seafood">Seafood</option>
    <option value="Oils & Fats">Oils & Fats</option>
  </select>
  <select id="filterStatus">
    <option value="">All Statuses</option>
    <option value="Active">Active</option>
    <option value="Backordered">Backordered</option>
    <option value="Discontinued">Discontinued</option>
  </select>
  <select id="filterAlert">
    <option value="">All Items</option>
    <option value="low_stock">Low Stock</option>
    <option value="expiring">Expiring Soon</option>
    <option value="expired">Expired</option>
  </select>
  <select id="sortBy">
    <option value="name">Sort: Name</option>
    <option value="expiry">Sort: Expiry Date</option>
    <option value="stock">Sort: Stock (Low→High)</option>
    <option value="price">Sort: Price</option>
    <option value="turnover">Sort: Turnover Rate</option>
  </select>
  <button class="btn-secondary" id="clearFilters">✕ Clear</button>
  <span id="resultCount" class="result-count"></span>
</section>

<section class="ai-panel" id="aiPanel">
  <div class="ai-panel-header">
    <span>🤖 AI Insights</span>
    <button class="btn-ai" id="runAiBtn">Run Analysis</button>
    <button class="btn-secondary btn-sm" id="toggleAiPanel">▲ Hide</button>
  </div>
  <div id="aiInsightsContent" class="ai-insights-grid"></div>
</section>

<main class="inventory-main">
  <div class="table-header">
    <h2>Inventory Items</h2>
    <div style="display:flex;align-items:center;gap:0.5rem;">
      <div class="view-toggle">
        <button class="btn-view active" id="viewTable" title="Table View">☰</button>
        <button class="btn-view" id="viewGrid" title="Grid View">⊞</button>
      </div>
      <button class="btn-danger-small" id="deleteAllBtn" title="Delete All Items">🗑️ Delete All</button>
    </div>
  </div>
  <div id="tableView">
    <table class="inventory-table">
      <thead>
        <tr>
          <th>Product</th><th>Category</th><th>Stock</th><th>Reorder Level</th>
          <th>Unit Price</th><th>Expiry Date</th><th>Supplier</th>
          <th>Status</th><th>AI Alert</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="inventoryTableBody"></tbody>
    </table>
  </div>
  <div id="gridView" class="hidden">
    <div id="inventoryGrid" class="inventory-grid"></div>
  </div>
  <div id="emptyState" class="empty-state hidden">
    <div class="empty-icon">📭</div>
    <p>No items found. <button class="link-btn" id="emptyAddBtn">Add a new item</button>.</p>
  </div>
</main>

<!-- ADD/EDIT MODAL -->
<div id="itemModal" class="modal hidden">
  <div class="modal-overlay" id="modalOverlay"></div>
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="modalTitle">Add New Item</h3>
      <button class="modal-close" id="closeModal">✕</button>
    </div>
    <form id="itemForm" novalidate>
      <div class="form-grid">
        <div class="form-group"><label>Product Name *</label><input type="text" id="f_name" required placeholder="e.g. Arabica Coffee" /><span class="field-error" id="err_name"></span></div>
        <div class="form-group"><label>Category *</label><select id="f_category" required><option value="">-- Select --</option><option>Grains & Pulses</option><option>Fruits & Vegetables</option><option>Dairy</option><option>Beverages</option><option>Bakery</option><option>Seafood</option><option>Oils & Fats</option></select><button type="button" class="btn-ai-inline" id="autoCategoryBtn">🤖 Auto-detect</button><span class="field-error" id="err_category"></span></div>
        <div class="form-group"><label>Supplier Name *</label><input type="text" id="f_supplier" required placeholder="e.g. Feedmix" /><span class="field-error" id="err_supplier"></span></div>
        <div class="form-group"><label>Unit Price ($) *</label><input type="number" id="f_price" required min="0.01" step="0.01" placeholder="0.00" /><span class="field-error" id="err_price"></span></div>
        <div class="form-group"><label>Stock Quantity *</label><input type="number" id="f_stock" required min="0" placeholder="0" /><span class="field-error" id="err_stock"></span></div>
        <div class="form-group"><label>Reorder Level *</label><input type="number" id="f_reorder" required min="0" placeholder="0" /><span class="field-error" id="err_reorder"></span></div>
        <div class="form-group"><label>Reorder Quantity</label><input type="number" id="f_reorder_qty" min="0" placeholder="0" /></div>
        <div class="form-group"><label>Sales Volume</label><input type="number" id="f_sales" min="0" placeholder="0" /></div>
        <div class="form-group"><label>Date Received</label><input type="date" id="f_received" /></div>
        <div class="form-group"><label>Expiration Date</label><input type="date" id="f_expiry" /></div>
        <div class="form-group"><label>Warehouse Location</label><input type="text" id="f_location" placeholder="e.g. Aisle 3, Shelf B" /></div>
        <div class="form-group"><label>Status *</label><select id="f_status" required><option value="Active">Active</option><option value="Backordered">Backordered</option><option value="Discontinued">Discontinued</option></select></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
        <button type="submit" class="btn-primary" id="saveItemBtn">Save Item</button>
      </div>
    </form>
  </div>
</div>

<!-- DETAIL MODAL -->
<div id="detailModal" class="modal hidden">
  <div class="modal-overlay" id="detailOverlay"></div>
  <div class="modal-box modal-box-wide">
    <div class="modal-header"><h3 id="detailTitle">Item Details</h3><button class="modal-close" id="closeDetail">✕</button></div>
    <div id="detailContent"></div>
  </div>
</div>

<!-- DELETE MODAL -->
<div id="deleteModal" class="modal hidden">
  <div class="modal-overlay" id="deleteOverlay"></div>
  <div class="modal-box modal-box-sm">
    <div class="modal-header"><h3>Confirm Delete</h3><button class="modal-close" id="closeDelete">✕</button></div>
    <p id="deleteMsg" style="padding:1rem 1.5rem;">Are you sure?</p>
    <div class="modal-footer"><button class="btn-secondary" id="cancelDelete">Cancel</button><button class="btn-danger" id="confirmDelete">Delete</button></div>
  </div>
</div>

<!-- DELETE ALL MODAL -->
<div id="deleteAllModal" class="modal hidden">
  <div class="modal-overlay" id="deleteAllOverlay"></div>
  <div class="modal-box modal-box-sm">
    <div class="modal-header"><h3>⚠️ Confirm Delete All</h3><button class="modal-close" id="closeDeleteAll">✕</button></div>
    <p style="padding:1rem 1.5rem;color:#e74c3c;font-weight:600;">This action cannot be undone!</p>
    <div class="modal-footer"><button class="btn-secondary" id="cancelDeleteAll">Cancel</button><button class="btn-danger" id="confirmDeleteAll">Delete All Items</button></div>
  </div>
</div>

<div id="toast" class="toast hidden"></div>

<script>
// Inject API key from Streamlit secrets
window.__GEMINI_KEY__ = "{gemini_key}";

// Inline sample data so no fetch needed
const SAMPLE_DATA = {sample};

// Override fetch for sample.json
const _originalFetch = window.fetch;
window.fetch = function(url, options) {{
  if (typeof url === 'string' && url.includes('sample.json')) {{
    return Promise.resolve({{
      ok: true,
      json: () => Promise.resolve(SAMPLE_DATA)
    }});
  }}
  return _originalFetch(url, options);
}};
</script>

<script>{setup}</script>
<script>{ai_js}</script>
<script>{chatbot}</script>
<script>{app_js}</script>
<script>{history}</script>

</body>
</html>
"""

components.html(full_html, height=1200, scrolling=True)
