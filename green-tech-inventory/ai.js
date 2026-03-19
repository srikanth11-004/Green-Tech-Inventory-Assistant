/**
 * ai.js — AI Integration + Rule-Based Fallback
 *
 * MODEL USED: Google Gemini API (via fetch to Google AI Studio)
 * HOW IT WORKS:
 *   - We send structured prompts with inventory data to Gemini.
 *   - Gemini analyzes: stock predictions, sensitivity, reorder needs, expiry risks
 *   - If the API key is missing, the network fails, or the response is malformed,
 *     we fall back to deterministic rule-based logic (no AI required).
 *
 * AI CAPABILITIES:
 *   1. Category Detection - Auto-classify products
 *   2. Stock Prediction - Estimate when items will run out
 *   3. Sensitivity Analysis - Identify critical/perishable items
 *   4. Smart Reorder - Recommend what to order (considering expiry + demand)
 *   5. Expiry Risk - Assess which items are at risk
 *   6. Batch Insights - Generate actionable recommendations
 *
 * FALLBACK RULES (always available):
 *   - Low stock: stock < reorder_level → flag for reorder
 *   - Expiry: days_until_expiry <= 7 → "Expiring Soon"
 *   - Reorder prediction: based on sales_volume / stock ratio
 *   - Category detection: keyword matching on product name
 *   - Sustainability score: weighted formula (turnover rate, waste proxy, stock health)
 */

