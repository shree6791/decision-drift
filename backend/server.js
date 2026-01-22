// Decision Drift Backend Server (Node.js/Express)
// Stripe payment processing and license verification

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

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

// Stripe Price IDs - Set these in your Stripe Dashboard
// Create products and prices, then copy the Price IDs here
const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_id', // $3.49/month
  yearly: process.env.STRIPE_PRICE_YEARLY || 'price_yearly_id'     // $29/year
};

// Success/Cancel URLs - Update with your extension's options page
const SUCCESS_URL = process.env.SUCCESS_URL || 'chrome-extension://YOUR_EXTENSION_ID/pricing.html?success=true';
const CANCEL_URL = process.env.CANCEL_URL || 'chrome-extension://YOUR_EXTENSION_ID/pricing.html';

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, interval } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    if (!interval || !['monthly', 'yearly'].includes(interval)) {
      return res.status(400).json({ error: 'interval must be "monthly" or "yearly"' });
    }
    
    // Get or create Stripe customer
    let customerId = userStore.get(userId)?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId }
      });
      customerId = customer.id;
      userStore.set(userId, { customerId, plan: 'basic' });
    }
    
    // Get price ID
    const priceId = STRIPE_PRICES[interval];
    if (!priceId || priceId.includes('_id')) {
      return res.status(500).json({ error: 'Stripe price not configured' });
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: CANCEL_URL,
      metadata: { userId, interval }
    });
    
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create Stripe customer portal session
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    const user = userStore.get(userId);
    if (!user || !user.customerId) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: CANCEL_URL
    });
    
    res.json({ portalUrl: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: error.message });
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
        console.error('Subscription verification error:', error);
      }
    }
    
    res.json({ valid: false, plan: 'basic' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: error.message });
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
    console.error('Verify error:', error);
    res.status(500).json({ error: error.message });
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
  
  console.log('Webhook event:', event.type);
  
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
          userStore.set(userId, user);
          
          console.log(`Pro activated for user: ${userId}`);
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
            console.log(`Pro deactivated for user: ${uid}`);
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
            console.log(`Subscription updated for user: ${uid}, plan: ${u.plan}`);
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
        console.log('Payment failed:', event.data.object.id);
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Decision Drift backend running on port ${PORT}`);
  console.log(`Stripe prices: monthly=${STRIPE_PRICES.monthly}, yearly=${STRIPE_PRICES.yearly}`);
});
