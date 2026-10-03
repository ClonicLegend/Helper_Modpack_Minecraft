// Embedded copy of global_attributes.json — used immediately and as a fallback
// if the live file can't be fetched (e.g. when this page is opened directly from disk).
const FALLBACK_ATTRIBUTE_SCHEMA = [
  { "key": "hp", "label": "HP", "default": 200 },
  { "key": "damage", "label": "Damage", "default": 20 },
  { "key": "defense", "label": "Defense", "default": 10 }
];

// The whole tracker lives in one file at the root of the master mod folder.
const MOD_TRACKER_FILE = "mod_tracker.json";
let categoryNames = [];   // array of category name strings
let mods = [];             // flat list: { id, name, link, image, notes, categories: [], mobs: [] }
let activeCategory = null; // null = "All Mods" (no filter)
let editingModReference = null;
let ATTRIBUTE_SCHEMA = FALLBACK_ATTRIBUTE_SCHEMA;
let editingMobParentMod = null;
let editingMobReference = null;
let expandedModIds = new Set();

// Unsaved-changes tracking: compare live state against the last loaded/saved snapshot
let lastSavedSnapshot = null;
function datasetSnapshot() { return JSON.stringify({ categoryNames, mods }); }
function markSaved() { lastSavedSnapshot = datasetSnapshot(); }
window.addEventListener('beforeunload', e => {
  if (lastSavedSnapshot !== null && datasetSnapshot() !== lastSavedSnapshot) { e.preventDefault(); e.returnValue = ''; }
});

window.addEventListener('DOMContentLoaded', async () => {
  await loadAttributeSchema();

  // Hub passes the contents of mod_tracker.json, or — if it doesn't exist yet —
  // the old per-file /loot/*.json profiles so they can be merged into one.
  const incomingData = sessionStorage.getItem('mod_tracker_payload');
  const legacyFiles = sessionStorage.getItem('mod_tracker_legacy_files');
  let migratedCount = 0;

  try {
    if (incomingData) {
      loadDataset(JSON.parse(incomingData));
    } else if (legacyFiles) {
      JSON.parse(legacyFiles).forEach(f => {
        try { mergeDataset(JSON.parse(f.text)); migratedCount++; }
        catch (e) { console.warn(`Skipped unreadable legacy file ${f.name}:`, e); }
      });
    }
  } catch(e) {
    console.error(e);
  }

  selectActiveCategory(null);
  if (migratedCount > 0) {
    // Leave the snapshot empty so the merged data counts as unsaved until written.
    lastSavedSnapshot = JSON.stringify({ categoryNames: [], mods: [] });
    alert(`📦 Merged ${migratedCount} old /loot/ profile(s) into one tracker.\n\nClick "Save" to write ${MOD_TRACKER_FILE}. The old files are left untouched.`);
  } else {
    markSaved();
  }
});

async function loadAttributeSchema() {
  try {
    const stored = sessionStorage.getItem('shared_global_attributes');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) { ATTRIBUTE_SCHEMA = parsed; return; }
    }
  } catch(e) { }
  
  try {
    const db = await getWorkspaceDB();
    const tx = db.transaction("settings", "readonly");
    const rootHandle = await new Promise(res => {
      tx.objectStore("settings").get("root_folder_handle").onsuccess = e => res(e.target.result);
    });

    if (rootHandle) {
      // Access global_attributes.json directly in the root folder context
      const fileHandle = await rootHandle.getFileHandle('global_attributes.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        ATTRIBUTE_SCHEMA = json;
        return;
      }
    }
  } catch(e) { console.warn("Could not read root global_attributes.json handle directly:", e); }

  try {
    const res = await fetch('../global_attributes.json');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) ATTRIBUTE_SCHEMA = json;
    }
  } catch(e) { }
}

function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultAttributes() {
  const obj = {};
  ATTRIBUTE_SCHEMA.forEach(a => obj[a.key] = a.default);
  return obj;
}

// Append another dataset (used when merging old multi-file profiles).
function mergeDataset(parsed) {
  const prevCategories = categoryNames, prevMods = mods;
  loadDataset(parsed);
  categoryNames = [...new Set([...prevCategories, ...categoryNames])];
  mods = [...prevMods, ...mods];
}