const AI = (() => {
  // Read API key from meta tag (set by server) or window global — never hardcoded
  const getApiKey = () => window.__GEMINI_KEY__ || '';

  const CATEGORY_KEYWORDS = {
    'Grains & Pulses': ['rice','flour','wheat','oat','grain','pulse','sugar','barley','rye','corn','almond','coconut sugar','powdered sugar','raw sugar'],
    'Fruits & Vegetables': ['apple','banana','mango','orange','lemon','lime','grape','berry','berries','tomato','potato','onion','garlic','carrot','spinach','broccoli','cabbage','lettuce','cucumber','zucchini','pepper','eggplant','mushroom','pea','bean','kale','asparagus','cauliflower','watermelon','pineapple','plum','peach','pear','kiwi','papaya','coconut','cherry','apricot','avocado','pomegranate','sweet potato'],
    'Dairy': ['milk','cheese','yogurt','butter','cream','egg','buttermilk','whipped','ricotta','mozzarella','cheddar','parmesan','gouda','feta','swiss','cottage','sour cream','evaporated'],
    'Beverages': ['coffee','tea','juice','water','drink','herbal','green tea','black tea','white tea','robusta','arabica'],
    'Bakery': ['bread','biscuit','cake','pastry','muffin','roll','sourdough','multigrain','rye bread','white bread','whole wheat bread'],
    'Seafood': ['fish','salmon','tuna','cod','trout','sardine','anchovy','shrimp','prawn','crab','lobster','haddock','tilapia','mackerel','halibut'],
    'Oils & Fats': ['oil','fat','butter','margarine','lard','ghee','olive oil','canola','sunflower','palm','sesame','peanut oil','vegetable oil','avocado oil','corn oil','coconut oil']
  };

  /**
   * RULE-BASED category detection (fallback)
   * Matches product name keywords against category keyword lists.
   */
  function detectCategoryRuleBased(productName) {
    const lower = productName.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) return cat;
    }
    return '';
  }

  /**
   * AI-powered category detection via Google Gemini.
   * Falls back to rule-based if API unavailable.
   */
  async function detectCategory(productName) {
    const key = getApiKey();
    if (!key) return { category: detectCategoryRuleBased(productName), source: 'rule' };

    try {
  // 1. Updated URL to use 'gemini-3.0-flash'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        // Forces the model to return a valid JSON object
        responseMimeType: "application/json",
      },
      contents: [{
        parts: [{
          text: `Classify this grocery product into exactly one of these categories: Grains & Pulses, Fruits & Vegetables, Dairy, Beverages, Bakery, Seafood, Oils & Fats.\nProduct: "${productName}"`
        }]
      }]
    })
  });

  if (!res.ok) {
     throw new Error(`API Error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
  
  // 2. Parse the guaranteed JSON response directly
  const parsed = JSON.parse(text);
  
  return { category: parsed.category, source: 'ai' };

} catch (error) {
  console.error("AI Classification failed:", error);
  return { category: detectCategoryRuleBased(productName), source: 'rule' };
}
  }

  /**
   * AI-POWERED stock prediction via Gemini
   * Analyzes sales patterns, seasonality, and trends to predict stockout dates
   */
  async function predictStockout(item) {
    const key = getApiKey();
    if (!key) return predictReorderRuleBased(item);

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this inventory item and predict when it will run out of stock. Consider sales velocity, current stock, and typical demand patterns.

Item: ${item.Product_Name}
Category: ${item.Category}
Current Stock: ${item.Stock_Quantity}
Reorder Level: ${item.Reorder_Level}
Sales Volume (monthly): ${item.Sales_Volume || 0}
Turnover Rate: ${item.Inventory_Turnover_Rate || 0}%

Respond with JSON only:
{
  "daysUntilStockout": <number>,
  "confidence": "<high|medium|low>",
  "needsReorder": <boolean>,
  "urgency": "<critical|high|medium|low>",
  "recommendation": "<short message>"
}`
            }]
          }]
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('No JSON');
      const result = JSON.parse(match[0]);
      return { ...result, source: 'ai' };
    } catch {
      return predictReorderRuleBased(item);
    }
  }

  /**
   * AI-POWERED sensitivity analysis via Gemini
   * Determines how critical/perishable an item is
   */
  async function analyzeSensitivity(item) {
    const key = getApiKey();
    if (!key) return analyzeSensitivityRuleBased(item);

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze the sensitivity and criticality of this inventory item. Consider perishability, demand volatility, and business impact.

Item: ${item.Product_Name}
Category: ${item.Category}
Expiry Date: ${item.Expiration_Date || 'None'}
Sales Volume: ${item.Sales_Volume || 0}
Turnover Rate: ${item.Inventory_Turnover_Rate || 0}%

Respond with JSON only:
{
  "sensitivity": "<critical|high|medium|low>",
  "perishability": "<very_high|high|medium|low|none>",
  "demandVolatility": "<high|medium|low>",
  "businessImpact": "<critical|high|medium|low>",
  "recommendation": "<short message>"
}`
            }]
          }]
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('No JSON');
      const result = JSON.parse(match[0]);
      return { ...result, source: 'ai' };
    } catch {
      return analyzeSensitivityRuleBased(item);
    }
  }

  /**
   * AI-POWERED smart reorder recommendations via Gemini
   * Considers expiry dates, demand, and optimal order quantities
   */
  async function getSmartReorderRecommendations(items) {
    const key = getApiKey();
    if (!key) return getReorderRecommendationsRuleBased(items);

    // Filter items that need attention
    const today = new Date();
    const needsAttention = items.filter(i => {
      const lowStock = i.Stock_Quantity <= i.Reorder_Level;
      const expiringSoon = i.Expiration_Date && 
        Math.ceil((new Date(i.Expiration_Date) - today) / 86400000) <= 30;
      return lowStock || expiringSoon;
    }).slice(0, 10);

    if (!needsAttention.length) {
      return { recommendations: [], source: 'rule' };
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze these inventory items and provide smart reorder recommendations. Consider:
- Items with low stock that need immediate reordering
- Items expiring soon (avoid over-ordering)
- Optimal order quantities based on sales velocity
- Priority ranking

Items:
${JSON.stringify(needsAttention.map(i => ({
  name: i.Product_Name,
  category: i.Category,
  stock: i.Stock_Quantity,
  reorder_level: i.Reorder_Level,
  reorder_qty: i.Reorder_Quantity,
  expiry: i.Expiration_Date,
  sales_volume: i.Sales_Volume,
  supplier: i.Supplier_Name
})), null, 2)}

Respond with JSON array only (up to 5 recommendations):
[
  {
    "product": "<name>",
    "action": "reorder|reduce_order|monitor",
    "quantity": <number>,
    "priority": "<critical|high|medium|low>",
    "reason": "<short explanation>",
    "estimatedCost": <number>
  }
]`
            }]
          }]
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array');
      const recommendations = JSON.parse(match[0]);
      return { recommendations, source: 'ai' };
    } catch {
      return getReorderRecommendationsRuleBased(items);
    }
  }

  /**
   * RULE-BASED reorder prediction (fallback)
   */
  function predictReorderRuleBased(item) {
    const dailyRate = (item.Sales_Volume || 1) / 30;
    const daysLeft = Math.round(item.Stock_Quantity / dailyRate);
    const needsReorder = item.Stock_Quantity <= item.Reorder_Level;
    
    let urgency = 'low';
    if (item.Stock_Quantity <= item.Reorder_Level * 0.5) urgency = 'critical';
    else if (item.Stock_Quantity <= item.Reorder_Level * 0.75) urgency = 'high';
    else if (item.Stock_Quantity <= item.Reorder_Level) urgency = 'medium';

    return {
      daysUntilStockout: daysLeft,
      confidence: 'medium',
      needsReorder,
      urgency,
      recommendation: needsReorder
        ? `⚠️ Stock below reorder level! Suggest ordering ${item.Reorder_Quantity || 'N/A'} units from ${item.Supplier_Name}.`
        : `Estimated ${daysLeft} days of stock remaining at current sales rate.`,
      source: 'rule'
    };
  }

  /**
   * RULE-BASED sensitivity analysis (fallback)
   */
  function analyzeSensitivityRuleBased(item) {
    const today = new Date();
    let perishability = 'none';
    let sensitivity = 'low';

    if (item.Expiration_Date) {
      const daysToExpiry = Math.ceil((new Date(item.Expiration_Date) - today) / 86400000);
      if (daysToExpiry <= 7) perishability = 'very_high';
      else if (daysToExpiry <= 30) perishability = 'high';
      else if (daysToExpiry <= 90) perishability = 'medium';
      else perishability = 'low';
    }

    const turnover = item.Inventory_Turnover_Rate || 0;
    if (turnover >= 80) sensitivity = 'critical';
    else if (turnover >= 60) sensitivity = 'high';
    else if (turnover >= 30) sensitivity = 'medium';

    const demandVolatility = turnover >= 70 ? 'high' : turnover >= 40 ? 'medium' : 'low';
    const businessImpact = sensitivity;

    return {
      sensitivity,
      perishability,
      demandVolatility,
      businessImpact,
      recommendation: `${sensitivity.toUpperCase()} sensitivity item. Monitor closely.`,
      source: 'rule'
    };
  }

  /**
   * RULE-BASED reorder recommendations (fallback)
   */
  function getReorderRecommendationsRuleBased(items) {
    const today = new Date();
    const recommendations = [];

    items.forEach(item => {
      const lowStock = item.Stock_Quantity <= item.Reorder_Level;
      const daysToExpiry = item.Expiration_Date 
        ? Math.ceil((new Date(item.Expiration_Date) - today) / 86400000)
        : 999;

      if (lowStock && daysToExpiry > 30) {
        recommendations.push({
          product: item.Product_Name,
          action: 'reorder',
          quantity: item.Reorder_Quantity || item.Reorder_Level,
          priority: item.Stock_Quantity <= item.Reorder_Level * 0.5 ? 'critical' : 'high',
          reason: `Stock at ${item.Stock_Quantity} units, below reorder level of ${item.Reorder_Level}`,
          estimatedCost: (item.Reorder_Quantity || item.Reorder_Level) * item.Unit_Price
        });
      } else if (lowStock && daysToExpiry <= 30) {
        recommendations.push({
          product: item.Product_Name,
          action: 'reduce_order',
          quantity: Math.ceil(item.Reorder_Quantity * 0.5),
          priority: 'medium',
          reason: `Low stock but expiring in ${daysToExpiry} days. Order conservatively.`,
          estimatedCost: Math.ceil(item.Reorder_Quantity * 0.5) * item.Unit_Price
        });
      } else if (daysToExpiry <= 7 && item.Stock_Quantity > 0) {
        recommendations.push({
          product: item.Product_Name,
          action: 'monitor',
          quantity: 0,
          priority: 'high',
          reason: `Expiring in ${daysToExpiry} days. Discount or donate to reduce waste.`,
          estimatedCost: 0
        });
      }
    });

    return { recommendations: recommendations.slice(0, 5), source: 'rule' };
  }

  /**
   * RULE-BASED expiry analysis.
   */
  function analyzeExpiryRuleBased(item) {
    if (!item.Expiration_Date) return { daysLeft: null, level: 'unknown', message: 'No expiry date set.', source: 'rule' };
    const today = new Date();
    const expiry = new Date(item.Expiration_Date);
    const daysLeft = Math.ceil((expiry - today) / 86400000);
    let level = 'ok', message = '';
    if (daysLeft < 0) {
      level = 'expired';
      message = `🚨 EXPIRED ${Math.abs(daysLeft)} days ago. Remove from inventory immediately.`;
    } else if (daysLeft <= 3) {
      level = 'critical';
      message = `🔴 Expires in ${daysLeft} day(s)! Urgent: discount or donate now.`;
    } else if (daysLeft <= 7) {
      level = 'warning';
      message = `🟠 Expires in ${daysLeft} days. Consider promotions to reduce waste.`;
    } else if (daysLeft <= 30) {
      level = 'soon';
      message = `🟡 Expires in ${daysLeft} days. Monitor closely.`;
    } else {
      message = `✅ Expires in ${daysLeft} days. No action needed.`;
    }
    return { daysLeft, level, message, source: 'rule' };
  }

  /**
   * RULE-BASED sustainability score (0–100).
   */
  function calcSustainabilityScore(items) {
    if (!items.length) return 0;
    let total = 0;
    const today = new Date();

    items.forEach(item => {
      let score = 0;
      const turnover = Math.min(item.Inventory_Turnover_Rate || 0, 100);
      score += (turnover / 100) * 40;

      const ratio = item.Reorder_Level > 0 ? item.Stock_Quantity / item.Reorder_Level : 1;
      const stockScore = ratio <= 2 ? 30 : ratio <= 3 ? 20 : ratio <= 5 ? 10 : 5;
      score += stockScore;

      if (item.Expiration_Date) {
        const daysLeft = Math.ceil((new Date(item.Expiration_Date) - today) / 86400000);
        if (daysLeft < 0) score += 0;
        else if (daysLeft <= 7) score += 5;
        else if (daysLeft <= 30) score += 15;
        else score += 30;
      } else {
        score += 20;
      }
      total += score;
    });

    return Math.round(total / items.length);
  }

  /**
   * AI-powered batch insights via Google Gemini.
   */
  async function getBatchInsights(items) {
    const key = getApiKey();
    const ruleInsights = getBatchInsightsRuleBased(items);
    if (!key){
      console.warn('Gemini API key not found. Using rule-based insights.');
      return { insights: ruleInsights, source: 'rule' };
    }

    const today = new Date();
    
    // Send comprehensive data: all items with inventory levels, expiry, and demand metrics
    const inventoryData = items.map(i => {
      const daysToExpiry = i.Expiration_Date 
        ? Math.ceil((new Date(i.Expiration_Date) - today) / 86400000)
        : null;
      
      return {
        name: i.Product_Name,
        category: i.Category,
        current_stock: i.Stock_Quantity,
        reorder_level: i.Reorder_Level,
        reorder_quantity: i.Reorder_Quantity,
        expiry_date: i.Expiration_Date,
        days_to_expiry: daysToExpiry,
        sales_volume: i.Sales_Volume,
        turnover_rate: i.Inventory_Turnover_Rate,
        unit_price: i.Unit_Price,
        supplier: i.Supplier_Name,
        demand_indicator: i.Inventory_Turnover_Rate || 0
      };
    });

    if (!inventoryData.length) return { insights: ruleInsights, source: 'rule' };

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a sustainability-focused inventory assistant. Analyze the complete inventory data and provide actionable insights.

Complete Inventory Data:
${JSON.stringify(inventoryData, null, 2)}

Guidelines:
- Keep language simple and human-friendly (avoid robotic tone)
- Highlight key numbers clearly
- Keep each insight under 3–4 lines
- Focus on actionable insights, not just observations
- Prioritize critical issues first
- Avoid repetition

Respond with JSON array only (up to 5 insights):
[
  {
    "title": "Short clear title",
    "category": "critical | warning | risk | optimization",
    "priority": "high | medium | low",
    "summary": "1 line simple explanation",
    "details": "Concise explanation with key numbers",
    "impact": "What happens if ignored",
    "action": "Clear recommended action",
    "cta": "Button label (e.g., Reorder Now)",
    "icon": "emoji"
  }
]`
            }]
          }]
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array');
      const aiInsights = JSON.parse(match[0]);
      return { insights: aiInsights, source: 'ai' };
    } catch {
      return { insights: ruleInsights, source: 'rule' };
    }
  }

  /**
   * RULE-BASED batch insights (fallback)
   */
  function getBatchInsightsRuleBased(items) {
    const today = new Date();
    const insights = [];

    const expiring = items.filter(i => {
      if (!i.Expiration_Date) return false;
      const d = Math.ceil((new Date(i.Expiration_Date) - today) / 86400000);
      return d >= 0 && d <= 7;
    });
    if (expiring.length) {
      insights.push({
        title: `${expiring.length} Item(s) Expiring Within 7 Days`,
        message: expiring.slice(0, 3).map(i => i.Product_Name).join(', ') + (expiring.length > 3 ? ` +${expiring.length - 3} more` : '') + '. Consider discounting or donating to reduce waste.',
        type: 'danger'
      });
    }

    const lowStock = items.filter(i => i.Stock_Quantity <= i.Reorder_Level);
    if (lowStock.length) {
      insights.push({
        title: `${lowStock.length} Item(s) Below Reorder Level`,
        message: lowStock.slice(0, 3).map(i => `${i.Product_Name} (${i.Stock_Quantity}/${i.Reorder_Level})`).join(', ') + '. Place orders soon to avoid stockouts.',
        type: 'warn'
      });
    }

    const fastMovers = items.filter(i => (i.Inventory_Turnover_Rate || 0) >= 80).slice(0, 3);
    if (fastMovers.length) {
      insights.push({
        title: 'Fast-Moving Items — Monitor Stock',
        message: fastMovers.map(i => i.Product_Name).join(', ') + ' have high turnover rates. Ensure adequate stock levels.',
        type: 'warn'
      });
    }

    const expired = items.filter(i => {
      if (!i.Expiration_Date) return false;
      return new Date(i.Expiration_Date) < today;
    });
    if (expired.length) {
      insights.push({
        title: `${expired.length} Expired Item(s) Detected`,
        message: 'Remove expired items immediately. Consider composting organic waste or contacting local food banks for near-expiry items.',
        type: 'danger'
      });
    }

    if (!insights.length) {
      insights.push({
        title: '✅ Inventory Looks Healthy',
        message: 'No critical alerts. Keep monitoring expiry dates and stock levels regularly.',
        type: 'ok'
      });
    }

    return insights;
  }

  return { 
    detectCategory, 
    detectCategoryRuleBased, 
    predictStockout,
    analyzeSensitivity,
    getSmartReorderRecommendations,
    predictReorderRuleBased, 
    analyzeExpiryRuleBased, 
    calcSustainabilityScore, 
    getBatchInsights 
  };
})();
