// Webhook handlers for Decision Drift
// Handles Stripe webhook events

const { createLicense, findUserIdByCustomerId } = require('./licenseService');

/**
 * Initialize webhook handlers with Stripe instance
 * @param {Stripe} stripe - Stripe instance
 * @returns {object} Handler functions
 */
function initWebhookHandlers(stripe) {
  /**
   * Handle checkout.session.completed event
   */
  async function handleCheckoutCompleted(session, userStore) {
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
          subscriptionId,
          userStore
        );
        
        // Store promotion code if used
        const user = userStore.get(userId);
        if (session.total_details?.amount_discount > 0) {
          user.promotionCode = session.discount?.promotion_code?.code || null;
          userStore.set(userId, user);
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
  function handleSubscriptionUpdate(subscription, userStore) {
    const customerId = subscription.customer;
    const userId = findUserIdByCustomerId(customerId, userStore);
    
    if (!userId) {
      console.log(`[WEBHOOK] No user found for customer: ${customerId}`);
      return;
    }
    
    const user = userStore.get(userId);
    if (!user) return;
    
    // Update based on subscription status
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      user.plan = 'pro';
      user.status = 'active';
      console.log(`[WEBHOOK] ✅ Subscription active for userId: ${userId}`);
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      user.plan = 'basic';
      user.status = 'cancelled';
      user.subscriptionId = null;
      console.log(`[WEBHOOK] ❌ Subscription cancelled for userId: ${userId}`);
    } else {
      user.plan = 'basic';
      user.status = subscription.status;
      console.log(`[WEBHOOK] ⚠️ Subscription ${subscription.status} for userId: ${userId}`);
    }
    
    userStore.set(userId, user);
  }
  
  return {
    handleCheckoutCompleted,
    handleSubscriptionUpdate
  };
}

module.exports = {
  initWebhookHandlers
};
