// Options Page

const PRO_KEY = 'dd_pro';
const USER_ID_KEY = 'dd_userId';

// Backend URL - Update this to your deployed backend URL
const BACKEND_URL = 'https://decision-drift.onrender.com'; // TODO: Replace with your backend URL

let isPro = false;
let userId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check for payment completion first (from URL params or localStorage)
  await checkPaymentCompletion();
  
  // Also verify Pro status with backend (in case webhook activated it)
  await verifyProStatusWithBackend();
  
  await loadPlan();
  renderPlanUI();
  
  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleUpgrade();
    });
  }
  
  document.getElementById('manage-subscription-btn')?.addEventListener('click', handleManageSubscription);
});

// Check for payment completion from URL params or localStorage
async function checkPaymentCompletion() {
  try {
    // First check URL parameters (from success page redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('session_id');
    const urlUserId = urlParams.get('userId');
    
    // Clean up URL params after reading
    if (urlSessionId || urlUserId) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    // Check localStorage as fallback
    const lsSessionId = localStorage.getItem('ddPaymentSessionId');
    const lsUserId = localStorage.getItem('ddPaymentUserId');
    const paymentTime = localStorage.getItem('ddPaymentTime');
    
    // Use URL params if available, otherwise use localStorage
    const sessionId = urlSessionId || lsSessionId;
    const userId = urlUserId || lsUserId;
    
    if (sessionId && userId) {
      // Check if payment was recent (within last 10 minutes)
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      const isRecent = !paymentTime || parseInt(paymentTime) >= tenMinutesAgo;
      
      if (isRecent) {
        // Clear localStorage
        localStorage.removeItem('ddPaymentSessionId');
        localStorage.removeItem('ddPaymentUserId');
        localStorage.removeItem('ddPaymentTime');
        
        // Request background script to activate Pro
        const response = await chrome.runtime.sendMessage({ 
          type: 'DD_ACTIVATE_FROM_PAYMENT',
          payload: { sessionId, userId }
        });
        
        if (response && response.success) {
          // Pro activated, reload plan
          await loadPlan();
          renderPlanUI();
          return true;
        }
      } else {
        // Too old, clear it
        localStorage.removeItem('ddPaymentSessionId');
        localStorage.removeItem('ddPaymentUserId');
        localStorage.removeItem('ddPaymentTime');
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking payment completion:', error);
    return false;
  }
}

// Verify Pro status with backend (in case webhook activated it)
async function verifyProStatusWithBackend() {
  try {
    const data = await chrome.storage.local.get([USER_ID_KEY, PRO_KEY]);
    const currentUserId = data[USER_ID_KEY];
    const currentPro = data[PRO_KEY] || { enabled: false };
    
    // Only check if we have a userId and we're not already Pro
    if (!currentUserId || currentPro.enabled) {
      return;
    }
    
    // Request background script to verify Pro status
    const response = await chrome.runtime.sendMessage({ 
      type: 'DD_VERIFY_PRO_STATUS'
    });
    
    if (response && response.success && response.plan === 'pro') {
      // Pro is active, reload plan
      await loadPlan();
      renderPlanUI();
    }
  } catch (error) {
    // Silently fail - don't block page load
    console.error('Error verifying Pro status:', error);
  }
}

async function loadPlan() {
  const data = await chrome.storage.local.get([PRO_KEY, USER_ID_KEY]);
  const pro = data[PRO_KEY] || { enabled: false };
  isPro = pro.enabled || false;
  userId = data[USER_ID_KEY] || null;
}

function renderPlanUI() {
  const badge = document.getElementById('plan-badge');
  const upgradeSection = document.getElementById('upgrade-section');
  const manageBtn = document.getElementById('manage-subscription-btn');
  
  if (!badge || !upgradeSection || !manageBtn) return;
  
  if (isPro) {
    badge.textContent = 'Pro';
    badge.className = 'plan-badge plan-badge-pro';
    upgradeSection.style.display = 'none';
    manageBtn.style.display = 'inline-block';
  } else {
    badge.textContent = 'Basic';
    badge.className = 'plan-badge plan-badge-basic';
    upgradeSection.style.display = 'block';
    manageBtn.style.display = 'none';
  }
}

function handleUpgrade() {
  window.location.href = '../pricing/pricing.html';
}

async function handleManageSubscription() {
  if (!userId) {
    alert('User ID not found. Please try again.');
    return;
  }
  
  try {
    // Get extension ID and send it to backend
    const extensionId = chrome.runtime.id;
    
    const response = await fetch(`${BACKEND_URL}/api/create-portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, extensionId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create portal session');
    }
    
    const data = await response.json();
    
    // Redirect to Stripe portal
    if (data.portalUrl) {
      window.open(data.portalUrl, '_blank');
    } else {
      throw new Error('No portal URL received');
    }
  } catch (error) {
    alert('Failed to open subscription management. Please try again later.');
  }
}

// Listen for plan changes (e.g., after payment)
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'DD_PLAN_UPDATED' || message.type === 'DD_PRO_UPDATED') {
    await loadPlan();
    renderPlanUI();
  }
});
