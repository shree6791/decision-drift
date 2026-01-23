// License service for Decision Drift
// Handles license creation, validation, and management

const { getUser, getUserByCustomerId, setUser } = require('./database');

/**
 * Create a license for a user after successful payment
 * @param {string} userId - User ID
 * @param {string} stripeCustomerId - Stripe customer ID
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {string} License key
 */
function createLicense(userId, stripeCustomerId, subscriptionId) {
  const licenseKey = `dd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const userData = {
    customerId: stripeCustomerId,
    subscriptionId: subscriptionId,
    plan: 'pro',
    licenseKey: licenseKey,
    activatedAt: Date.now(),
    status: 'active'
  };
  
  setUser(userId, userData);
  
  return licenseKey;
}

/**
 * Find user ID by Stripe customer ID
 * @param {string} customerId - Stripe customer ID
 * @returns {string|null} User ID or null
 */
function findUserIdByCustomerId(customerId) {
  const user = getUserByCustomerId(customerId);
  return user ? user.userId : null;
}

/**
 * Check if license is valid (active)
 * @param {object} user - User data object (from database)
 * @returns {boolean} True if license is valid
 */
function isValidLicense(user) {
  if (!user) return false;
  if (user.plan !== 'pro') return false;
  if (user.status === 'cancelled' || user.status === 'expired') return false;
  return true;
}

/**
 * Get user by userId (helper function)
 * @param {string} userId
 * @returns {object|null}
 */
function getUserById(userId) {
  return getUser(userId);
}

module.exports = {
  createLicense,
  findUserIdByCustomerId,
  isValidLicense,
  getUserById
};