function loadDataset(parsed) {
  if (Array.isArray(parsed.categoryNames) && Array.isArray(parsed.mods)) {
    // Current format
    categoryNames = parsed.categoryNames;
    mods = parsed.mods.map(normalizeMod);
    return;
  }
  // Legacy format: { categories: { catName: [modObjects] } } — one category per mod, no mobs
  const legacy = parsed.categories || parsed;
  categoryNames = Object.keys(legacy);
  mods = [];
  categoryNames.forEach(cat => {
    (legacy[cat] || []).forEach(m => mods.push(normalizeMod({ ...m, categories: [cat] })));
  });
}

// Minecraft ids: lowercase, no spaces. "Ender Dragon" -> "ender_dragon".
function cleanIdPart(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.\/:-]/g, '');
}

// Full in-game id of a mob: mod namespace + mob's in-game name.
// A mob name that already contains ':' is used as-is (e.g. a vanilla mob listed under a modpack).
function mobEntityId(mod, mob) {
  const name = cleanIdPart(mob.entityName);
  if (!name) return '';
  if (name.includes(':')) return name;
  return mod.namespace ? `${mod.namespace}:${name}` : name;
}

function normalizeMod(m) {
  return {
    id: m.id || generateId(),
    name: m.name,
    namespace: cleanIdPart(m.namespace).replace(/:+$/, ''),
    link: m.link || "",
    image: m.image || "",
    notes: m.notes || "",
    categories: Array.isArray(m.categories) ? m.categories : [],
    mobs: Array.isArray(m.mobs) ? m.mobs.map(normalizeMob_) : []
  };
}

function normalizeMob_(mob) {
  return {
    id: mob.id || generateId(),
    name: mob.name,
    entityName: mob.entityName || "",
    image: mob.image || "",
    attributes: { ...defaultAttributes(), ...(mob.attributes || {}) }
  };
}

function returnToHub() { window.location.href = "index.html"; }

function modCountForCategory(cat) {
  return mods.filter(m => m.categories.includes(cat)).length;
}

function renderCategorySidebar() {
  const container = document.getElementById('category-injector');
  container.innerHTML = '';
  
  const allDiv = document.createElement('div');
  allDiv.className = `category-item all-item ${activeCategory === null ? 'active' : ''}`;
  allDiv.innerHTML = `
    <span class="cat-name">📦 All Mods</span>
    <span class="cat-count">${mods.length}</span>
  `;
  allDiv.onclick = () => selectActiveCategory(null);
  container.appendChild(allDiv);
  
  if (categoryNames.length === 0) {
    container.innerHTML += `<div style="font-size:11px; text-align:center; padding:20px; color:var(--subtext);">No categories yet.</div>`;
    return;
  }
  
  categoryNames.forEach(cat => {
    const count = modCountForCategory(cat);
    const isActive = cat === activeCategory;
    
    const div = document.createElement('div');
    div.className = `category-item ${isActive ? 'active' : ''}`;
    div.innerHTML = `
      <span class="cat-name">${escapeHtml(cat)}</span>
      <span class="cat-count">${count}</span>
    `;
    div.onclick = () => selectActiveCategory(cat);
    container.appendChild(div);
  });
}

function selectActiveCategory(cat) {
  activeCategory = cat;
  document.getElementById('active-cat-title').textContent = cat ? `⛏  ${cat}` : '📦 All Mods';
  const showCatBtns = cat !== null;
  document.getElementById('rename-cat-btn').style.display = showCatBtns ? 'flex' : 'none';
  document.getElementById('delete-cat-btn').style.display = showCatBtns ? 'flex' : 'none';
  renderCategorySidebar();
  renderModCardsList();
}

