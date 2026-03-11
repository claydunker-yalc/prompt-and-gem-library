// API URL - Render production
const API_URL = 'https://prompt-gem-library-api.onrender.com';

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');
const showAllBtn = document.getElementById('show-all-btn');
const resultsHeading = document.getElementById('results-heading');
const resultsContainer = document.getElementById('results');
const resultsSection = document.querySelector('.results-section');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const addStatus = document.getElementById('add-status');
const toast = document.getElementById('toast');

// Form elements
const gemForm = document.getElementById('gem-form');
const promptForm = document.getElementById('prompt-form');
const frameworkForm = document.getElementById('framework-form');
const addTabs = document.querySelectorAll('.add-tab');
const addForms = document.querySelectorAll('.add-form');

// Framework breakdown
const breakdownFields = document.getElementById('breakdown-fields');
const addLetterBtn = document.getElementById('add-letter-btn');

let isSearchMode = false;
let editingItemId = null;

// Toast notification
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    void toast.offsetWidth; // Force reflow
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Loading/Error helpers
function showLoading() {
    loadingEl.classList.remove('hidden');
    loadingEl.innerHTML = 'Loading<br><small style="color: #888;">(first load may take ~30s while server wakes up)</small>';
    errorEl.classList.add('hidden');
    resultsContainer.innerHTML = '';
}

function hideLoading() {
    loadingEl.classList.add('hidden');
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render a single item card
function renderItem(item, showSimilarity = false) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const title = item.title || 'Untitled';
    const typeClass = item.item_type;
    const typeName = item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1);

    // Build title HTML - gems get a link
    let titleHtml = item.item_type === 'gem' && item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(title)}</a>`
        : escapeHtml(title);

    // Build content based on type
    let contentHtml = '';

    if (item.description) {
        contentHtml += `<p class="description">${escapeHtml(item.description)}</p>`;
    }

    if (item.item_type === 'prompt' && item.prompt_text) {
        const truncatedPrompt = item.prompt_text.length > 500
            ? item.prompt_text.substring(0, 500) + '...'
            : item.prompt_text;
        contentHtml += `<div class="prompt-text">${escapeHtml(truncatedPrompt)}</div>`;
    }

    if (item.item_type === 'framework' && item.framework_breakdown) {
        let breakdownHtml = '';
        for (const entry of item.framework_breakdown) {
            breakdownHtml += `<span class="letter">${escapeHtml(entry.letter)}</span><span>${escapeHtml(entry.meaning)}</span>`;
        }
        contentHtml += `<div class="framework-breakdown">${breakdownHtml}</div>`;
    }

    // Relevance bar for search results
    let relevanceHtml = '';
    if (showSimilarity && item.similarity !== undefined) {
        const percent = (item.similarity * 100).toFixed(0);
        relevanceHtml = `
            <div class="relevance-bar">
                <div class="relevance-bar-label">
                    <span>Relevance</span>
                    <span>${percent}%</span>
                </div>
                <div class="relevance-bar-track">
                    <div class="relevance-bar-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <h3>${titleHtml}</h3>
            <span class="type-badge ${typeClass}">${typeName}</span>
        </div>
        ${contentHtml}
        <div class="meta">
            <span>${formatDate(item.created_at)}</span>
        </div>
        ${relevanceHtml}
        <div class="actions">
            <button class="edit-btn" data-id="${item.id}">Edit</button>
            <button class="delete-btn" data-id="${item.id}">Delete</button>
        </div>
    `;

    // Add edit handler
    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => openEditModal(item));

    // Add delete handler
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteItem(item.id, item.title));

    return card;
}

// Render items list
function renderItems(items, isSearch = false) {
    resultsContainer.innerHTML = '';

    if (items.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                ${isSearch ? 'No matching items found.' : 'No items saved yet. Add your first item above!'}
            </div>
        `;
        return;
    }

    items.forEach(item => {
        resultsContainer.appendChild(renderItem(item, isSearch));
    });
}

// Load all items
async function loadAllItems() {
    showLoading();
    resultsHeading.textContent = 'Recent Items';
    resultsSection.classList.remove('search-mode');
    isSearchMode = false;

    const filterType = typeFilter.value;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let url = `${API_URL}/items`;
        if (filterType) {
            url += `?type=${filterType}`;
        }

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Failed to load items');

        const items = await response.json();
        renderItems(items, false);
    } catch (err) {
        if (err.name === 'AbortError') {
            showError('Request timed out. The server may be starting up - please try again.');
        } else {
            showError('Failed to load items. Please refresh to try again.');
        }
    } finally {
        hideLoading();
    }
}

