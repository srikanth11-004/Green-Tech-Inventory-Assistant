// ===== GLOBAL STATE =====
window.inventory = [];
let filteredInventory = [];
let editIndex = null;
let deleteIndex = null;

// ===== DOM ELEMENTS =====
const tableBody = document.getElementById("inventoryTableBody");
const gridView = document.getElementById("inventoryGrid");
const emptyState = document.getElementById("emptyState");
const tableViewDiv = document.getElementById("tableView");
const gridViewDiv = document.getElementById("gridView");

const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const filterAlert = document.getElementById("filterAlert");
const sortBy = document.getElementById("sortBy");
const resultCount = document.getElementById("resultCount");

// Stats
const statTotal = document.getElementById("statTotal");
const statLowStock = document.getElementById("statLowStock");
const statExpiring = document.getElementById("statExpiring");
const statScore = document.getElementById("statSustainScore");
const statValue = document.getElementById("statInventoryValue");

// Modal
const modal = document.getElementById("itemModal");
const form = document.getElementById("itemForm");
const deleteModal = document.getElementById("deleteModal");

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  loadSampleData();
  attachEvents();
});

// ===== LOAD SAMPLE DATA =====
async function loadSampleData() {
  // First check if there's saved data in localStorage
  const savedData = localStorage.getItem('inventoryData');
  if (savedData) {
    try {
      window.inventory = JSON.parse(savedData);
      console.log('✅ Loaded saved data from localStorage:', window.inventory.length, 'items');
      applyFilters();
      return;
    } catch (err) {
      console.error('Error parsing saved data:', err);
      localStorage.removeItem('inventoryData');
    }
  }
  
  // Check if user has cleared data before
  const dataCleared = localStorage.getItem('dataCleared');
  if (dataCleared === 'true') {
    console.log('Data was cleared by user, not loading sample data');
    window.inventory = [];
    applyFilters();
    return;
  }
  
  // Load sample data as fallback
  try {
    const res = await fetch("data/sample.json");
    window.inventory = await res.json();
    console.log('✅ Sample data loaded:', window.inventory.length, 'items');
    // Save to localStorage
    localStorage.setItem('inventoryData', JSON.stringify(window.inventory));
    applyFilters();
  } catch (err) {
    console.error("Error loading data:", err);
    showToast("Failed to load sample data", "error");
  }
}

// ===== CSV IMPORT =====
document.getElementById("importCsvBtn").onclick = () => {
  document.getElementById("csvFileInput").click();
};

document.getElementById("csvFileInput").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const lines = reader.result.split("\n");
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ''));
      const newItems = [];

      console.log('CSV Headers:', headers);

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Handle CSV with quoted values
        const cols = lines[i].match(/(?:"([^"]*)"|([^,]+))/g).map(col => 
          col.replace(/^"|"$/g, '').trim()
        );
        
        console.log(`Row ${i}:`, cols);
        
        const item = {
          Product_ID: cols[0] || "ID-" + Date.now(),
          Product_Name: cols[1] || "",
          Category: cols[2] || "",
          Supplier_ID: cols[3] || "",
          Supplier_Name: cols[4] || "",
          Stock_Quantity: parseInt(cols[5]) || 0,
          Reorder_Level: parseInt(cols[6]) || 0,
          Reorder_Quantity: parseInt(cols[7]) || 0,
          Unit_Price: parseFloat(cols[8]?.replace(/[^0-9.]/g, '')) || 0,
          Date_Received: cols[9] || "",
          Last_Order_Date: cols[10] || "",
          Expiration_Date: cols[11] || "",
          Warehouse_Location: cols[12] || "",
          Sales_Volume: parseInt(cols[13]) || 0,
          Inventory_Turnover_Rate: parseInt(cols[14]) || 0,
          Status: cols[15] || "Active"
        };
        
        if (i <= 3) {
          console.log(`Row ${i} - Product: ${item.Product_Name}, Unit_Price raw: '${cols[8]}', cleaned: '${cols[8]?.replace(/[^0-9.]/g, '')}', parsed: ${item.Unit_Price}`);
        }
        
        if (item.Product_Name) newItems.push(item);
      }

      window.inventory = newItems;
      localStorage.removeItem('dataCleared');
      localStorage.setItem('inventoryData', JSON.stringify(newItems));
      applyFilters();
      showToast(`Imported ${newItems.length} items`, "success");
      console.log('Import complete. Sample item:', newItems[0]);
    } catch (err) {
      console.error("CSV parse error:", err);
      showToast("Failed to parse CSV", "error");
    }
  };
  reader.readAsText(file);
};

