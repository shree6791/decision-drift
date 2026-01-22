// Decision Receipt Page

const STORAGE_KEY = 'dd_records';
const LAST_RECEIPT_KEY = 'dd_lastReceiptAt';
const PRO_KEY = 'dd_pro';
const RECEIPT_VIEWS_KEY = 'dd_receiptViews';

let isPro = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Track receipt view
  await chrome.runtime.sendMessage({ type: 'DD_TRACK_RECEIPT_VIEW' });
  
  // Check Pro status
  const proResponse = await chrome.runtime.sendMessage({ type: 'DD_GET_PRO' });
  isPro = proResponse.pro && proResponse.pro.enabled;
  
  await generateReceipt();
  await checkUpsell();
  await renderTrends();
  
  document.getElementById('generate-btn').addEventListener('click', async () => {
    await generateReceipt();
    await renderTrends();
  });
});

async function generateReceipt() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  
  // Filter last 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentRecords = Object.values(records).filter(
    record => record.createdAt >= sevenDaysAgo
  );
  
  // Compute stats (single pass for efficiency)
  const stats = {
    total: recentRecords.length,
    apply: 0,
    reference: 0,
    interesting: 0,
    skipped: 0
  };
  
  recentRecords.forEach(record => {
    const intent = record.intent;
    if (intent === 'apply') stats.apply++;
    else if (intent === 'reference') stats.reference++;
    else if (intent === 'interesting') stats.interesting++;
    else stats.skipped++; // includes 'skipped' and null/undefined
  });
  
  // Update UI
  document.getElementById('total-saved').textContent = stats.total;
  document.getElementById('apply-count').textContent = stats.apply;
  document.getElementById('reference-count').textContent = stats.reference;
  document.getElementById('interesting-count').textContent = stats.interesting;
  document.getElementById('skipped-count').textContent = stats.skipped;
  
  // Update last receipt time
  await chrome.storage.local.set({ [LAST_RECEIPT_KEY]: Date.now() });
}

async function checkUpsell() {
  if (isPro) {
    document.getElementById('upsell-prompt').style.display = 'none';
    return;
  }
  
  const data = await chrome.storage.local.get(RECEIPT_VIEWS_KEY);
  const views = data[RECEIPT_VIEWS_KEY] || 0;
  
  if (views >= 3) {
    document.getElementById('upsell-prompt').style.display = 'block';
  } else {
    document.getElementById('upsell-prompt').style.display = 'none';
  }
}

async function renderTrends() {
  const trendsSection = document.getElementById('trends-section');
  const proLocked = document.getElementById('pro-locked');
  
  if (!isPro) {
    trendsSection.style.display = 'none';
    proLocked.style.display = 'block';
    return;
  }
  
  proLocked.style.display = 'none';
  trendsSection.style.display = 'block';
  
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  
  // Current 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const currentRecords = Object.values(records).filter(
    record => record.createdAt >= sevenDaysAgo
  );
  
  // Previous 7 days
  const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
  const previousRecords = Object.values(records).filter(
    record => record.createdAt >= fourteenDaysAgo && record.createdAt < sevenDaysAgo
  );
  
  // Compute current stats (single pass)
  const current = { apply: 0, reference: 0, interesting: 0, skipped: 0 };
  currentRecords.forEach(r => {
    const intent = r.intent;
    if (intent === 'apply') current.apply++;
    else if (intent === 'reference') current.reference++;
    else if (intent === 'interesting') current.interesting++;
    else current.skipped++;
  });
  
  // Compute previous stats (single pass)
  const previous = { apply: 0, reference: 0, interesting: 0, skipped: 0 };
  previousRecords.forEach(r => {
    const intent = r.intent;
    if (intent === 'apply') previous.apply++;
    else if (intent === 'reference') previous.reference++;
    else if (intent === 'interesting') previous.interesting++;
    else previous.skipped++;
  });
  
  // Compute deltas
  const deltas = {
    apply: current.apply - previous.apply,
    reference: current.reference - previous.reference,
    interesting: current.interesting - previous.interesting,
    skipped: current.skipped - previous.skipped
  };
  
  // Decision latency proxy (average time to first open for "apply" intents)
  const applyRecords = currentRecords.filter(r => r.intent === 'apply' && r.openedAt);
  let avgLatency = 0;
  if (applyRecords.length > 0) {
    const latencies = applyRecords.map(r => r.openedAt - r.createdAt);
    avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    avgLatency = Math.round(avgLatency / (24 * 60 * 60 * 1000)); // Convert to days
  }
  
  // Intent honesty breakdown (apply vs actually opened)
  const applyTotal = currentRecords.filter(r => r.intent === 'apply').length;
  const applyOpened = currentRecords.filter(r => r.intent === 'apply' && r.openedAt).length;
  const honestyRate = applyTotal > 0 ? Math.round((applyOpened / applyTotal) * 100) : 0;
  
  // Render trends
  const trendsGrid = document.getElementById('trends-grid');
  trendsGrid.innerHTML = `
    <div class="trend-card">
      <div class="trend-label">Apply (Week-over-week)</div>
      <div class="trend-value">${current.apply}</div>
      <div class="trend-delta ${deltas.apply > 0 ? 'positive' : deltas.apply < 0 ? 'negative' : 'neutral'}">
        ${deltas.apply > 0 ? '+' : ''}${deltas.apply}
      </div>
    </div>
    <div class="trend-card">
      <div class="trend-label">Reference (Week-over-week)</div>
      <div class="trend-value">${current.reference}</div>
      <div class="trend-delta ${deltas.reference > 0 ? 'positive' : deltas.reference < 0 ? 'negative' : 'neutral'}">
        ${deltas.reference > 0 ? '+' : ''}${deltas.reference}
      </div>
    </div>
    <div class="trend-card">
      <div class="trend-label">Interesting (Week-over-week)</div>
      <div class="trend-value">${current.interesting}</div>
      <div class="trend-delta ${deltas.interesting > 0 ? 'positive' : deltas.interesting < 0 ? 'negative' : 'neutral'}">
        ${deltas.interesting > 0 ? '+' : ''}${deltas.interesting}
      </div>
    </div>
    <div class="trend-card">
      <div class="trend-label">Skipped (Week-over-week)</div>
      <div class="trend-value">${current.skipped}</div>
      <div class="trend-delta ${deltas.skipped > 0 ? 'positive' : deltas.skipped < 0 ? 'negative' : 'neutral'}">
        ${deltas.skipped > 0 ? '+' : ''}${deltas.skipped}
      </div>
    </div>
    <div class="trend-card">
      <div class="trend-label">Decision Latency</div>
      <div class="trend-value">${avgLatency > 0 ? avgLatency : 'N/A'}</div>
      <div class="trend-delta neutral">days</div>
    </div>
    <div class="trend-card">
      <div class="trend-label">Intent Honesty</div>
      <div class="trend-value">${honestyRate}%</div>
      <div class="trend-delta neutral">applied vs opened</div>
    </div>
  `;
}