function renderModCardsList() {
  const grid = document.getElementById('mods-grid-injector');
  grid.innerHTML = '';
  
  let entries = activeCategory === null ? mods.slice() : mods.filter(m => m.categories.includes(activeCategory));
  
  const query = document.getElementById('search-bar').value.toLowerCase().trim();
  if (query) {
    entries = entries.filter(m =>
      m.name.toLowerCase().includes(query) ||
      (m.notes || '').toLowerCase().includes(query) ||
      m.mobs.some(b => b.name.toLowerCase().includes(query))
    );
  }
  
  document.getElementById('stats-counter-lbl').textContent = `${entries.length} entries tracked ${query ? `matching query filtering context` : ''}`;
  
  if (entries.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🌿</div>
        ${mods.length === 0 ? 'No mods tracked yet. Add one with the button above.' : 'No target tracker data metrics match active visibility queries.'}
      </div>`;
    return;
  }
  
  entries.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    
    let imgHTML = `<div class="mod-icon-placeholder">📦</div>`;
    if (mod.image) {
      imgHTML = `<img class="mod-img" src="${escapeHtml(mod.image)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="mod-icon-placeholder" style="display:none;">📦</div>`;
    }
    
    const badgesHTML = mod.categories.length > 0
      ? mod.categories.map(c => `<span class="mod-cat-badge">${escapeHtml(c)}</span>`).join('')
      : `<span class="mod-cat-badge uncategorized">Uncategorized</span>`;
    
    const isExpanded = expandedModIds.has(mod.id);
    
    card.innerHTML = `
      <div class="mod-card-top">
        <div class="mod-img-wrap">${imgHTML}</div>
        <div class="mod-info">
          <div class="mod-cat-badges">${badgesHTML}</div>
          <span class="mod-name">${escapeHtml(mod.name)}${mod.namespace ? `<span class="mod-namespace">${escapeHtml(mod.namespace)}:</span>` : ''}</span>
          ${mod.link ? `<a class="mod-link" href="${escapeHtml(mod.link)}" target="_blank">${escapeHtml(mod.link)}</a>` : ''}
          ${mod.notes ? `<p class="mod-notes">${escapeHtml(mod.notes)}</p>` : ''}
          <button class="mod-mobs-toggle ${isExpanded ? 'expanded' : ''}"><span class="chevron">▸</span> 👹 Bestiary <span class="mob-count-pill">${mod.mobs.length}</span></button>
        </div>
        <div class="mod-card-actions">
          <button class="icon-btn edit" title="Edit Properties">✎</button>
          <button class="icon-btn del" title="Purge Record">✕</button>
        </div>
      </div>
      ${isExpanded ? renderMobsSectionHTML(mod) : ''}
    `;
    
    card.querySelector('.mod-mobs-toggle').onclick = () => toggleMobsSection(mod.id);
    card.querySelector('.mod-card-top .edit').onclick = () => openFormModal(mod);
    card.querySelector('.mod-card-top .del').onclick = () => triggerDeleteModCard(mod);
    
    if (isExpanded) wireMobsSection(card, mod);
    
    grid.appendChild(card);
  });
}

function renderMobsSectionHTML(mod) {
  const rows = mod.mobs.length > 0
    ? mod.mobs.map(mob => mobTileHTML(mod, mob)).join('')
    : `<div class="mob-empty-note">No mobs tracked for this mod yet.</div>`;
  return `
    <div class="mod-mobs-section">
      <div class="mod-mobs-header">
        <span class="mmh-title">👹 Bestiary</span>
        <button class="tb-btn add-mob-btn">➕ Add Mob</button>
      </div>
      <div class="mob-list">${rows}</div>
    </div>
  `;
}

// Recognizable icon + accent color per attribute key, with a sensible fallback
// for any custom attribute defined in global_attributes.json.
const ATTR_ICON_MAP = { hp: '❤️', health: '❤️', damage: '⚔️', dmg: '⚔️', defense: '🛡️', armor: '🛡️', speed: '💨', xp: '✨', exp: '✨' };
const ATTR_COLOR_MAP = { hp: '#ef5350', health: '#ef5350', damage: '#ffa726', dmg: '#ffa726', defense: '#42a5f5', armor: '#42a5f5', speed: '#26c6da', xp: '#ab47bc', exp: '#ab47bc' };
function attrIcon(key) { return ATTR_ICON_MAP[(key || '').toLowerCase()] || '🔸'; }
function attrColor(key) { return ATTR_COLOR_MAP[(key || '').toLowerCase()] || '#8d9bb5'; }