// ===== CRUD: CREATE =====
function createItem(itemData) {
  if (!itemData.Product_Name || !itemData.Category || !itemData.Supplier_Name) {
    showToast("Missing required fields", "error");
    return false;
  }
  if (itemData.Unit_Price < 0 || itemData.Stock_Quantity < 0) {
    showToast("Price and stock cannot be negative", "error");
    return false;
  }

  const newItem = {
    Product_ID: "ID-" + Date.now(),
    Product_Name: itemData.Product_Name,
    Category: itemData.Category,
    Supplier_Name: itemData.Supplier_Name,
    Stock_Quantity: itemData.Stock_Quantity || 0,
    Reorder_Level: itemData.Reorder_Level || 0,
    Reorder_Quantity: itemData.Reorder_Quantity || 0,
    Unit_Price: itemData.Unit_Price || 0,
    Date_Received: itemData.Date_Received || new Date().toISOString().split("T")[0],
    Expiration_Date: itemData.Expiration_Date || "",
    Warehouse_Location: itemData.Warehouse_Location || "",
    Sales_Volume: itemData.Sales_Volume || 0,
    Inventory_Turnover_Rate: itemData.Inventory_Turnover_Rate || 0,
    Status: itemData.Status || "Active"
  };

  window.inventory.push(newItem);
  localStorage.setItem('inventoryData', JSON.stringify(window.inventory));
  showToast("Item added successfully", "success");
  return true;
}

// ===== CRUD: READ =====
function getItem(index) {
  return window.inventory[index] || null;
}

function getAllItems() {
  return [...window.inventory];
}

function searchItems(query) {
  const lower = query.toLowerCase();
  return window.inventory.filter(
    (item) =>
      item.Product_Name.toLowerCase().includes(lower) ||
      item.Category.toLowerCase().includes(lower) ||
      item.Supplier_Name.toLowerCase().includes(lower)
  );
}

// ===== CRUD: UPDATE =====
function updateItem(index, itemData) {
  if (index < 0 || index >= window.inventory.length) {
    showToast("Item not found", "error");
    return false;
  }
  if (!itemData.Product_Name || !itemData.Category) {
    showToast("Missing required fields", "error");
    return false;
  }

  window.inventory[index] = {
    ...window.inventory[index],
    Product_Name: itemData.Product_Name,
    Category: itemData.Category,
    Supplier_Name: itemData.Supplier_Name,
    Stock_Quantity: itemData.Stock_Quantity,
    Reorder_Level: itemData.Reorder_Level,
    Reorder_Quantity: itemData.Reorder_Quantity,
    Unit_Price: itemData.Unit_Price,
    Expiration_Date: itemData.Expiration_Date,
    Warehouse_Location: itemData.Warehouse_Location,
    Sales_Volume: itemData.Sales_Volume,
    Status: itemData.Status
  };

  localStorage.setItem('inventoryData', JSON.stringify(window.inventory));
  showToast("Item updated successfully", "success");
  return true;
}

// ===== CRUD: DELETE =====
function deleteItemByIndex(index) {
  if (index < 0 || index >= window.inventory.length) {
    showToast("Item not found", "error");
    return false;
  }
  const deleted = window.inventory.splice(index, 1);
  localStorage.setItem('inventoryData', JSON.stringify(window.inventory));
  showToast(`Deleted: ${deleted[0].Product_Name}`, "success");
  return true;
}

// ===== MODAL: ADD/EDIT =====
document.getElementById("openAddModal").onclick = () => {
  document.getElementById("modalTitle").innerText = "Add New Item";
  modal.classList.remove("hidden");
  form.reset();
  editIndex = null;
  clearFormErrors();
};