// Search items
async function searchItems(query) {
    showLoading();
    resultsHeading.textContent = `Search Results for "${query}"`;
    resultsSection.classList.add('search-mode');
    isSearchMode = true;

    const filterType = typeFilter.value;

    try {
        const response = await fetch(`${API_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                limit: 20,
                item_type: filterType || null
            })
        });

        if (!response.ok) throw new Error('Search failed');

        const results = await response.json();
        renderItems(results, true);
    } catch (err) {
        showError('Search failed. Please try again.');
    } finally {
        hideLoading();
    }
}

// Delete item
async function deleteItem(itemId, title) {
    if (!confirm(`Delete "${title}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/items/${itemId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete');

        showToast('Item deleted');
        loadAllItems();
    } catch (err) {
        showToast('Failed to delete item', 'error');
    }
}

// Add Gem
async function addGem(e) {
    e.preventDefault();

    const url = document.getElementById('gem-url').value.trim();
    const title = document.getElementById('gem-title').value.trim();
    const description = document.getElementById('gem-description').value.trim();

    const submitBtn = gemForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const response = await fetch(`${API_URL}/items/gem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, title, description: description || null })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to save gem');
        }

        showToast(`Gem saved: "${title}"`);
        gemForm.reset();
        loadAllItems();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Gem';
    }
}

// Add Prompt
async function addPrompt(e) {
    e.preventDefault();

    const title = document.getElementById('prompt-title').value.trim();
    const promptText = document.getElementById('prompt-text').value.trim();

    const submitBtn = promptForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const response = await fetch(`${API_URL}/items/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt_text: promptText,
                title: title || null
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to save prompt');
        }

        const saved = await response.json();
        showToast(`Prompt saved: "${saved.title}"`);
        promptForm.reset();
        loadAllItems();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Prompt';
    }
}

// Add Framework
async function addFramework(e) {
    e.preventDefault();

    const name = document.getElementById('framework-name').value.trim().toUpperCase();
    const description = document.getElementById('framework-description').value.trim();

    // Collect breakdown as array to preserve order and allow duplicates
    const breakdown = [];
    const rows = breakdownFields.querySelectorAll('.breakdown-row');
    rows.forEach(row => {
        const letter = row.querySelector('.letter-input').value.trim().toUpperCase();
        const meaning = row.querySelector('.meaning-input').value.trim();
        if (letter && meaning) {
            breakdown.push({ letter, meaning });
        }
    });

    if (breakdown.length === 0) {
        showToast('Please add at least one letter breakdown', 'error');
        return;
    }

    const submitBtn = frameworkForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const response = await fetch(`${API_URL}/items/framework`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description: description || null,
                breakdown
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to save framework');
        }

        showToast(`Framework saved: "${name}"`);
        frameworkForm.reset();
        // Reset breakdown fields to single row
        breakdownFields.innerHTML = `
            <div class="breakdown-row">
                <input type="text" class="letter-input" placeholder="R" maxlength="2">
                <input type="text" class="meaning-input" placeholder="Role">
                <button type="button" class="remove-row-btn">-</button>
            </div>
        `;
        loadAllItems();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Framework';
    }
}

// Add breakdown row
function addBreakdownRow() {
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
        <input type="text" class="letter-input" placeholder="?" maxlength="2">
        <input type="text" class="meaning-input" placeholder="Meaning">
        <button type="button" class="remove-row-btn">-</button>
    `;
    breakdownFields.appendChild(row);
}

// Remove breakdown row
function removeBreakdownRow(e) {
    if (e.target.classList.contains('remove-row-btn')) {
        const rows = breakdownFields.querySelectorAll('.breakdown-row');
        if (rows.length > 1) {
            e.target.closest('.breakdown-row').remove();
        }
    }
}

// Tab switching
function switchTab(e) {
    const targetType = e.target.dataset.type;

    addTabs.forEach(tab => tab.classList.remove('active'));
    e.target.classList.add('active');

    addForms.forEach(form => {
        form.classList.remove('active');
        if (form.id === `${targetType}-form`) {
            form.classList.add('active');
        }
    });
}

// Event Listeners
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
        searchItems(query);
    }
});

showAllBtn.addEventListener('click', () => {
    searchInput.value = '';
    loadAllItems();
});

typeFilter.addEventListener('change', () => {
    if (isSearchMode && searchInput.value.trim()) {
        searchItems(searchInput.value.trim());
    } else {
        loadAllItems();
    }
});

addTabs.forEach(tab => tab.addEventListener('click', switchTab));

gemForm.addEventListener('submit', addGem);
promptForm.addEventListener('submit', addPrompt);
frameworkForm.addEventListener('submit', addFramework);

addLetterBtn.addEventListener('click', addBreakdownRow);
breakdownFields.addEventListener('click', removeBreakdownRow);

// Edit Modal
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editTitleInput = document.getElementById('edit-title');
const editDescriptionInput = document.getElementById('edit-description');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const cancelEditBtn = document.getElementById('cancel-edit');

function openEditModal(item) {
    editingItemId = item.id;
    editTitleInput.value = item.title || '';
    editDescriptionInput.value = item.description || '';
    editModal.classList.remove('hidden');
    editTitleInput.focus();
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editingItemId = null;
    editForm.reset();
}

async function saveEdit(e) {
    e.preventDefault();
    if (!editingItemId) return;

    const title = editTitleInput.value.trim();
    const description = editDescriptionInput.value.trim();

    const submitBtn = editForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const response = await fetch(`${API_URL}/items/${editingItemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title || null,
                description: description || null
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to update');
        }

        showToast('Item updated');
        closeEditModal();
        loadAllItems();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

editForm.addEventListener('submit', saveEdit);
closeEditModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
        closeEditModal();
    }
});

// Initial load
loadAllItems();
