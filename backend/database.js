// Database service for Decision Drift
// Uses SQLite for persistent license storage

const Database = require('better-sqlite3');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'licenses.db');

// Initialize database connection
const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize schema
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      userId TEXT PRIMARY KEY,
      customerId TEXT UNIQUE,
      subscriptionId TEXT,
      plan TEXT NOT NULL DEFAULT 'basic',
      licenseKey TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      activatedAt INTEGER,
      promotionCode TEXT,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_customerId ON licenses(customerId);
    CREATE INDEX IF NOT EXISTS idx_subscriptionId ON licenses(subscriptionId);
    CREATE INDEX IF NOT EXISTS idx_status ON licenses(status);
  `);
  
  console.log('[DATABASE] ✅ Database initialized');
}

// Initialize on module load
initializeDatabase();

// Cache prepared statements for better performance
const stmtCache = {
  getUser: db.prepare('SELECT * FROM licenses WHERE userId = ?'),
  getUserByCustomerId: db.prepare('SELECT * FROM licenses WHERE customerId = ?'),
  checkUserExists: db.prepare('SELECT userId FROM licenses WHERE userId = ?'),
  updateUser: db.prepare(`
    UPDATE licenses 
    SET customerId = COALESCE(?, customerId),
        subscriptionId = COALESCE(?, subscriptionId),
        plan = COALESCE(?, plan),
        licenseKey = COALESCE(?, licenseKey),
        status = COALESCE(?, status),
        activatedAt = COALESCE(?, activatedAt),
        promotionCode = COALESCE(?, promotionCode),
        updatedAt = ?
    WHERE userId = ?
  `),
  insertUser: db.prepare(`
    INSERT INTO licenses (
      userId, customerId, subscriptionId, plan, licenseKey, 
      status, activatedAt, promotionCode, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  deleteUser: db.prepare('DELETE FROM licenses WHERE userId = ?')
};

// Helper to convert database row to JS object with timestamp conversion
function convertRow(row) {
  if (!row) return null;
  return {
    ...row,
    activatedAt: row.activatedAt ? row.activatedAt * 1000 : null,
    createdAt: row.createdAt ? row.createdAt * 1000 : null,
    updatedAt: row.updatedAt ? row.updatedAt * 1000 : null
  };
}

/**
 * Get user by userId
 * @param {string} userId
 * @returns {object|null} User object with timestamps converted to milliseconds
 */
function getUser(userId) {
  const row = stmtCache.getUser.get(userId);
  return convertRow(row);
}

/**
 * Get user by Stripe customerId
 * @param {string} customerId
 * @returns {object|null} User object with timestamps converted to milliseconds
 */
function getUserByCustomerId(customerId) {
  const row = stmtCache.getUserByCustomerId.get(customerId);
  return convertRow(row);
}

/**
 * Create or update user license
 * @param {string} userId
 * @param {object} userData - { customerId, subscriptionId, plan, licenseKey, status, activatedAt, promotionCode }
 * @returns {object} User data (optimized: returns data directly without extra query)
 */
function setUser(userId, userData) {
  const now = Math.floor(Date.now() / 1000);
  
  // Check if user exists
  const existing = stmtCache.checkUserExists.get(userId);
  
  if (existing) {
    // Update existing user - get current data first to merge properly
    const current = stmtCache.getUser.get(userId);
    
    // Merge userData with current, using COALESCE logic (only update if provided)
    const merged = {
      customerId: userData.customerId !== undefined ? (userData.customerId || null) : current.customerId,
      subscriptionId: userData.subscriptionId !== undefined ? (userData.subscriptionId || null) : current.subscriptionId,
      plan: userData.plan !== undefined ? (userData.plan || null) : current.plan,
      licenseKey: userData.licenseKey !== undefined ? (userData.licenseKey || null) : current.licenseKey,
      status: userData.status !== undefined ? (userData.status || null) : current.status,
      activatedAt: userData.activatedAt !== undefined ? (userData.activatedAt ? Math.floor(userData.activatedAt / 1000) : null) : current.activatedAt,
      promotionCode: userData.promotionCode !== undefined ? (userData.promotionCode || null) : current.promotionCode
    };
    
    stmtCache.updateUser.run(
      merged.customerId,
      merged.subscriptionId,
      merged.plan,
      merged.licenseKey,
      merged.status,
      merged.activatedAt,
      merged.promotionCode,
      now,
      userId
    );
    
    // Return updated data without extra query
    return convertRow({
      ...current,
      ...merged,
      updatedAt: now
    });
  } else {
    // Insert new user
    const newUser = {
      userId,
      customerId: userData.customerId || null,
      subscriptionId: userData.subscriptionId || null,
      plan: userData.plan || 'basic',
      licenseKey: userData.licenseKey || null,
      status: userData.status || 'active',
      activatedAt: userData.activatedAt ? Math.floor(userData.activatedAt / 1000) : null,
      promotionCode: userData.promotionCode || null,
      createdAt: now,
      updatedAt: now
    };
    
    stmtCache.insertUser.run(
      newUser.userId,
      newUser.customerId,
      newUser.subscriptionId,
      newUser.plan,
      newUser.licenseKey,
      newUser.status,
      newUser.activatedAt,
      newUser.promotionCode,
      newUser.createdAt,
      newUser.updatedAt
    );
    
    // Return new user data directly
    return convertRow(newUser);
  }
}

/**
 * Delete user (for cleanup/testing)
 * @param {string} userId
 */
function deleteUser(userId) {
  stmtCache.deleteUser.run(userId);
}

/**
 * Close database connection (for graceful shutdown)
 */
function close() {
  db.close();
}

module.exports = {
  getUser,
  getUserByCustomerId,
  setUser,
  deleteUser,
  close,
  db // Export db for advanced queries if needed
};