document.getElementById("closeModal").onclick = () => {
  modal.classList.add("hidden");
};

document.getElementById("modalOverlay").onclick = () => {
  modal.classList.add("hidden");
};

document.getElementById("cancelModal").onclick = () => {
  modal.classList.add("hidden");
};

form.onsubmit = (e) => {
  e.preventDefault();
  clearFormErrors();

  const itemData = {
    Product_Name: document.getElementById("f_name").value.trim(),
    Category: document.getElementById("f_category").value,
    Supplier_Name: document.getElementById("f_supplier").value.trim(),
    Unit_Price: parseFloat(document.getElementById("f_price").value) || 0,
    Stock_Quantity: parseInt(document.getElementById("f_stock").value) || 0,
    Reorder_Level: parseInt(document.getElementById("f_reorder").value) || 0,
    Reorder_Quantity: parseInt(document.getElementById("f_reorder_qty").value) || 0,
    Sales_Volume: parseInt(document.getElementById("f_sales").value) || 0,
    Date_Received: document.getElementById("f_received").value,
    Expiration_Date: document.getElementById("f_expiry").value,
    Warehouse_Location: document.getElementById("f_location").value.trim(),
    Status: document.getElementById("f_status").value
  };

  // Validation
  if (!itemData.Product_Name) {
    showFieldError("f_name", "Product name is required");
    return;
  }
  if (!itemData.Category) {
    showFieldError("f_category", "Category is required");
    return;
  }
  if (!itemData.Supplier_Name) {
    showFieldError("f_supplier", "Supplier name is required");
    return;
  }
  if (itemData.Unit_Price < 0) {
    showFieldError("f_price", "Price cannot be negative");
    return;
  }
  if (itemData.Stock_Quantity < 0) {
    showFieldError("f_stock", "Stock cannot be negative");
    return;
  }

  let success = false;
  if (editIndex !== null) {
    success = updateItem(editIndex, itemData);
  } else {
    success = createItem(itemData);
  }

  if (success) {
    modal.classList.add("hidden");
    applyFilters();
  }
};

// ===== MODAL: EDIT =====
window.editItem = (i) => {
  const item = filteredInventory[i];
  editIndex = window.inventory.indexOf(item);

  document.getElementById("modalTitle").innerText = "Edit Item";
  document.getElementById("f_name").value = item.Product_Name || "";
  document.getElementById("f_category").value = item.Category || "";
  document.getElementById("f_supplier").value = item.Supplier_Name || "";
  document.getElementById("f_price").value = item.Unit_Price || "";
  document.getElementById("f_stock").value = item.Stock_Quantity || "";
  document.getElementById("f_reorder").value = item.Reorder_Level || "";
  document.getElementById("f_reorder_qty").value = item.Reorder_Quantity || "";
  document.getElementById("f_sales").value = item.Sales_Volume || "";
  document.getElementById("f_received").value = item.Date_Received || "";
  document.getElementById("f_expiry").value = item.Expiration_Date || "";
  document.getElementById("f_location").value = item.Warehouse_Location || "";
  document.getElementById("f_status").value = item.Status || "Active";

  clearFormErrors();
  modal.classList.remove("hidden");
};

// ===== MODAL: DELETE =====
window.deleteItem = (i) => {
  deleteIndex = i;
  const item = filteredInventory[i];
  document.getElementById("deleteMsg").innerText = `Are you sure you want to delete "${item.Product_Name}"?`;
  deleteModal.classList.remove("hidden");
};

document.getElementById("closeDelete").onclick = () => {
  deleteModal.classList.add("hidden");
};

document.getElementById("deleteOverlay").onclick = () => {
  deleteModal.classList.add("hidden");
};

document.getElementById("cancelDelete").onclick = () => {
  deleteModal.classList.add("hidden");
};

document.getElementById("confirmDelete").onclick = () => {
  if (deleteIndex !== null) {
    const item = filteredInventory[deleteIndex];
    const idx = window.inventory.indexOf(item);
    deleteItemByIndex(idx);
    deleteModal.classList.add("hidden");
    applyFilters();
  }
};

