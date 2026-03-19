/**
 * history.js - Historical Data Tracking Module
 * 
 * Tracks inventory changes over time to enable AI trend analysis:
 * - Daily stock levels
 * - Sales transactions
 * - Reorder events
 * - Stock movements
 * 
 * Data stored in browser localStorage for persistence
 */

const HistoryTracker = (() => {
  const STORAGE_KEY = 'inventory_history';
  const MAX_HISTORY_DAYS = 90; // Keep 90 days of history

  /**
   * Initialize history tracking
   */
  function init() {
    const history = getHistory();
    if (!history.initialized) {
      saveHistory({
        initialized: true,
        startDate: new Date().toISOString(),
        dailySnapshots: {},
        salesTransactions: [],
        reorderEvents: [],
        stockMovements: []
      });
    }
  }

  /**
   * Get full history from localStorage
   */
  function getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { initialized: false };
    } catch (err) {
      console.error('Failed to load history:', err);
      return { initialized: false };
    }
  }

  /**
   * Save history to localStorage
   */
  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  }

  /**
   * Record daily snapshot of all inventory items
   * Call this once per day (or on significant changes)
   */
  function recordDailySnapshot(inventory) {
    const history = getHistory();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (!history.dailySnapshots) history.dailySnapshots = {};

    history.dailySnapshots[today] = inventory.map(item => ({
      product_id: item.Product_ID,
      product_name: item.Product_Name,
      stock: item.Stock_Quantity,
      sales_volume: item.Sales_Volume,
      date: today
    }));

    // Clean old snapshots (keep only last 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_HISTORY_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    Object.keys(history.dailySnapshots).forEach(date => {
      if (date < cutoffStr) {
        delete history.dailySnapshots[date];
      }
    });

    saveHistory(history);
  }

  /**
   * Record a sales transaction
   */
  function recordSale(productId, productName, quantity, date = new Date()) {
    const history = getHistory();
    if (!history.salesTransactions) history.salesTransactions = [];

    history.salesTransactions.push({
      product_id: productId,
      product_name: productName,
      quantity,
      date: date.toISOString(),
      timestamp: Date.now()
    });

    // Keep only last 90 days
    const cutoffTime = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    history.salesTransactions = history.salesTransactions.filter(t => t.timestamp > cutoffTime);

    saveHistory(history);
  }

  /**
   * Record a reorder event
   */
  function recordReorder(productId, productName, quantity, supplier, cost, date = new Date()) {
    const history = getHistory();
    if (!history.reorderEvents) history.reorderEvents = [];

    history.reorderEvents.push({
      product_id: productId,
      product_name: productName,
      quantity,
      supplier,
      cost,
      date: date.toISOString(),
      timestamp: Date.now()
    });

    // Keep only last 90 days
    const cutoffTime = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    history.reorderEvents = history.reorderEvents.filter(e => e.timestamp > cutoffTime);

    saveHistory(history);
  }

  /**
   * Record stock movement (manual adjustment, waste, etc.)
   */
  function recordStockMovement(productId, productName, change, reason, date = new Date()) {
    const history = getHistory();
    if (!history.stockMovements) history.stockMovements = [];

    history.stockMovements.push({
      product_id: productId,
      product_name: productName,
      change, // positive = added, negative = removed
      reason, // 'sale', 'reorder', 'waste', 'adjustment', 'expired'
      date: date.toISOString(),
      timestamp: Date.now()
    });

    // Keep only last 90 days
    const cutoffTime = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    history.stockMovements = history.stockMovements.filter(m => m.timestamp > cutoffTime);

    saveHistory(history);
  }

  /**
   * Get historical data for a specific product
   */
  function getProductHistory(productId, productName) {
    const history = getHistory();
    
    // Get daily stock levels
    const dailyStocks = [];
    if (history.dailySnapshots) {
      Object.keys(history.dailySnapshots).sort().forEach(date => {
        const snapshot = history.dailySnapshots[date].find(
          s => s.product_id === productId || s.product_name === productName
        );
        if (snapshot) {
          dailyStocks.push({
            date,
            stock: snapshot.stock,
            sales_volume: snapshot.sales_volume
          });
        }
      });
    }

    // Get sales transactions
    const sales = (history.salesTransactions || []).filter(
      t => t.product_id === productId || t.product_name === productName
    );

    // Get reorder events
    const reorders = (history.reorderEvents || []).filter(
      e => e.product_id === productId || e.product_name === productName
    );

    // Get stock movements
    const movements = (history.stockMovements || []).filter(
      m => m.product_id === productId || m.product_name === productName
    );

    return {
      dailyStocks,
      sales,
      reorders,
      movements,
      daysTracked: dailyStocks.length
    };
  }

  /**
   * Calculate sales trend for a product
   */
  function calculateSalesTrend(productId, productName, days = 30) {
    const productHistory = getProductHistory(productId, productName);
    
    if (productHistory.dailyStocks.length < 2) {
      return { trend: 'insufficient_data', avgDailySales: 0 };
    }

    // Calculate daily sales from stock changes
    const dailySales = [];
    for (let i = 1; i < productHistory.dailyStocks.length; i++) {
      const prev = productHistory.dailyStocks[i - 1];
      const curr = productHistory.dailyStocks[i];
      
      // Stock decrease = sales (assuming no waste)
      const stockChange = prev.stock - curr.stock;
      if (stockChange > 0) {
        dailySales.push(stockChange);
      }
    }

    if (dailySales.length === 0) {
      return { trend: 'no_sales', avgDailySales: 0 };
    }

    const avgDailySales = dailySales.reduce((a, b) => a + b, 0) / dailySales.length;

    // Determine trend (compare first half vs second half)
    const mid = Math.floor(dailySales.length / 2);
    const firstHalf = dailySales.slice(0, mid);
    const secondHalf = dailySales.slice(mid);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend = 'stable';
    if (avgSecond > avgFirst * 1.2) trend = 'increasing';
    else if (avgSecond < avgFirst * 0.8) trend = 'decreasing';

    return {
      trend,
      avgDailySales,
      totalDays: dailySales.length,
      recentAvg: avgSecond,
      historicalAvg: avgFirst
    };
  }

  /**
   * Generate summary for AI analysis
   */
  function generateAISummary(productId, productName) {
    const productHistory = getProductHistory(productId, productName);
    const salesTrend = calculateSalesTrend(productId, productName);

    return {
      tracking_days: productHistory.daysTracked,
      daily_stock_levels: productHistory.dailyStocks.slice(-30), // Last 30 days
      sales_trend: salesTrend.trend,
      avg_daily_sales: salesTrend.avgDailySales,
      recent_sales_avg: salesTrend.recentAvg,
      historical_sales_avg: salesTrend.historicalAvg,
      total_sales_transactions: productHistory.sales.length,
      total_reorders: productHistory.reorders.length,
      last_reorder: productHistory.reorders.length > 0 
        ? productHistory.reorders[productHistory.reorders.length - 1]
        : null,
      stock_movements: productHistory.movements.slice(-10) // Last 10 movements
    };
  }

  /**
   * Simulate historical data for existing inventory (for demo/testing)
   */
  function simulateHistoricalData(inventory, days = 30) {
    const history = getHistory();
    if (!history.dailySnapshots) history.dailySnapshots = {};
    if (!history.salesTransactions) history.salesTransactions = [];
    if (!history.reorderEvents) history.reorderEvents = [];

    const today = new Date();

    for (let d = days; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];

      // Create daily snapshot
      history.dailySnapshots[dateStr] = inventory.map(item => {
        // Simulate stock fluctuation based on sales volume
        const dailySales = (item.Sales_Volume || 0) / 30;
        const randomVariation = Math.random() * 0.3 - 0.15; // ±15%
        const simulatedStock = Math.max(0, 
          item.Stock_Quantity + (d * dailySales * (1 + randomVariation))
        );

        return {
          product_id: item.Product_ID,
          product_name: item.Product_Name,
          stock: Math.round(simulatedStock),
          sales_volume: item.Sales_Volume,
          date: dateStr
        };
      });

      // Simulate sales transactions (2-5 per day)
      const numSales = Math.floor(Math.random() * 4) + 2;
      for (let s = 0; s < numSales; s++) {
        const item = inventory[Math.floor(Math.random() * inventory.length)];
        const quantity = Math.floor(Math.random() * 5) + 1;
        
        history.salesTransactions.push({
          product_id: item.Product_ID,
          product_name: item.Product_Name,
          quantity,
          date: date.toISOString(),
          timestamp: date.getTime()
        });
      }

      // Simulate reorder events (1-2 per week)
      if (d % 7 === 0 && Math.random() > 0.5) {
        const item = inventory[Math.floor(Math.random() * inventory.length)];
        history.reorderEvents.push({
          product_id: item.Product_ID,
          product_name: item.Product_Name,
          quantity: item.Reorder_Quantity || 50,
          supplier: item.Supplier_Name,
          cost: (item.Reorder_Quantity || 50) * item.Unit_Price,
          date: date.toISOString(),
          timestamp: date.getTime()
        });
      }
    }

    saveHistory(history);
    console.log(`✅ Simulated ${days} days of historical data for ${inventory.length} items`);
  }

  /**
   * Clear all history (for testing)
   */
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('✅ History cleared');
  }

  /**
   * Get statistics about tracked history
   */
  function getStats() {
    const history = getHistory();
    return {
      initialized: history.initialized || false,
      startDate: history.startDate || null,
      daysTracked: Object.keys(history.dailySnapshots || {}).length,
      totalSales: (history.salesTransactions || []).length,
      totalReorders: (history.reorderEvents || []).length,
      totalMovements: (history.stockMovements || []).length
    };
  }

  return {
    init,
    recordDailySnapshot,
    recordSale,
    recordReorder,
    recordStockMovement,
    getProductHistory,
    calculateSalesTrend,
    generateAISummary,
    simulateHistoricalData,
    clearHistory,
    getStats
  };
})();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    HistoryTracker.init();
  });
}
