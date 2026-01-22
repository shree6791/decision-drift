// Review Bookmarks Page

const STORAGE_KEY = 'dd_records';

let allRecords = [];
let filteredRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadRecords();
  
  document.getElementById('search-input').addEventListener('input', handleSearch);
  document.getElementById('show-archived').addEventListener('change', handleFilter);
});

async function loadRecords() {
  const response = await chrome.runtime.sendMessage({ type: 'DD_GET_RECORDS' });
  allRecords = Object.values(response.records || {});
  
  // Sort by createdAt (newest first)
  allRecords.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  filteredRecords = allRecords;
  renderList();
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  applyFilters(query);
}

function handleFilter() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  applyFilters(query);
}

function applyFilters(query) {
  const showArchived = document.getElementById('show-archived').checked;
  
  filteredRecords = allRecords.filter(record => {
    // Search filter
    if (query) {
      const titleMatch = (record.title || '').toLowerCase().includes(query);
      let domainMatch = false;
      try {
        const domain = new URL(record.url).hostname;
        domainMatch = domain.toLowerCase().includes(query);
      } catch (e) {
        domainMatch = record.url.toLowerCase().includes(query);
      }
      if (!titleMatch && !domainMatch) {
        return false;
      }
    }
    
    // Archive filter
    if (!showArchived && record.archived) {
      return false;
    }
    
    return true;
  });
  
  renderList();
}

function renderList() {
  const container = document.getElementById('bookmarks-list');
  
  if (filteredRecords.length === 0) {
    container.innerHTML = '<div class="empty-state">No bookmarks found</div>';
    return;
  }
  
  container.innerHTML = filteredRecords.map(record => {
    const domain = getDomain(record.url);
    const date = new Date(record.createdAt).toLocaleDateString();
    const intent = record.intent || 'pending';
    const archived = record.archived || false;
    
    const openCount = record.openCount || 0;
    const openCountBadge = openCount > 0 ? `<span class="open-count">Opened ${openCount}x</span>` : '';
    
    return `
      <div class="bookmark-item ${archived ? 'archived' : ''}">
        <div class="bookmark-main">
          <div class="bookmark-header">
            <a href="${record.url}" target="_blank" data-bookmark-id="${record.bookmarkId}" class="bookmark-link">${escapeHtml(record.title || domain)}</a>
            <span class="intent intent-${intent}">${intent}</span>
          </div>
          <div class="bookmark-meta">
            <span class="domain">${escapeHtml(domain)}</span>
            <span class="separator">•</span>
            <span class="date">${date}</span>
            ${openCount > 0 ? `<span class="separator">•</span><span class="open-count">Opened ${openCount}x</span>` : ''}
            ${archived ? '<span class="separator">•</span><span class="archived-badge">Archived</span>' : ''}
          </div>
        </div>
        <div class="bookmark-actions">
          ${!archived 
            ? `<button class="btn-action" data-action="archive" data-id="${record.bookmarkId}" title="Archive">Archive</button>`
            : `<button class="btn-action" data-action="unarchive" data-id="${record.bookmarkId}" title="Unarchive">Unarchive</button>`
          }
          <button class="btn-action btn-action-danger" data-action="remove" data-id="${record.bookmarkId}" title="Remove record">Remove</button>
          <button class="btn-action btn-action-danger" data-action="delete" data-id="${record.bookmarkId}" title="Delete bookmark">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });
  
  // Attach link click tracking
  container.querySelectorAll('.bookmark-link').forEach(link => {
    link.addEventListener('click', handleLinkClick);
  });
}

function handleLinkClick(e) {
  const bookmarkId = e.target.dataset.bookmarkId;
  if (bookmarkId) {
    // Track the click
    chrome.runtime.sendMessage({
      type: 'DD_TRACK_LINK_CLICK',
      payload: { bookmarkId }
    });
    
    // Link will open normally (target="_blank" handles it)
  }
}

function handleAction(e) {
  const action = e.target.dataset.action;
  const bookmarkId = e.target.dataset.id;
  
  if (action === 'archive') {
    chrome.runtime.sendMessage({
      type: 'DD_UPDATE_RECORD',
      payload: { bookmarkId, updates: { archived: true } }
    }, () => {
      loadRecords();
    });
  } else if (action === 'unarchive') {
    chrome.runtime.sendMessage({
      type: 'DD_UPDATE_RECORD',
      payload: { bookmarkId, updates: { archived: false } }
    }, () => {
      loadRecords();
    });
  } else if (action === 'remove') {
    if (confirm('Remove this record from Decision Drift? (Bookmark will remain in Chrome)')) {
      chrome.storage.local.get(STORAGE_KEY).then(result => {
        const records = result[STORAGE_KEY] || {};
        delete records[bookmarkId];
        chrome.storage.local.set({ [STORAGE_KEY]: records }, () => {
          loadRecords();
        });
      });
    }
  } else if (action === 'delete') {
    if (confirm('Delete this bookmark from Chrome? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        type: 'DD_DELETE_BOOKMARK',
        payload: { bookmarkId }
      }, () => {
        loadRecords();
      });
    }
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url.substring(0, 50);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