// ===== MODAL: DELETE ALL =====
const deleteAllModal = document.getElementById("deleteAllModal");

document.getElementById("deleteAllBtn").onclick = () => {
  if (window.inventory.length === 0) {
    showToast("No items to delete", "error");
    return;
  }
  deleteAllModal.classList.remove("hidden");
};

document.getElementById("closeDeleteAll").onclick = () => {
  deleteAllModal.classList.add("hidden");
};

document.getElementById("deleteAllOverlay").onclick = () => {
  deleteAllModal.classList.add("hidden");
};

document.getElementById("cancelDeleteAll").onclick = () => {
  deleteAllModal.classList.add("hidden");
};

document.getElementById("confirmDeleteAll").onclick = () => {
  const count = window.inventory.length;
  window.inventory = [];
  localStorage.setItem('dataCleared', 'true');
  localStorage.removeItem('inventoryData');
  deleteAllModal.classList.add("hidden");
  applyFilters();
  showToast(`Deleted all ${count} items. Data will not reload on refresh.`, "success");
};

// ===== FILTER + SEARCH =====
function applyFilters() {
  const search = searchInput.value.toLowerCase();
  const category = filterCategory.value;
  const status = filterStatus.value;
  const alert = filterAlert.value;

  filteredInventory = window.inventory.filter((item) => {
    const matchSearch =
      !search ||
      item.Product_Name.toLowerCase().includes(search) ||
      item.Supplier_Name.toLowerCase().includes(search) ||
      item.Category.toLowerCase().includes(search);

    const matchCategory = !category || item.Category === category;
    const matchStatus = !status || item.Status === status;

    let matchAlert = true;
    if (alert) {
      const today = new Date();
      const daysToExpiry = item.Expiration_Date
        ? Math.ceil((new Date(item.Expiration_Date) - today) / 86400000)
        : 999;

      if (alert === "low_stock") {
        matchAlert = item.Stock_Quantity <= item.Reorder_Level;
      } else if (alert === "expiring") {
        matchAlert = daysToExpiry >= 0 && daysToExpiry <= 7;
      } else if (alert === "expired") {
        matchAlert = daysToExpiry < 0;
      }
    }

    return matchSearch && matchCategory && matchStatus && matchAlert;
  });

  sortData();
  render();
  updateStats();
  updateResultCount();
}

// ===== SORT =====
function sortData() {
  const key = sortBy.value;

  filteredInventory.sort((a, b) => {
    if (key === "name") return a.Product_Name.localeCompare(b.Product_Name);
    if (key === "stock") return a.Stock_Quantity - b.Stock_Quantity;
    if (key === "price") return a.Unit_Price - b.Unit_Price;
    if (key === "turnover") return (b.Inventory_Turnover_Rate || 0) - (a.Inventory_Turnover_Rate || 0);
    if (key === "expiry") {
      const dateA = a.Expiration_Date ? new Date(a.Expiration_Date) : new Date(9999, 0, 0);
      const dateB = b.Expiration_Date ? new Date(b.Expiration_Date) : new Date(9999, 0, 0);
      return dateA - dateB;
    }
    return 0;
  });
}

