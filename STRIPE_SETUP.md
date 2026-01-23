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

## Step 2: Create Product and Price in Stripe

1. Go to **Products** → **Add product**
2. Name: `Decision Drift Pro`
3. Description: `Pro plan subscription`
4. Pricing: **Recurring**
   - Set price to **$3.49/month** (or your preferred price)
   - Billing period: Monthly
   - You can create multiple prices for the same product if needed
5. Click **Save product**
6. **Copy the Price ID** (starts with `price_...`)

### Optional: Set Up Promotion Codes

1. Go to **Products** → **Coupons** (or **Promotions**)
2. Click **Create coupon** or **Create promotion code**
3. Set discount amount/percentage
4. Configure expiration, usage limits, etc.
5. Customers can enter these codes at checkout (promotion code field will appear automatically)

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

## Step 4: Install Backend Dependencies

1. Navigate to the `backend/` folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

   This will install:
   - `express` - Web server framework
   - `stripe` - Stripe SDK
   - `dotenv` - Environment variable loader

## Step 5: Set Up Environment Variables

### Local Development

1. In the `backend/` folder, create a `.env` file:
   ```bash
   cd backend
   touch .env
   ```

2. Edit `.env` and fill in your values:
   ```
   STRIPE_SECRET_KEY=sk_test_your_actual_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
   STRIPE_PRICE_ID=price_your_price_id_here
   NODE_ENV=development
   PORT=3000
   BACKEND_URL=http://localhost:3000
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm start
   ```

   The SQLite database (`licenses.db`) will be automatically created on first run.

## Step 6: Deploy Backend Server

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
   heroku config:set STRIPE_PRICE_ID=price_...
   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
   heroku config:set NODE_ENV=production
   git push heroku main
   ```
   
   **Note:** 
   - Set `NODE_ENV=production` for deployed servers
   - The extension automatically sends its ID to the backend, so URL environment variables are not needed.

### Option B: Using Railway

1. Go to [Railway](https://railway.app/)
2. New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET`
   - `NODE_ENV=production` (recommended for production)
   - `PORT` (usually auto-set)
   
   **Note:** The extension automatically sends its ID to the backend, so URL environment variables are not needed.

### Option C: Using Render

1. Go to [Render](https://render.com/)
2. New Web Service
3. Connect your repo
4. Build command: `npm install`
5. Start command: `node backend/server.js`
6. Add environment variables (same as Railway)

## Step 7: Update Extension Code

### Update Backend URL

Update `BACKEND_URL` in `extension/src/shared/constants.js`:

```javascript
const BACKEND_URL = 'https://your-backend-url.com';
```

This constant is automatically used by all extension files that need the backend URL.

### Update Webhook URL in Stripe

1. Go back to Stripe Dashboard → Webhooks
2. Update endpoint URL to your deployed backend URL
3. Save

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

**Required:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_PRICE_ID` - Your Stripe price ID
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

**Optional:**
- `NODE_ENV` - `development` (detailed logs) or `production` (secure, default: development)
- `PORT` - Server port (default: 3000)
- `BACKEND_URL` - Backend URL (auto-detected in development, required in production)

**Note:** 
- Extension URLs are automatically constructed using the extension ID
- The SQLite database (`licenses.db`) is automatically created and stored in the `backend/` directory
- Database file is excluded from git (see `.gitignore`)

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
- No action needed - the extension automatically sends its current ID to the backend
- URLs are constructed dynamically, so they always use the correct extension ID

## Production Checklist

- [ ] Stripe live keys configured
- [ ] Products and prices created
- [ ] Webhook endpoint configured
- [ ] Backend deployed and accessible
- [ ] Extension backend URL configured
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
