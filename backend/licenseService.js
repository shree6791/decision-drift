// License service for Decision Drift
// Handles license creation, validation, and management

/**
 * Create a license for a user after successful payment
 * @param {string} userId - User ID
 * @param {string} stripeCustomerId - Stripe customer ID
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {Map} userStore - User store map
 * @returns {string} License key
 */
function createLicense(userId, stripeCustomerId, subscriptionId, userStore) {
  const licenseKey = `dd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const userData = {
    customerId: stripeCustomerId,
    subscriptionId: subscriptionId,
    plan: 'pro',
    licenseKey: licenseKey,
    activatedAt: Date.now(),
    status: 'active'
  };
  
  userStore.set(userId, userData);
  
  return licenseKey;
}

/**
 * Find user ID by Stripe customer ID
 * @param {string} customerId - Stripe customer ID
 * @param {Map} userStore - User store map
 * @returns {string|null} User ID or null
 */
function findUserIdByCustomerId(customerId, userStore) {
  for (const [userId, user] of userStore.entries()) {
    if (user.customerId === customerId) {
      return userId;
    }
  }
  return null;
}

/**
 * Check if license is valid (active)
 * @param {object} user - User data object
 * @returns {boolean} True if license is valid
 */
function isValidLicense(user) {
  if (!user) return false;
  if (user.plan !== 'pro') return false;
  if (user.status === 'cancelled' || user.status === 'expired') return false;
  return true;
}

module.exports = {
  createLicense,
  findUserIdByCustomerId,
  isValidLicense
};