// ===== RENDER TABLE & GRID =====
function render() {
  tableBody.innerHTML = "";
  gridView.innerHTML = "";

  if (!filteredInventory.length) {
    emptyState.classList.remove("hidden");
    tableViewDiv.style.display = "none";
    gridViewDiv.style.display = "none";
    return;
  }

  emptyState.classList.add("hidden");
  tableViewDiv.style.display = "block";

  filteredInventory.forEach((item, i) => {
    const expiry = AI.analyzeExpiryRuleBased(item);
    const reorder = AI.predictReorderRuleBased(item);

    // TABLE ROW
    const tr = document.createElement("tr");
    if (expiry.level === "expired" || expiry.level === "critical") {
      tr.classList.add("row-danger");
    } else if (expiry.level === "warning" || reorder.needsReorder) {
      tr.classList.add("row-warn");
    }

    const expiryBadge = getExpiryBadge(expiry.level);
    const statusBadge = `<span class="badge badge-${item.Status.toLowerCase()}">${item.Status}</span>`;

    tr.innerHTML = `
      <td><strong>${item.Product_Name}</strong></td>
      <td>${item.Category}</td>
      <td>${item.Stock_Quantity}</td>
      <td>${item.Reorder_Level}</td>
      <td>$${item.Unit_Price.toFixed(2)}</td>
      <td>${item.Expiration_Date || "—"}</td>
      <td>${item.Supplier_Name}</td>
      <td>${statusBadge}</td>
      <td>${expiryBadge}</td>
      <td>
        <button class="btn-icon edit" onclick="editItem(${i})" title="Edit">✏️</button>
        <button class="btn-icon delete" onclick="deleteItem(${i})" title="Delete">🗑️</button>
      </td>
    `;

    tableBody.appendChild(tr);

    // GRID CARD
    const card = document.createElement("div");
    card.className = "grid-card";
    if (expiry.level === "expired" || expiry.level === "critical") {
      card.classList.add("card-danger");
    } else if (expiry.level === "warning") {
      card.classList.add("card-warn");
    }

    card.innerHTML = `
      <div class="grid-card-name">${item.Product_Name}</div>
      <div class="grid-card-cat">${item.Category}</div>
      <div class="grid-card-price">$${item.Unit_Price.toFixed(2)}</div>
      <div class="grid-card-stock">Stock: ${item.Stock_Quantity} / ${item.Reorder_Level}</div>
      <div>${expiryBadge}</div>
      <div class="grid-card-actions">
        <button class="btn-icon edit" onclick="editItem(${i})">✏️</button>
        <button class="btn-icon delete" onclick="deleteItem(${i})">🗑️</button>
      </div>
    `;

    gridView.appendChild(card);
  });
}

// ===== STATS =====
function updateStats() {
  statTotal.innerText = window.inventory.length;

  const low = window.inventory.filter((i) => i.Stock_Quantity <= i.Reorder_Level).length;
  statLowStock.innerText = low;

  const today = new Date();
  const exp = window.inventory.filter((i) => {
    if (!i.Expiration_Date) return false;
    const d = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
    return d >= 0 && d <= 7;
  }).length;
  statExpiring.innerText = exp;

  const score = AI.calcSustainabilityScore(window.inventory);
  statScore.innerText = score + "%";

  const value = window.inventory.reduce((sum, i) => sum + i.Unit_Price * i.Stock_Quantity, 0);
  statValue.innerText = "$" + value.toFixed(2);
}

function updateResultCount() {
  resultCount.innerText = `${filteredInventory.length} of ${window.inventory.length} items`;
}

// ===== AI CATEGORY AUTO-DETECT =====
document.getElementById("autoCategoryBtn").onclick = async () => {
  const name = document.getElementById("f_name").value;
  if (!name) {
    showToast("Enter product name first", "error");
    return;
  }
  const res = await AI.detectCategory(name);
  document.getElementById("f_category").value = res.category;
  const source = res.source === "ai" ? "🤖 AI" : "📋 Rule-based";
  showToast(`Category detected (${source}): ${res.category}`, "success");
};

