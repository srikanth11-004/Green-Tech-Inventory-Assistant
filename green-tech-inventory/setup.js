/**
 * setup.js - Load environment variables
 * This script reads the .env file and sets up the Gemini API key
 */

async function loadEnv() {
  try {
    const response = await fetch('.env');
    if (!response.ok) {
      console.warn('⚠️ .env file not found. AI features will use rule-based fallback.');
      return;
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('GEMINI_API_KEY=')) {
        let key = line.replace('GEMINI_API_KEY=', '').trim();
        // Remove quotes if present
        key = key.replace(/^["']|["']$/g, '');
        if (key && key !== 'your_gemini_api_key_here') {
          window.__GEMINI_KEY__ = key;
          console.log('✅ Gemini API key loaded successfully');
        } else {
          console.warn('⚠️ Gemini API key not configured. AI features will use rule-based fallback.');
        }
      }
    });
  } catch (err) {
    console.warn('⚠️ Could not load .env file:', err.message);
    console.log('💡 To enable AI features, create a .env file with: GEMINI_API_KEY=your_key_here');
  }
}

// Load environment on page load
window.addEventListener('DOMContentLoaded', loadEnv);
