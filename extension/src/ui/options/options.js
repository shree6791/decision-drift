// Options Page

const PRO_KEY = 'dd_pro';
const USER_ID_KEY = 'dd_userId';

// Backend URL - Update this to your deployed backend URL
const BACKEND_URL = 'https://decision-drift.onrender.com'; // TODO: Replace with your backend URL

let isPro = false;
let userId = null;

document.addEventListener('DOMContentLoaded', async () => {
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

async function loadPlan() {
  const data = await chrome.storage.local.get([PRO_KEY, USER_ID_KEY]);
  const pro = data[PRO_KEY] || { enabled: false };
  isPro = pro.enabled || false;
  userId = data[USER_ID_KEY] || null;
}

function renderPlanUI() {
  const badge = document.getElementById('plan-badge');
  const description = document.getElementById('plan-description');
  const upgradeSection = document.getElementById('upgrade-section');
  const proSection = document.getElementById('pro-section');
  
  if (!badge || !description || !upgradeSection || !proSection) return;
  
  if (isPro) {
    badge.textContent = 'Pro';
    badge.className = 'plan-badge plan-badge-pro';
    description.textContent = 'Pro plan with automatic weekly receipts and insights';
    upgradeSection.style.display = 'none';
    proSection.style.display = 'block';
  } else {
    badge.textContent = 'Basic';
    badge.className = 'plan-badge plan-badge-basic';
    description.textContent = 'Free plan with basic features';
    upgradeSection.style.display = 'block';
    proSection.style.display = 'none';
  }
}

function handleUpgrade() {
  window.location.href = 'pricing.html';
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