function mobTileHTML(mod, mob) {
  const entityId = mobEntityId(mod, mob);
  let imgHTML = `<div class="mob-tile-icon-placeholder">👹</div>`;
  if (mob.image) {
    imgHTML = `<img class="mob-tile-img" src="${escapeHtml(mob.image)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="mob-tile-icon-placeholder" style="display:none;">👹</div>`;
  }
  const pillsHTML = ATTRIBUTE_SCHEMA.map(a => {
    const color = attrColor(a.key);
    const val = mob.attributes[a.key] ?? a.default;
    return `<span class="mob-attr-pill" style="color:${color}; border-color:${color}40;" title="${escapeHtml(a.label)}">${attrIcon(a.key)} ${escapeHtml(String(val))}</span>`;
  }).join('');
  return `
    <div class="mob-tile" data-mob-id="${escapeHtml(mob.id)}">
      <div class="mob-tile-actions">
        <button class="icon-btn edit mob-edit" title="Edit Mob">✎</button>
        <button class="icon-btn del mob-del" title="Remove Mob">✕</button>
      </div>
      <div class="mob-tile-img-wrap">${imgHTML}</div>
      <div class="mob-tile-body">
        <div class="mob-tile-name" title="${escapeHtml(mob.name)}">${escapeHtml(mob.name)}</div>
        <div class="mob-tile-id ${entityId && entityId.includes(':') ? '' : 'missing'}" title="In-game id">${escapeHtml(entityId || 'no in-game id')}</div>
        <div class="mob-attr-pills">${pillsHTML}</div>
      </div>
    </div>
  `;
}

function wireMobsSection(cardEl, mod) {
  const addBtn = cardEl.querySelector('.add-mob-btn');
  if (addBtn) addBtn.onclick = () => openMobFormModal(mod, null);
  
  cardEl.querySelectorAll('.mob-tile').forEach(tile => {
    const mobId = tile.getAttribute('data-mob-id');
    const mob = mod.mobs.find(b => b.id === mobId);
    if (!mob) return;
    tile.querySelector('.mob-edit').onclick = () => openMobFormModal(mod, mob);
    tile.querySelector('.mob-del').onclick = () => triggerDeleteMobCard(mod, mob);
  });
}

function toggleMobsSection(modId) {
  if (expandedModIds.has(modId)) expandedModIds.delete(modId);
  else expandedModIds.add(modId);
  renderModCardsList();
}

/* CRUD OPERATIONS LAYER */
function triggerAddCategory() {
  let name = prompt("Enter new category metric identifier:");
  if (!name || !name.trim()) return;
  name = name.trim();
  if (categoryNames.includes(name)) { alert("Category profile collision error!"); return; }
  categoryNames.push(name);
  selectActiveCategory(name);
}

function triggerRenameCategory() {
  if (!activeCategory) return;
  let newName = prompt("Modify tracking moniker classification name:", activeCategory);
  if (!newName || !newName.trim() || newName.trim() === activeCategory) return;
  newName = newName.trim();
  if (categoryNames.includes(newName)) { alert("Category profile collision error!"); return; }
  
  const idx = categoryNames.indexOf(activeCategory);
  categoryNames[idx] = newName;
  mods.forEach(m => {
    const ci = m.categories.indexOf(activeCategory);
    if (ci !== -1) m.categories[ci] = newName;
  });
  selectActiveCategory(newName);
}

function triggerDeleteCategory() {
  if (!activeCategory || !confirm(`Purge category "${activeCategory}"? Mods tagged with it will keep their other categories (or become Uncategorized).`)) return;
  categoryNames = categoryNames.filter(c => c !== activeCategory);
  mods.forEach(m => { m.categories = m.categories.filter(c => c !== activeCategory); });
  selectActiveCategory(null);
}

function triggerAddModCard() {
  if (categoryNames.length === 0) {
    alert("Create a category first, then you can tag mods with it.");
    return;
  }
  openFormModal(); // Launches the input panel to create a new mod card record
}

function populateCategoryCheckboxes(preselected) {
  const container = document.getElementById('form-mod-categories');
  if (categoryNames.length === 0) {
    container.innerHTML = `<div class="cb-empty-note">No categories yet — create one from the sidebar first.</div>`;
    return;
  }
  const selectedSet = new Set(preselected || (activeCategory ? [activeCategory] : []));
  container.innerHTML = categoryNames.map(cat => `
    <label class="cb-row">
      <input type="checkbox" value="${escapeHtml(cat)}" ${selectedSet.has(cat) ? 'checked' : ''}>
      <span>${escapeHtml(cat)}</span>
    </label>
  `).join('');
}

function getCheckedCategories() {
  return Array.from(document.querySelectorAll('#form-mod-categories input[type="checkbox"]:checked')).map(cb => cb.value);
}

