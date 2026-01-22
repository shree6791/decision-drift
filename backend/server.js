// Decision Drift Backend Server (Node.js/Express)
// Stripe payment processing and license verification

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

// Middleware
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For webhooks

// CORS - Allow extension origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// In-memory store (use a database in production)
// userId -> { customerId, subscriptionId, plan: 'pro'|'basic', licenseKey }
const userStore = new Map();

// Stripe Price ID - Set this in your Stripe Dashboard
// Create a product and price, then copy the Price ID here
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

// Helper function to build extension URLs dynamically
function buildExtensionUrl(extensionId, path) {
  return `chrome-extension://${extensionId}/${path}`;
}

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, extensionId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    if (!STRIPE_PRICE_ID) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }
    
    // Build extension URLs dynamically using extension ID
    if (!extensionId) {
      return res.status(400).json({ error: 'extensionId required' });
    }
    
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
      metadata: { userId }
    });
    
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error('Checkout error:', error);
    }
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to create checkout session' : error.message 
    });
  }
});

// Create Stripe customer portal session
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId, extensionId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    const user = userStore.get(userId);
    if (!user || !user.customerId) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build return URL dynamically using extension ID
    if (!extensionId) {
      return res.status(400).json({ error: 'extensionId required' });
    }
    
    const returnUrl = buildExtensionUrl(extensionId, 'options.html');
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: returnUrl
    });
    
    res.json({ portalUrl: session.url });
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error('Portal error:', error);
    }
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to create portal session' : error.message 
    });
  }
});

// Verify Pro status (called by extension to check if user has active subscription)
app.post('/api/verify-pro-status', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    const user = userStore.get(userId);
    if (user && user.plan === 'pro' && user.subscriptionId) {
      // Verify subscription is still active in Stripe
      try {
        const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          return res.json({ 
            valid: true, 
            plan: 'pro',
            licenseKey: user.licenseKey 
          });
        }
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error('Subscription verification error:', error);
        }
      }
    }
    
    res.json({ valid: false, plan: 'basic' });
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error('Verify error:', error);
    }
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to verify status' : error.message 
    });
  }
});

// Verify license key (for dev/testing)
app.post('/api/verify-license', async (req, res) => {
  try {
    const { userId, licenseKey } = req.body;
    
    if (!userId || !licenseKey) {
      return res.status(400).json({ error: 'userId and licenseKey required' });
    }
    
    const user = userStore.get(userId);
    if (user && user.licenseKey === licenseKey && user.plan === 'pro') {
      res.json({ valid: true });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error('Verify error:', error);
    }
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Failed to verify license' : error.message 
    });
  }
});

// Stripe webhook handler
app.post('/api/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).send('Webhook secret not configured');
  }
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (IS_DEVELOPMENT) {
    console.log('Webhook event:', event.type);
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const userId = session.metadata?.userId;
        
        if (userId && session.mode === 'subscription') {
          // Get subscription
          const subscriptionId = session.subscription;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Update user store
          const user = userStore.get(userId) || {};
          user.customerId = session.customer;
          user.subscriptionId = subscriptionId;
          user.plan = 'pro';
          user.licenseKey = `license_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          user.activatedAt = Date.now();
          // Store promotion code if used
          if (session.total_details?.amount_discount > 0) {
            user.promotionCode = session.discount?.promotion_code?.code || null;
          }
          userStore.set(userId, user);
          
          if (IS_DEVELOPMENT) {
            console.log(`Pro activated for user: ${userId}`);
          }
        }
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        // Find user by customer ID and set plan to basic
        for (const [uid, u] of userStore.entries()) {
          if (u.customerId === deletedSubscription.customer) {
            u.plan = 'basic';
            u.subscriptionId = null;
            userStore.set(uid, u);
            if (IS_DEVELOPMENT) {
              console.log(`Pro deactivated for user: ${uid}`);
            }
            break;
          }
        }
        break;
        
      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        // Update plan based on subscription status
        for (const [uid, u] of userStore.entries()) {
          if (u.customerId === updatedSubscription.customer) {
            u.plan = (updatedSubscription.status === 'active' || updatedSubscription.status === 'trialing') ? 'pro' : 'basic';
            userStore.set(uid, u);
            if (IS_DEVELOPMENT) {
              console.log(`Subscription updated for user: ${uid}, plan: ${u.plan}`);
            }
            break;
          }
        }
        break;
        
      case 'invoice.payment_succeeded':
        // Subscription payment succeeded
        const invoice = event.data.object;
        if (invoice.subscription) {
          // Ensure user is marked as Pro
          for (const [uid, u] of userStore.entries()) {
            if (u.customerId === invoice.customer) {
              u.plan = 'pro';
              userStore.set(uid, u);
              break;
            }
          }
        }
        break;
        
      case 'invoice.payment_failed':
        // Payment failed - could optionally downgrade or send notification
        if (IS_DEVELOPMENT) {
          console.log('Payment failed:', event.data.object.id);
        }
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      error: IS_PRODUCTION ? 'Webhook processing failed' : error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Decision Drift backend running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Stripe price ID: ${STRIPE_PRICE_ID || 'NOT CONFIGURED'}`);
  if (IS_DEVELOPMENT) {
    console.log('Development mode: Detailed error messages enabled');
  }
});
