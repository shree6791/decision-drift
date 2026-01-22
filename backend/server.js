// Decision Drift Backend Server (Node.js/Express)
// Handles Stripe payments and Pro subscription management

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createLicense, findUserIdByCustomerId, isValidLicense } = require('./licenseService');
const { initWebhookHandlers } = require('./webhookHandlers');

// Initialize webhook handlers with Stripe instance
const { handleCheckoutCompleted, handleSubscriptionUpdate } = initWebhookHandlers(stripe);

const app = express();
const PORT = process.env.PORT || 3000;

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

// Constants
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

if (!STRIPE_PRICE_ID) {
  console.error('ERROR: STRIPE_PRICE_ID environment variable is required');
  process.exit(1);
}

// Middleware
app.use(cors());

// IMPORTANT: Webhook endpoint must receive raw body for signature verification
// Skip JSON parsing for webhook route - it needs raw body
app.use((req, res, next) => {
  if (req.path === '/api/webhook') {
    // Skip JSON parsing for webhook - it will use raw body parser in route handler
    next();
  } else {
    // Parse JSON for all other routes
    express.json()(req, res, next);
  }
});

// In-memory user store (replace with database in production)
// userId -> { customerId, subscriptionId, plan: 'pro'|'basic', licenseKey, status, activatedAt }
const userStore = new Map();

// Helper function to build extension URLs dynamically
function buildExtensionUrl(extensionId, path) {
  return `chrome-extension://${extensionId}/${path}`;
}

/**
 * Get license key for user
 * GET /api/get-license?userId=xxx
 */
app.get('/api/get-license', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (IS_DEVELOPMENT) {
      console.log(`[GET-LICENSE] Request for userId: ${userId}`);
    }

    const user = userStore.get(userId);

    if (!user || !isValidLicense(user)) {
      if (IS_DEVELOPMENT) {
        console.log(`[GET-LICENSE] ❌ No valid license found for userId: ${userId}`);
      }
      return res.status(404).json({ error: 'No license found for this user' });
    }

    if (IS_DEVELOPMENT) {
      console.log(`[GET-LICENSE] ✅ Returning license key for userId: ${userId}`);
    }
    return res.json({ licenseKey: user.licenseKey });
  } catch (error) {
    console.error('[GET-LICENSE] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify license key
 * GET /api/verify-license?userId=xxx&licenseKey=xxx
 */
app.get('/api/verify-license', async (req, res) => {
  try {
    const { userId, licenseKey } = req.query;

    if (!userId || !licenseKey) {
      return res.status(400).json({ error: 'Missing userId or licenseKey' });
    }

    const user = userStore.get(userId);

    if (!user || user.licenseKey !== licenseKey || !isValidLicense(user)) {
      return res.json({ valid: false, isPro: false });
    }

    return res.json({ valid: true, isPro: true });
  } catch (error) {
    console.error('[VERIFY-LICENSE] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify Pro status (called by extension to check if user has active subscription)
 * POST /api/verify-pro-status
 */
app.post('/api/verify-pro-status', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const user = userStore.get(userId);
    
    if (user && isValidLicense(user) && user.subscriptionId) {
      // Verify subscription is still active in Stripe
      try {
        const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          return res.json({ 
            valid: true, 
            plan: 'pro',
            licenseKey: user.licenseKey 
          });
        } else {
          // Subscription no longer active, update local store
          user.plan = 'basic';
          user.status = subscription.status;
          userStore.set(userId, user);
        }
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error('[VERIFY-PRO] Subscription verification error:', error);
        }
      }
    }

    res.json({ valid: false, plan: 'basic' });
  } catch (error) {
    console.error('[VERIFY-PRO] Error:', error);
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to verify status' : error.message 
    });
  }
});

/**
 * Create Stripe Checkout Session
 * POST /api/create-checkout-session
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, extensionId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (!extensionId) {
      return res.status(400).json({ error: 'Missing extensionId' });
    }

    if (IS_DEVELOPMENT) {
      console.log(`[CHECKOUT] Creating session for userId: ${userId}`);
    }

    // Build extension URLs dynamically
    const successUrl = `${buildExtensionUrl(extensionId, 'pricing.html')}?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = buildExtensionUrl(extensionId, 'pricing.html');

    // Get or create Stripe customer
    let customerId = userStore.get(userId)?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId }
      });
      customerId = customer.id;
      userStore.set(userId, { customerId, plan: 'basic' });
    }

    // Create checkout session with promotion code support
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: STRIPE_PRICE_ID,
        quantity: 1
      }],
      mode: 'subscription',
      allow_promotion_codes: true, // Enable promotion codes
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: { userId }
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[CHECKOUT] Error:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Stripe error',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to create checkout session' : error.message 
    });
  }
});

/**
 * Create Portal Session (for managing subscription)
 * POST /api/create-portal-session
 */
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId, extensionId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (!extensionId) {
      return res.status(400).json({ error: 'Missing extensionId' });
    }

    const user = userStore.get(userId);
    if (!user || !user.customerId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const returnUrl = buildExtensionUrl(extensionId, 'options.html');

    const session = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: returnUrl
    });

    res.json({ portalUrl: session.url });
  } catch (error) {
    console.error('[PORTAL] Error:', error);
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to create portal session' : error.message 
    });
  }
});