function openFormModal(mod = null) {
  editingModReference = mod;
  document.getElementById('modal-header-title').textContent = mod ? "Edit Mod Reference Mapping" : "Track New Mod Element";
  populateCategoryCheckboxes(mod ? mod.categories : null);
  document.getElementById('form-mod-name').value = mod ? mod.name : "";
  document.getElementById('form-mod-namespace').value = mod ? mod.namespace || "" : "";
  document.getElementById('form-mod-link').value = mod ? mod.link || "" : "";
  document.getElementById('form-mod-image').value = mod ? mod.image || "" : "";
  document.getElementById('form-mod-notes').value = mod ? mod.notes || "" : "";
  document.getElementById('mod-modal').style.display = 'flex';
}

function cancelFormModal() {
  closeFormModal();
}

function closeFormModal() {
  document.getElementById('mod-modal').style.display = 'none';
  editingModReference = null;
}

function saveFormModalData() {
  const name = document.getElementById('form-mod-name').value.trim();
  if (!name) { alert("Mod parameter tracking rules call for a valid Name property."); return; }
  
  const selectedCategories = getCheckedCategories();
  if (categoryNames.length > 0 && selectedCategories.length === 0) {
    alert("Tag this mod with at least one category.");
    return;
  }
  
  const namespace = cleanIdPart(document.getElementById('form-mod-namespace').value).replace(/:+$/, '');
  if (namespace.includes(':')) { alert("The Mod ID is only the part before the colon, e.g. \"cataclysm\"."); return; }
  const link = document.getElementById('form-mod-link').value.trim();
  const image = document.getElementById('form-mod-image').value.trim();
  const notes = document.getElementById('form-mod-notes').value.trim();
  
  if (editingModReference) {
    // Mutate in place so the mod's id and any tracked mobs are preserved.
    editingModReference.name = name;
    editingModReference.namespace = namespace;
    editingModReference.link = link;
    editingModReference.image = image;
    editingModReference.notes = notes;
    editingModReference.categories = selectedCategories;
  } else {
    mods.push(normalizeMod({ name, namespace, link, image, notes, categories: selectedCategories, mobs: [] }));
  }
  
  closeFormModal();
  renderCategorySidebar();
  renderModCardsList();
}

function triggerDeleteModCard(mod) {
  if (!confirm(`Purge reference matrix records for "${mod.name}"?`)) return;
  mods = mods.filter(m => m !== mod);
  expandedModIds.delete(mod.id);
  renderCategorySidebar();
  renderModCardsList();
}

/* MOB CRUD OPERATIONS LAYER */
function openMobFormModal(mod, mob) {
  editingMobParentMod = mod;
  editingMobReference = mob;
  document.getElementById('mob-modal-header-title').textContent = mob ? "Edit Mob" : "Add Mob";
  document.getElementById('form-mob-name').value = mob ? mob.name : "";
  document.getElementById('form-mob-image').value = mob ? mob.image || "" : "";
  document.getElementById('form-mob-entity').value = mob ? mob.entityName || "" : "";
  updateMobIdPreview();
  renderMobAttributeFields(mob);
  document.getElementById('mob-modal').style.display = 'flex';
}

function updateMobIdPreview() {
  const mod = editingMobParentMod || {};
  const id = mobEntityId(mod, { entityName: document.getElementById('form-mob-entity').value });
  const el = document.getElementById('mob-id-preview');
  el.textContent = id || '—';
  el.style.color = id && !id.includes(':') ? 'var(--danger, #e74c3c)' : '';
  el.title = id && !id.includes(':') ? 'No namespace: set a Mod ID on the mod, or type the full id here (modid:name)' : '';
}

function renderMobAttributeFields(mob) {
  const container = document.getElementById('form-mob-attrs');
  container.innerHTML = ATTRIBUTE_SCHEMA.map(attr => `
    <div class="fg" style="margin-bottom:0;">
      <label class="fl">${escapeHtml(attr.label)}</label>
      <input type="number" class="fi" id="mob-attr-${escapeHtml(attr.key)}" value="${mob ? (mob.attributes[attr.key] ?? attr.default) : attr.default}">
    </div>
  `).join('');
}

function closeMobFormModal() {
  document.getElementById('mob-modal').style.display = 'none';
  editingMobParentMod = null;
  editingMobReference = null;
}

