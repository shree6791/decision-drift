// Webhook handlers for Decision Drift
// Handles Stripe webhook events

const { createLicense, findUserIdByCustomerId, getUserById } = require('./licenseService');
const { setUser } = require('./database');

/**
 * Initialize webhook handlers with Stripe instance
 * @param {Stripe} stripe - Stripe instance
 * @returns {object} Handler functions
 */
function initWebhookHandlers(stripe) {
  /**
   * Handle checkout.session.completed event
   */
  async function handleCheckoutCompleted(session) {
    const userId = session.metadata?.userId || session.client_reference_id;
    
    if (!userId) {
      console.error('[WEBHOOK] No userId found in session metadata');
      return;
    }
    
    if (session.mode !== 'subscription') {
      console.log('[WEBHOOK] Session is not a subscription, skipping');
      return;
    }
    
    try {
      // Get subscription details
      const subscriptionId = session.subscription;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Only activate if subscription is active or trialing
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        const licenseKey = createLicense(
          userId,
          session.customer,
          subscriptionId
        );
        
        // Store promotion code if used
        const user = getUserById(userId);
        if (user && session.total_details?.amount_discount > 0) {
          setUser(userId, {
            ...user,
            promotionCode: session.discount?.promotion_code?.code || null
          });
        }
        
        console.log(`[WEBHOOK] ✅ Pro activated for userId: ${userId}, license: ${licenseKey}`);
      } else {
        console.log(`[WEBHOOK] ⚠️ Subscription status is ${subscription.status}, not activating`);
      }
    } catch (error) {
      console.error('[WEBHOOK] Error handling checkout completed:', error);
    }
  }
  
  /**
   * Handle subscription update/delete events
   */
  function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
    const userId = findUserIdByCustomerId(customerId);
    
    if (!userId) {
      console.log(`[WEBHOOK] No user found for customer: ${customerId}`);
      return;
    }
    
    const user = getUserById(userId);
    if (!user) return;
    
    // Update based on subscription status
    let updateData = { ...user };
    
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      updateData.plan = 'pro';
      updateData.status = 'active';
      console.log(`[WEBHOOK] ✅ Subscription active for userId: ${userId}`);
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      updateData.plan = 'basic';
      updateData.status = 'cancelled';
      updateData.subscriptionId = null;
      console.log(`[WEBHOOK] ❌ Subscription cancelled for userId: ${userId}`);
    } else {
      updateData.plan = 'basic';
      updateData.status = subscription.status;
      console.log(`[WEBHOOK] ⚠️ Subscription ${subscription.status} for userId: ${userId}`);
    }
    
    setUser(userId, updateData);
  }
  
  return {
    handleCheckoutCompleted,
    handleSubscriptionUpdate
  };
}

module.exports = {
  initWebhookHandlers
};
