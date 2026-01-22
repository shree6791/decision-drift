# Stripe Payment Integration Setup

This guide will help you set up Stripe payments for Decision Drift.

## Prerequisites

- Stripe account (you mentioned you already have one)
- Node.js backend server (can deploy to Heroku, Railway, Render, etc.)
- Your extension's Extension ID

## Step 1: Get Your Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Click **Developers** → **API keys**
3. Copy your **Publishable key** and **Secret key**
   - Use **Test mode** keys for development
   - Use **Live mode** keys for production

## Step 2: Create Products and Prices in Stripe

### Create Monthly Product

1. Go to **Products** → **Add product**
2. Name: `Decision Drift Pro (Monthly)`
3. Description: `Pro plan subscription - Monthly`
4. Pricing: **Recurring**
   - Price: `$3.49`
   - Billing period: `Monthly`
5. Click **Save product**
6. **Copy the Price ID** (starts with `price_...`)

### Create Yearly Product

1. Go to **Products** → **Add product**
2. Name: `Decision Drift Pro (Yearly)`
3. Description: `Pro plan subscription - Yearly`
4. Pricing: **Recurring**
   - Price: `$29.00`
   - Billing period: `Yearly`
5. Click **Save product**
6. **Copy the Price ID** (starts with `price_...`)

## Step 3: Set Up Webhook

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://your-backend-url.com/api/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_...`)

## Step 4: Deploy Backend Server

### Option A: Using Heroku

1. Install Heroku CLI
2. Create `Procfile`:
   ```
   web: node backend/server.js
   ```
3. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set STRIPE_SECRET_KEY=sk_live_...
   heroku config:set STRIPE_PRICE_MONTHLY=price_...
   heroku config:set STRIPE_PRICE_YEARLY=price_...
   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
   heroku config:set SUCCESS_URL=chrome-extension://YOUR_EXTENSION_ID/extension/pricing.html?success=true
   heroku config:set CANCEL_URL=chrome-extension://YOUR_EXTENSION_ID/extension/pricing.html
   git push heroku main
   ```

### Option B: Using Railway

1. Go to [Railway](https://railway.app/)
2. New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_YEARLY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUCCESS_URL`
   - `CANCEL_URL`
   - `PORT` (usually auto-set)

### Option C: Using Render

1. Go to [Render](https://render.com/)
2. New Web Service
3. Connect your repo
4. Build command: `npm install`
5. Start command: `node backend/server.js`
6. Add environment variables (same as Railway)

## Step 5: Get Your Extension ID

1. Load extension in Chrome (unpacked)
2. Go to `chrome://extensions`
3. Find "Decision Drift"
4. Copy the **ID** (long string)
5. Update `SUCCESS_URL` and `CANCEL_URL` in backend:
   ```
   chrome-extension://YOUR_EXTENSION_ID/extension/pricing.html?success=true
   chrome-extension://YOUR_EXTENSION_ID/extension/pricing.html
   ```

## Step 6: Update Extension Code

### Update Backend URL

1. Open `extension/pricing.js`
2. Replace `BACKEND_URL`:
   ```javascript
   const BACKEND_URL = 'https://your-backend-url.com';
   ```

3. Open `extension/background.js`
4. Replace `BACKEND_URL`:
   ```javascript
   const BACKEND_URL = 'https://your-backend-url.com';
   ```

### Update Webhook URL in Stripe

1. Go back to Stripe Dashboard → Webhooks
2. Update endpoint URL to your deployed backend URL
3. Save

## Step 7: Install Backend Dependencies

Create `backend/package.json`:

```json
{
  "name": "decision-drift-backend",
  "version": "1.0.0",
  "description": "Backend for Decision Drift Chrome Extension",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "stripe": "^13.0.0"
  }
}
```

Then run:
```bash
cd backend
npm install
```

## Step 8: Test the Integration

### Test Mode

1. Use Stripe test keys
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any CVC
5. Complete checkout
6. Check webhook logs in Stripe Dashboard
7. Verify Pro activates in extension

### Production

1. Switch to live keys
2. Test with real card (your own)
3. Verify webhook receives events
4. Check extension Pro status updates

## Step 9: Monitor Webhooks

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click on your endpoint
3. View **Events** tab to see incoming webhooks
4. Check for errors

## Environment Variables Summary

```bash
STRIPE_SECRET_KEY=sk_live_...          # Your Stripe secret key
STRIPE_PRICE_MONTHLY=price_...          # Monthly price ID
STRIPE_PRICE_YEARLY=price_...           # Yearly price ID
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signing secret
SUCCESS_URL=chrome-extension://...      # Extension success URL
CANCEL_URL=chrome-extension://...       # Extension cancel URL
PORT=3000                                # Server port (optional)
```

## Troubleshooting

### Webhook Not Receiving Events

- Check webhook URL is correct
- Verify webhook secret matches
- Check server logs for errors
- Test webhook endpoint manually

### Pro Not Activating After Payment

- Check webhook events in Stripe Dashboard
- Verify `checkout.session.completed` event fired
- Check backend logs
- Manually verify Pro status: `POST /api/verify-pro-status`

### CORS Errors

- Backend should include CORS headers (already in code)
- Check browser console for errors
- Verify backend URL is correct

### Extension ID Changes

- If you reload unpacked extension, ID may change
- Update `SUCCESS_URL` and `CANCEL_URL` in backend
- Or use a fixed extension ID (publish to Chrome Web Store)

## Production Checklist

- [ ] Stripe live keys configured
- [ ] Products and prices created
- [ ] Webhook endpoint configured
- [ ] Backend deployed and accessible
- [ ] Extension IDs updated in backend
- [ ] Test payment completed successfully
- [ ] Webhook events received
- [ ] Pro status activates correctly
- [ ] Subscription management works

## Support

For Stripe-specific issues:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com/)

For extension issues:
- Check browser console
- Check service worker console
- Check backend logs