function saveMobFormModalData() {
  const name = document.getElementById('form-mob-name').value.trim();
  if (!name) { alert("Mob tracking rules call for a valid Name property."); return; }
  if (!editingMobParentMod) { closeMobFormModal(); return; }
  
  const attributes = {};
  ATTRIBUTE_SCHEMA.forEach(attr => {
    const input = document.getElementById(`mob-attr-${attr.key}`);
    const num = input ? parseFloat(input.value) : NaN;
    attributes[attr.key] = isNaN(num) ? attr.default : num;
  });
  
  const image = document.getElementById('form-mob-image').value.trim();
  const entityName = cleanIdPart(document.getElementById('form-mob-entity').value);
  
  if (editingMobReference) {
    editingMobReference.name = name;
    editingMobReference.entityName = entityName;
    editingMobReference.image = image;
    editingMobReference.attributes = attributes;
  } else {
    editingMobParentMod.mobs.push({ id: generateId(), name, entityName, image, attributes });
    expandedModIds.add(editingMobParentMod.id); // auto-expand so the new mob is visible
  }
  
  closeMobFormModal();
  renderCategorySidebar();
  renderModCardsList();
}

function triggerDeleteMobCard(mod, mob) {
  if (!confirm(`Remove mob "${mob.name}" from "${mod.name}"?`)) return;
  mod.mobs = mod.mobs.filter(b => b.id !== mob.id);
  renderModCardsList();
}

/* ===================== DIRECT SYSTEM DISK SAVE ENGINE ===================== */
async function getWorkspaceDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("WorkspaceSuiteDB");
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function commitChangesToDisk() {
  const dataset = { categoryNames, mods };
  const jsonPayload = JSON.stringify(dataset, null, 2);

  // Keep the hub hand-off cache in sync so reopening shows the latest data
  sessionStorage.setItem('mod_tracker_payload', jsonPayload);
  sessionStorage.removeItem('mod_tracker_legacy_files');

  try {
    const db = await getWorkspaceDB();
    const tx = db.transaction("settings", "readonly");
    const rootHandle = await new Promise(res => {
      tx.objectStore("settings").get("root_folder_handle").onsuccess = e => res(e.target.result);
    });

    if (rootHandle) {
      const fileHandle = await rootHandle.getFileHandle(MOD_TRACKER_FILE, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonPayload);
      await writable.close();

      markSaved();
      alert(`💾 Saved to ${MOD_TRACKER_FILE}`);
      return;
    }
  } catch(e) {
    console.error("Direct FileSystem access failed, running backup storage strategy:", e);
  }

  // Fallback if directory handles are locked/unsupported
  localStorage.setItem('suite_backup_' + MOD_TRACKER_FILE, jsonPayload);
  markSaved();
  alert(`Changes saved to temporary memory cache. Return to main dashboard menu to sync.`);
}

function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ===================== ATTRIBUTE INTEGRITY CHECKER ===================== */
function verifyJsonAttributes() {
  if (!mods || mods.length === 0) {
    alert("No tracked data metrics available to evaluate.");
    return;
  }

  let filledCount = 0;
  let prunedCount = 0;

  // Extract valid keys dynamically from the parsed schema array
  const activeKeys = ATTRIBUTE_SCHEMA.map(attr => attr.key);

  mods.forEach(mod => {
    if (Array.isArray(mod.mobs)) {
      mod.mobs.forEach(mob => {
        if (!mob.attributes) {
          mob.attributes = {};
        }

        // 1. Inject missing attributes using the defaults from global_attributes.json
        ATTRIBUTE_SCHEMA.forEach(schemaAttr => {
          if (mob.attributes[schemaAttr.key] === undefined) {
            mob.attributes[schemaAttr.key] = schemaAttr.default;
            filledCount++;
          }
        });

        // 2. Remove obsolete properties no longer found in global_attributes.json
        Object.keys(mob.attributes).forEach(mobKey => {
          if (!activeKeys.includes(mobKey)) {
            delete mob.attributes[mobKey];
            prunedCount++;
          }
        });
      });
    }
  });

  // Instantly re-render the mod list UI view to show changes
  renderModCardsList();

  if (filledCount === 0 && prunedCount === 0) {
    alert("✨ Alignment Checked: All data structures match your 'global_attributes.json' schema perfectly!");
  } else {
    alert(`⚙️ Integrity Alignment Matrix Run Complete!\n\n- Filled Missing Values: ${filledCount}\n- Pruned Deprecated Values: ${prunedCount}\n\nRemember to hit save to commit these updates to disk!`);
  }
}
