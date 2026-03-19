/**
 * chatbot.js - AI-powered inventory assistant chatbot
 * Uses Gemini AI to answer questions about inventory
 */

const Chatbot = (() => {
  let conversationHistory = [];
  let isProcessing = false;

  function init() {
    createChatUI();
    attachChatEvents();
  }

  function createChatUI() {
    const chatHTML = `
      <!-- Floating Chat Button -->
      <button id="chatToggleBtn" class="chat-toggle-btn" title="Ask AI Assistant">
        💬
      </button>

      <!-- Chat Window -->
      <div id="chatWindow" class="chat-window hidden">
        <div class="chat-header">
          <div class="chat-header-info">
            <span class="chat-avatar">🤖</span>
            <div>
              <div class="chat-title">Inventory Assistant</div>
              <div class="chat-status">Online</div>
            </div>
          </div>
          <button id="chatCloseBtn" class="chat-close-btn">✕</button>
        </div>
        
        <div id="chatMessages" class="chat-messages">
          <div class="chat-message ai-message">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
              <p>Hi! I'm your AI inventory assistant. Ask me anything about your inventory:</p>
              <div class="quick-questions">
                <button class="quick-q" data-q="What items are expiring soon?">📅 Expiring items?</button>
                <button class="quick-q" data-q="Which products are overstocked?">📦 Overstocked?</button>
                <button class="quick-q" data-q="What should I reorder today?">🛒 Reorder list?</button>
                <button class="quick-q" data-q="Show me low stock items">⚠️ Low stock?</button>
              </div>
            </div>
          </div>
        </div>

        <div class="chat-input-container">
          <input 
            type="text" 
            id="chatInput" 
            class="chat-input" 
            placeholder="Ask about your inventory..."
            autocomplete="off"
          />
          <button id="chatSendBtn" class="chat-send-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);
  }

  function attachChatEvents() {
    const toggleBtn = document.getElementById('chatToggleBtn');
    const closeBtn = document.getElementById('chatCloseBtn');
    const chatWindow = document.getElementById('chatWindow');
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');

    toggleBtn.onclick = () => {
      chatWindow.classList.toggle('hidden');
      if (!chatWindow.classList.contains('hidden')) {
        input.focus();
      }
    };

    closeBtn.onclick = () => {
      chatWindow.classList.add('hidden');
    };

    sendBtn.onclick = () => sendMessage();
    
    input.onkeypress = (e) => {
      if (e.key === 'Enter' && !isProcessing) {
        sendMessage();
      }
    };

    // Quick question buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-q')) {
        const question = e.target.getAttribute('data-q');
        input.value = question;
        sendMessage();
      }
    });
  }

  async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || isProcessing) return;

    // Add user message
    addMessage(message, 'user');
    input.value = '';
    input.disabled = true;
    isProcessing = true;

    // Show typing indicator
    showTypingIndicator();

    // Always use AI for all questions
    try {
      console.log('Sending question to Gemini AI:', message);
      const response = await getAIResponse(message);
      removeTypingIndicator();
      addMessage(response, 'ai');
    } catch (error) {
      console.error('Message error:', error);
      removeTypingIndicator();
      addMessage('Sorry, I encountered an error. Please try again.', 'ai');
    }

    input.disabled = false;
    input.focus();
    isProcessing = false;
  }

  function addMessage(text, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    const avatar = sender === 'ai' ? '🤖' : '👤';
    
    // Ensure text is never null or undefined
    let messageText = text || 'I apologize, but I could not generate a response. Please try again.';
    
    // Convert markdown formatting to HTML for AI messages
    if (sender === 'ai') {
      messageText = formatMarkdown(messageText);
    }
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <p>${messageText}</p>
      </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // Store in history
    conversationHistory.push({ role: sender, content: text });
  }

  function formatMarkdown(text) {
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Convert bullet points • to proper list items
    text = text.replace(/^[•\-\*]\s+(.+)$/gm, '<br>• $1');
    
    // Decode HTML entities
    text = text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    return text;
  }

  function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message ai-message typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
  }

  function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function getAIResponse(userQuestion) {
    const key = window.__GEMINI_KEY__;
    const inventory = window.inventory || [];
    
    console.log('=== GEMINI AI CALL ===');
    console.log('API Key exists:', !!key);
    console.log('Inventory count:', inventory.length);
    console.log('Question:', userQuestion);
    
    if (!key) {
      console.error('No API key found!');
      return getRuleBasedResponse(userQuestion);
    }

    if (inventory.length === 0) {
      return 'Inventory data is still loading. Please wait a moment and try again.';
    }

    // Prepare context with inventory data
    const inventoryContext = prepareInventoryContext();
    console.log('Context prepared, length:', inventoryContext.length);
    
    try {
      console.log('Calling Gemini API...');
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`;
      console.log('API URL:', apiUrl.replace(key, 'API_KEY_HIDDEN'));
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful inventory management assistant with access to real-time inventory data.

IMPORTANT: Use the inventory data below to answer questions accurately with specific product names, quantities, and details.

${inventoryContext}

User Question: ${userQuestion}

Provide a helpful, specific answer based on the data above. Use bullet points for lists. Be conversational and friendly.`
            }]
          }]
        })
      });

      console.log('API Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', res.status, errorText);
        throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();
      console.log('API Response received:', JSON.stringify(data, null, 2));
      
      // Check for API errors in response
      if (data.error) {
        console.error('API returned error:', data.error);
        throw new Error(data.error.message || 'API Error');
      }
      
      const response = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!response) {
        console.error('Empty response from AI. Full data:', JSON.stringify(data));
        throw new Error('Empty response from AI');
      }
      
      console.log('AI Response:', response.substring(0, 200) + '...');
      return response;
    } catch (error) {
      console.error('AI response error:', error);
      console.log('Falling back to rule-based response');
      return getRuleBasedResponse(userQuestion);
    }
  }

  function prepareInventoryContext() {
    // Access inventory from global scope (set by app.js)
    const inventory = window.inventory || [];
    
    console.log('Chatbot: Inventory items found:', inventory.length);
    
    const today = new Date();
    
    // Get key metrics
    const totalItems = inventory.length;
    const lowStock = inventory.filter(i => i.Stock_Quantity <= i.Reorder_Level);
    const expiringSoon = inventory.filter(i => {
      if (!i.Expiration_Date) return false;
      const days = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
      return days >= 0 && days <= 7;
    });
    const expired = inventory.filter(i => {
      if (!i.Expiration_Date) return false;
      return new Date(i.Expiration_Date) < today;
    });
    const overstocked = inventory.filter(i => i.Stock_Quantity > i.Reorder_Level * 3);
    
    // Get detailed lists
    const lowStockList = lowStock.slice(0, 10).map(i => ({
      name: i.Product_Name,
      stock: i.Stock_Quantity,
      reorder: i.Reorder_Level,
      supplier: i.Supplier_Name
    }));
    
    const expiringList = expiringSoon.slice(0, 10).map(i => {
      const days = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
      return {
        name: i.Product_Name,
        daysLeft: days,
        stock: i.Stock_Quantity
      };
    });
    
    const overstockedList = overstocked.slice(0, 10).map(i => ({
      name: i.Product_Name,
      stock: i.Stock_Quantity,
      reorder: i.Reorder_Level,
      ratio: Math.round(i.Stock_Quantity / i.Reorder_Level)
    }));

    return `
TOTAL INVENTORY: ${totalItems} items

LOW STOCK ITEMS (${lowStock.length} items needing reorder):
${lowStockList.length > 0 ? JSON.stringify(lowStockList, null, 2) : 'None'}

EXPIRING SOON (${expiringSoon.length} items expiring in 7 days):
${expiringList.length > 0 ? JSON.stringify(expiringList, null, 2) : 'None'}

EXPIRED ITEMS: ${expired.length}

OVERSTOCKED ITEMS (${overstocked.length} items):
${overstockedList.length > 0 ? JSON.stringify(overstockedList, null, 2) : 'None'}
`;
  }

  function getRuleBasedResponse(question) {
    const inventory = window.inventory || [];
    
    console.log('Rule-based response: Inventory items:', inventory.length);
    
    if (inventory.length === 0) {
      return 'Inventory data is still loading. Please wait a moment and try again.';
    }
    
    const today = new Date();
    const q = question.toLowerCase();

    // Total items / statistics
    if (q.includes('total') || q.includes('how many') || q.includes('count') || q.includes('statistic')) {
      const lowStock = inventory.filter(i => i.Stock_Quantity <= i.Reorder_Level).length;
      const expiring = inventory.filter(i => {
        if (!i.Expiration_Date) return false;
        const days = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
        return days >= 0 && days <= 7;
      }).length;
      
      return `📊 Inventory Statistics:\n\n• Total Items: ${inventory.length}\n• Low Stock Items: ${lowStock}\n• Expiring Soon (7 days): ${expiring}\n• Categories: ${[...new Set(inventory.map(i => i.Category))].length}`;
    }

    // Expiring soon
    if (q.includes('expir')) {
      const expiring = inventory.filter(i => {
        if (!i.Expiration_Date) return false;
        const days = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
        return days >= 0 && days <= 7;
      });
      
      if (expiring.length === 0) {
        return '✅ Good news! No items are expiring in the next 7 days.';
      }
      
      const list = expiring.slice(0, 5).map(i => {
        const days = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
        return `• ${i.Product_Name} - ${days} day(s) left`;
      }).join('\n');
      
      return `⚠️ ${expiring.length} item(s) expiring soon:\n\n${list}${expiring.length > 5 ? `\n\n...and ${expiring.length - 5} more` : ''}`;
    }

    // Low stock / reorder
    if (q.includes('low stock') || q.includes('reorder') || q.includes('need') || q.includes('order')) {
      const lowStock = inventory.filter(i => i.Stock_Quantity <= i.Reorder_Level);
      
      if (lowStock.length === 0) {
        return '✅ All items are above reorder levels!';
      }
      
      const list = lowStock.slice(0, 5).map(i => 
        `• ${i.Product_Name} - ${i.Stock_Quantity}/${i.Reorder_Level} units (Supplier: ${i.Supplier_Name})`
      ).join('\n');
      
      return `📦 ${lowStock.length} item(s) need reordering:\n\n${list}${lowStock.length > 5 ? `\n\n...and ${lowStock.length - 5} more` : ''}`;
    }

    // Overstocked
    if (q.includes('overstock') || q.includes('excess') || q.includes('too much')) {
      const overstocked = inventory.filter(i => i.Stock_Quantity > i.Reorder_Level * 3);
      
      if (overstocked.length === 0) {
        return '✅ No overstocked items detected.';
      }
      
      const list = overstocked.slice(0, 5).map(i => 
        `• ${i.Product_Name} - ${i.Stock_Quantity} units (${Math.round(i.Stock_Quantity / i.Reorder_Level)}x reorder level)`
      ).join('\n');
      
      return `📊 ${overstocked.length} item(s) are overstocked:\n\n${list}`;
    }

    // Categories
    if (q.includes('categor')) {
      const categories = [...new Set(inventory.map(i => i.Category))];
      const categoryCounts = categories.map(cat => {
        const count = inventory.filter(i => i.Category === cat).length;
        return `• ${cat}: ${count} items`;
      }).join('\n');
      
      return `📂 Inventory by Category:\n\n${categoryCounts}`;
    }

    // Suppliers
    if (q.includes('supplier')) {
      const suppliers = [...new Set(inventory.map(i => i.Supplier_Name))];
      return `🏢 Suppliers (${suppliers.length} total):\n\n${suppliers.slice(0, 10).map(s => `• ${s}`).join('\n')}${suppliers.length > 10 ? `\n\n...and ${suppliers.length - 10} more` : ''}`;
    }

    // For any other question, redirect to AI with full context
    // This ensures all questions get intelligent responses
    return null; // Signal to use AI
  }

  return { init };
})();

// Initialize chatbot when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  Chatbot.init();
});