// ===== AI INSIGHTS =====
document.getElementById("runAiBtn").onclick = async () => {
  const btn = document.getElementById("runAiBtn");
  const container = document.getElementById("aiInsightsContent");
  
  // Show loading state
  btn.disabled = true;
  btn.innerText = "Analyzing...";
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:#fff;font-size:0.95rem;">🤖 Analyzing window.inventory with Gemini AI...</div>';
  
  const { insights, source } = await AI.getBatchInsights(window.inventory);
  container.innerHTML = "";

  insights.forEach((insight, index) => {
    const div = document.createElement("div");
    
    // Map category to type for styling
    let cardType = 'ok';
    if (insight.category === 'critical') cardType = 'danger';
    else if (insight.category === 'warning' || insight.category === 'risk') cardType = 'warn';
    else if (insight.category === 'optimization') cardType = 'ok';
    
    div.className = "ai-insight-card " + cardType;
    const sourceLabel = source === "ai" ? "🤖 AI" : "📋 Rule";
    
    // Decode HTML entities
    const decodeHTML = (text) => text
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    
    const title = decodeHTML(insight.title || '');
    const summary = decodeHTML(insight.summary || insight.message || '');
    const details = decodeHTML(insight.details || '');
    const impact = decodeHTML(insight.impact || '');
    const action = decodeHTML(insight.action || '');
    const icon = insight.icon || '📊';
    const cta = insight.cta || 'View Details';
    const priority = insight.priority || 'medium';
    
    div.innerHTML = `
      <div class="ai-fallback">${sourceLabel}</div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
        <span style="font-size:1.5rem;">${icon}</span>
        <strong style="flex:1;">${title}</strong>
        ${priority === 'high' ? '<span style="background:#ef4444;color:#fff;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.7rem;font-weight:600;">HIGH</span>' : ''}
      </div>
      ${summary ? `<p style="margin:0.4rem 0;font-weight:500;color:#1f2937;">${summary}</p>` : ''}
      ${details ? `<p style="margin:0.4rem 0;font-size:0.85rem;color:#6b7280;">${details}</p>` : ''}
      ${impact ? `<div style="margin:0.6rem 0;padding:0.5rem;background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;border-radius:4px;font-size:0.82rem;"><strong>⚠️ Impact:</strong> ${impact}</div>` : ''}
      ${action ? `<div style="margin:0.6rem 0;padding:0.5rem;background:rgba(16,185,129,0.1);border-left:3px solid #10b981;border-radius:4px;font-size:0.82rem;"><strong>✅ Action:</strong> ${action}</div>` : ''}
      ${cta && cta !== 'View Details' ? `<button class="insight-cta-btn" data-action="${encodeURIComponent(action)}" data-insight-index="${index}" style="margin-top:0.6rem;background:#667eea;color:#fff;border:none;padding:0.4rem 1rem;border-radius:6px;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s;">${cta}</button>` : ''}
    `;
    container.appendChild(div);
  });
  
  // Attach CTA button handlers
  document.querySelectorAll('.insight-cta-btn').forEach(btn => {
    btn.addEventListener('click', handleInsightCTA);
  });
  
  // Reset button
  btn.disabled = false;
  btn.innerText = "Run Analysis";
};

// Handle CTA button clicks
function handleInsightCTA(e) {
  const action = decodeURIComponent(e.target.getAttribute('data-action'));
  const ctaText = e.target.innerText;
  
  // Open chatbot with pre-filled action
  const chatWindow = document.getElementById('chatWindow');
  const chatInput = document.getElementById('chatInput');
  
  chatWindow.classList.remove('hidden');
  
  // Generate smart question based on CTA
  let question = '';
  
  if (ctaText.toLowerCase().includes('reorder')) {
    question = 'Show me the items that need reordering and their suppliers';
  } else if (ctaText.toLowerCase().includes('review') || ctaText.toLowerCase().includes('check')) {
    question = `Help me with: ${action}`;
  } else if (ctaText.toLowerCase().includes('audit') || ctaText.toLowerCase().includes('remove')) {
    question = 'Which items are expired and need to be removed?';
  } else if (ctaText.toLowerCase().includes('discount') || ctaText.toLowerCase().includes('promote')) {
    question = 'Which items are expiring soon and should be discounted?';
  } else if (ctaText.toLowerCase().includes('increase') || ctaText.toLowerCase().includes('adjust')) {
    question = `How can I: ${action}`;
  } else {
    question = action || 'Tell me more about this issue';
  }
  
  chatInput.value = question;
  chatInput.focus();
  
  // Auto-send after a brief delay
  setTimeout(() => {
    if (chatInput.value === question) {
      document.getElementById('chatSendBtn').click();
    }
  }, 500);
}

// ===== VIEW TOGGLE =====
document.getElementById("viewTable").onclick = () => {
  tableViewDiv.style.display = "block";
  gridViewDiv.classList.remove("hidden");
  gridViewDiv.style.display = "none";
  document.getElementById("viewTable").classList.add("active");
  document.getElementById("viewGrid").classList.remove("active");
};