/**
 * Auto-create license from Stripe session (fallback if webhook didn't fire)
 * POST /api/auto-create-license
 * Body: { sessionId: "cs_...", userId: "dd_..." }
 */
app.post('/api/auto-create-license', async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'Missing sessionId or userId' });
    }

    // Check if license already exists
    const existing = userStore.get(userId);
    if (isValidLicense(existing)) {
      return res.json({ 
        success: true, 
        licenseKey: existing.licenseKey,
        message: 'License already exists' 
      });
    }

    // Retrieve and validate session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Validate session
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }
    if (session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Not a subscription session' });
    }

    // Get subscription and validate
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return res.status(400).json({ error: `Subscription status is ${subscription.status}, not active` });
    }

    // Create license using shared function
    const licenseKey = createLicense(userId, subscription.customer, subscription.id, userStore);
    
    console.log(`[AUTO-CREATE] ✅ License created for userId: ${userId}, sessionId: ${sessionId}`);
    
    res.json({ 
      success: true, 
      licenseKey,
      message: 'License created successfully' 
    });
  } catch (error) {
    console.error('[AUTO-CREATE] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stripe Webhook Handler
 * Handles subscription events
 * NOTE: This route MUST receive raw body for signature verification
 */
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).send('Webhook secret not configured');
  }
  
  let event;
  try {
    // req.body is now a Buffer (raw body) - required for signature verification
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (IS_DEVELOPMENT) {
      console.log(`[WEBHOOK] Received event: ${event.type}, id: ${event.id}`);
    }
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, userStore);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        handleSubscriptionUpdate(event.data.object, userStore);
        break;

      case 'invoice.payment_succeeded':
        // Ensure user is marked as Pro
        const invoice = event.data.object;
        if (invoice.subscription) {
          const userId = findUserIdByCustomerId(invoice.customer, userStore);
          if (userId) {
            const user = userStore.get(userId);
            if (user) {
              user.plan = 'pro';
              user.status = 'active';
              userStore.set(userId, user);
            }
          }
        }
        break;

      case 'invoice.payment_failed':
        if (IS_DEVELOPMENT) {
          console.log(`[WEBHOOK] Payment failed: ${event.data.object.id}`);
        }
        break;

      default:
        if (IS_DEVELOPMENT) {
          console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
        }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Handler error:', error);
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Webhook handler failed' : error.message 
    });
  }
});

/**
 * Debug endpoints (only in development)
 */
if (IS_DEVELOPMENT) {
  /**
   * Debug endpoint: Manually create license from Stripe customer
   * GET /api/debug/create-license?userId=xxx&customerId=xxx
   */
  app.get('/api/debug/create-license', async (req, res) => {
    try {
      const { userId, customerId } = req.query;

      if (!userId || !customerId) {
        return res.status(400).json({ error: 'Missing userId or customerId' });
      }

      // Verify customer exists in Stripe
      await stripe.customers.retrieve(customerId);
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, limit: 1 });

      if (subscriptions.data.length === 0) {
        return res.status(404).json({ error: 'No subscription found for this customer' });
      }

      const subscription = subscriptions.data[0];
      
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return res.status(400).json({ error: `Subscription status is ${subscription.status}, not active` });
      }

      // Create license using shared function
      const licenseKey = createLicense(userId, customerId, subscription.id, userStore);
      
      console.log(`[DEBUG] ✅ License manually created for userId: ${userId}, customerId: ${customerId}`);
      
      res.json({ 
        success: true, 
        licenseKey,
        message: 'License created successfully' 
      });
    } catch (error) {
      console.error('[DEBUG] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Debug endpoint: List all licenses (for debugging)
   * GET /api/debug/licenses
   */
  app.get('/api/debug/licenses', (req, res) => {
    const licenseList = Array.from(userStore.entries()).map(([userId, user]) => ({
      userId,
      licenseKey: user.licenseKey || null,
      customerId: user.customerId || null,
      subscriptionId: user.subscriptionId || null,
      plan: user.plan,
      status: user.status || 'unknown'
    }));
    
    res.json({ count: userStore.size, licenses: licenseList });
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Decision Drift backend server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Stripe price ID: ${STRIPE_PRICE_ID}`);
  if (IS_DEVELOPMENT) {
    console.log('Development mode: Detailed logging enabled');
    console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  }
});