document.getElementById("viewGrid").onclick = () => {
  tableViewDiv.style.display = "none";
  gridViewDiv.classList.remove("hidden");
  gridViewDiv.style.display = "grid";
  document.getElementById("viewGrid").classList.add("active");
  document.getElementById("viewTable").classList.remove("active");
};

// ===== EVENTS =====
function attachEvents() {
  searchInput.oninput = applyFilters;
  filterCategory.onchange = applyFilters;
  filterStatus.onchange = applyFilters;
  filterAlert.onchange = applyFilters;
  sortBy.onchange = applyFilters;

  document.getElementById("clearFilters").onclick = () => {
    searchInput.value = "";
    filterCategory.value = "";
    filterStatus.value = "";
    filterAlert.value = "";
    sortBy.value = "name";
    applyFilters();
  };

  document.getElementById("emptyAddBtn").onclick = () => {
    document.getElementById("openAddModal").click();
  };
}

// ===== HELPERS =====
function getExpiryBadge(level) {
  const badges = {
    expired: '<span class="badge badge-expired">🚨 Expired</span>',
    critical: '<span class="badge badge-expiring">🔴 Expires Soon</span>',
    warning: '<span class="badge badge-expiring">🟠 Expiring</span>',
    soon: '<span class="badge badge-low">🟡 Monitor</span>',
    ok: '<span class="badge badge-ok">✅ OK</span>',
    unknown: '<span class="badge badge-ok">—</span>'
  };
  return badges[level] || badges.unknown;
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById("err_" + fieldId.substring(2));
  if (field) field.classList.add("invalid");
  if (errorEl) errorEl.innerText = message;
}

function clearFormErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.innerText = ""));
  document.querySelectorAll("input, select").forEach((el) => el.classList.remove("invalid"));
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

// ===== TESTS =====

// ✅ TEST 1: Happy Path - Add Item
function testAddItem() {
  const before = window.inventory.length;
  const success = createItem({
    Product_Name: "Test Coffee",
    Category: "Beverages",
    Supplier_Name: "TestSupplier",
    Unit_Price: 10,
    Stock_Quantity: 50,
    Reorder_Level: 20
  });
  const after = window.inventory.length;
  console.assert(success && after === before + 1, "❌ Test Add Item FAILED");
  console.log("✅ Test Add Item PASSED");
  return success && after === before + 1;
}

// ⚠️ TEST 2: Edge Case - Empty window.inventory Filter
function testEmptyInventoryFilter() {
  const backup = [...window.inventory];
  window.inventory = [];
  applyFilters();
  const isEmpty = filteredInventory.length === 0;
  console.assert(isEmpty, "❌ Test Empty Filter FAILED");
  console.log("✅ Test Empty Filter PASSED");
  window.inventory = backup;
  return isEmpty;
}

// Run tests on load
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    console.log("\n=== RUNNING TESTS ===");
    console.log("Tests disabled to prevent data loss on import");
    console.log("=== TESTS COMPLETE ===\n");
  }, 1000);
});


// ===== AI DETAILED ANALYSIS =====
window.showAIAnalysis = async (i) => {
  const item = filteredInventory[i];
  const modal = document.getElementById("detailModal");
  const content = document.getElementById("detailContent");
  
  document.getElementById("detailTitle").innerText = `AI Analysis: ${item.Product_Name}`;
  content.innerHTML = '<div style="padding:2rem;text-align:center;">🤖 Analyzing with Gemini AI...</div>';
  modal.classList.remove("hidden");

  try {
    // Run all AI analyses in parallel
    const [stockPrediction, sensitivity, reorderRecs] = await Promise.all([
      AI.predictStockout(item),
      AI.analyzeSensitivity(item),
      AI.getSmartReorderRecommendations([item])
    ]);

    const expiry = AI.analyzeExpiryRuleBased(item);

    content.innerHTML = `
      <div style="padding:1.5rem;">
        <!-- Stock Prediction -->
        <div style="background:#f1f8e9;border:1px solid #c8e6c9;border-radius:6px;padding:1rem;margin-bottom:1rem;">
          <h4 style="color:#2e7d32;margin-bottom:0.5rem;">📊 Stock Prediction</h4>
          <p><strong>Days Until Stockout:</strong> ${stockPrediction.daysUntilStockout} days</p>
          <p><strong>Confidence:</strong> ${stockPrediction.confidence}</p>
          <p><strong>Urgency:</strong> <span style="color:${stockPrediction.urgency === 'critical' ? '#e74c3c' : stockPrediction.urgency === 'high' ? '#ff9800' : '#2ecc71'}">${stockPrediction.urgency.toUpperCase()}</span></p>
          <p><strong>Recommendation:</strong> ${stockPrediction.recommendation}</p>
          <p style="font-size:0.75rem;color:#888;margin-top:0.5rem;">Source: ${stockPrediction.source === 'ai' ? '🤖 Gemini AI' : '📋 Rule-based'}</p>
        </div>

        <!-- Sensitivity Analysis -->
        <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:1rem;margin-bottom:1rem;">
          <h4 style="color:#f57c00;margin-bottom:0.5rem;">⚠️ Sensitivity Analysis</h4>
          <p><strong>Overall Sensitivity:</strong> ${sensitivity.sensitivity.toUpperCase()}</p>
          <p><strong>Perishability:</strong> ${sensitivity.perishability.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Demand Volatility:</strong> ${sensitivity.demandVolatility.toUpperCase()}</p>
          <p><strong>Business Impact:</strong> ${sensitivity.businessImpact.toUpperCase()}</p>
          <p><strong>Recommendation:</strong> ${sensitivity.recommendation}</p>
          <p style="font-size:0.75rem;color:#888;margin-top:0.5rem;">Source: ${sensitivity.source === 'ai' ? '🤖 Gemini AI' : '📋 Rule-based'}</p>
        </div>

        <!-- Expiry Risk -->
        <div style="background:#fce4ec;border:1px solid #f48fb1;border-radius:6px;padding:1rem;margin-bottom:1rem;">
          <h4 style="color:#c2185b;margin-bottom:0.5rem;">🗓️ Expiry Risk</h4>
          <p><strong>Days Until Expiry:</strong> ${expiry.daysLeft !== null ? expiry.daysLeft + ' days' : 'No expiry date'}</p>
          <p><strong>Risk Level:</strong> ${expiry.level.toUpperCase()}</p>
          <p><strong>Message:</strong> ${expiry.message}</p>
        </div>

        <!-- Reorder Recommendations -->
        ${reorderRecs.recommendations.length > 0 ? `
        <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:1rem;">
          <h4 style="color:#1565c0;margin-bottom:0.5rem;">🛒 Smart Reorder Recommendation</h4>
          ${reorderRecs.recommendations.map(rec => `
            <div style="margin-bottom:0.5rem;padding:0.5rem;background:#fff;border-radius:4px;">
              <p><strong>Action:</strong> ${rec.action.toUpperCase()}</p>
              <p><strong>Quantity:</strong> ${rec.quantity} units</p>
              <p><strong>Priority:</strong> <span style="color:${rec.priority === 'critical' ? '#e74c3c' : rec.priority === 'high' ? '#ff9800' : '#2ecc71'}">${rec.priority.toUpperCase()}</span></p>
              <p><strong>Reason:</strong> ${rec.reason}</p>
              <p><strong>Estimated Cost:</strong> $${rec.estimatedCost.toFixed(2)}</p>
            </div>
          `).join('')}
          <p style="font-size:0.75rem;color:#888;margin-top:0.5rem;">Source: ${reorderRecs.source === 'ai' ? '🤖 Gemini AI' : '📋 Rule-based'}</p>
        </div>
        ` : '<p style="color:#888;">No reorder needed at this time.</p>'}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;color:#e74c3c;">❌ Analysis failed: ${err.message}</div>`;
  }
};

document.getElementById("closeDetail").onclick = () => {
  document.getElementById("detailModal").classList.add("hidden");
};

document.getElementById("detailOverlay").onclick = () => {
  document.getElementById("detailModal").classList.add("hidden");
};
