let rootDirHandle = null;
let activeSubfolderHandle = null;
let activeSuiteKey = "bosses";          
let activeAppFilename = "boss_progression.html"; 

// Active schema cache for global attributes
let globalAttributesData = [
  { key: 'hp', label: 'HP', default: 200 },
  { key: 'dmg', label: 'Damage', default: 20 },
  { key: 'defense', label: 'Defense', default: 10 },
  { key: 'speed', label: 'Speed', default: 5 },
  { key: 'xp', label: 'XP', default: 100 }
];

window.addEventListener('DOMContentLoaded', async () => {
  await tryRestoreFolderToken();
});

/* ===================== INDEXEDDB TOKEN MEMORY CACHE ===================== */
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("WorkspaceSuiteDB", 1);
    request.onupgradeneeded = e => e.target.result.createObjectStore("settings");
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function tryRestoreFolderToken() {
  try {
    const db = await getDB();
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    const handle = await new Promise((res, rej) => {
      const req = store.get("root_folder_handle");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (handle) {
      const options = { mode: 'readwrite' };
      if ((await handle.queryPermission(options)) === 'granted') {
        rootDirHandle = handle;
        onFolderConnected();
        await switchActiveSuiteModule(activeSuiteKey, activeAppFilename);
      } else {
        document.getElementById('master-folder-status').innerHTML = `
          <button class="proj-btn" style="background:var(--accent2); font-size:13px; padding:8px 20px; margin-top:10px;" onclick="verifyPermissionHook(this)">🔑 Re-Authorize ${handle.name}</button>
        `;
      }
    }
  } catch (e) { console.error("Database restore track skipped.", e); }
}

function onFolderConnected() {
  document.getElementById('master-folder-status').innerHTML = `
    <div class="folder-badge">✔ Connected Folder: ${rootDirHandle.name}</div>
    <button class="proj-btn" style="background:#1c2438; font-size:11px; margin-left:10px;" onclick="selectMasterRootFolder()">🔄 Change</button>
  `;
  document.getElementById('panel-blur-layer').classList.remove('blurred');
  document.getElementById('global-config-bar').style.display = 'block';
  loadGlobalAttributesFromDisk();
}

async function verifyPermissionHook(btn) {
  try {
    const db = await getDB();
    const tx = db.transaction("settings", "readonly");
    const handle = await new Promise(res => {
      tx.objectStore("settings").get("root_folder_handle").onsuccess = e => res(e.target.result);
    });
    
    if (handle) {
      const status = await handle.requestPermission({ mode: 'readwrite' });
      if (status === 'granted') {
        rootDirHandle = handle;
        onFolderConnected();
        await switchActiveSuiteModule(activeSuiteKey, activeAppFilename);
      }
    }
  } catch(e) { alert("Authorization rejected."); }
}

async function selectMasterRootFolder() {
  if (!('showDirectoryPicker' in window)) {
    alert("Your browser doesn't support the File System Access API.");
    return;
  }
  try {
    rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    
    const db = await getDB();
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put(rootDirHandle, "root_folder_handle");

    onFolderConnected();
    await switchActiveSuiteModule(activeSuiteKey, activeAppFilename);
  } catch (err) {
    console.error(err);
  }
}

/* ===================== GLOBAL ATTRIBUTES DISK PERSISTENCE ===================== */
async function loadGlobalAttributesFromDisk() {
  if (!rootDirHandle) return;
  try {
    const fileHandle = await rootDirHandle.getFileHandle('global_attributes.json', { create: false });
    const file = await fileHandle.getFile();
    const content = await file.text();
    globalAttributesData = JSON.parse(content);
  } catch(e) {
    // File doesn't exist yet, write default definitions
    await saveGlobalAttributesToDisk(true);
  }
}

async function saveGlobalAttributesToDisk(isSilent = false) {
  if (!rootDirHandle) return;
  
  if (!isSilent) {
    // Read compiled updates from dialog DOM inputs
    const rows = document.querySelectorAll('.attr-edit-row');
    const updatedAttrs = [];
    rows.forEach(row => {
      const labelVal = row.querySelector('.attr-label-input').value.trim();
      const defaultVal = parseInt(row.querySelector('.attr-default-input').value) || 0;
      if (labelVal) {
        const keyVal = labelVal.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        updatedAttrs.push({ key: keyVal, label: labelVal, default: defaultVal });
      }
    });
    globalAttributesData = updatedAttrs;
  }

  try {
    const fileHandle = await rootDirHandle.getFileHandle('global_attributes.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(globalAttributesData, null, 2));
    await writable.close();
    if (!isSilent) {
      closeGlobalAttributesModal();
      alert("💾 Shared global attributes synchronized successfully!");
    }
  } catch(e) {
    alert("Error executing disk operation on attribute payload.");
  }
}

/* ===================== MODAL UI ENGINE ===================== */
function openGlobalAttributesModal() {
  const container = document.getElementById('global-attrs-list-container');
  container.innerHTML = '';
  
  globalAttributesData.forEach((attr, idx) => {
    appendAttributeRowUI(attr.label, attr.default);
  });
  
  document.getElementById('global-attrs-modal').classList.add('open');
}

function closeGlobalAttributesModal() {
  document.getElementById('global-attrs-modal').classList.remove('open');
}

function appendAttributeRowUI(label = "", defValue = 0) {
  const container = document.getElementById('global-attrs-list-container');
  const div = document.createElement('div');
  div.className = 'attr-edit-row';
  div.innerHTML = `
    <input type="text" class="modal-fi attr-label-input" placeholder="Attribute Name" value="${escapeHtml(label)}" style="flex: 2;">
    <input type="number" class="modal-fi attr-default-input" placeholder="Default" value="${defValue}" style="width: 100px;">
    <button class="attr-del-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

function addNewGlobalAttributeField() {
  appendAttributeRowUI("", 0);
}

/* ===================== ROUTER LAYER ===================== */
async function switchActiveSuiteModule(moduleKey, associatedFile) {
  activeSuiteKey = moduleKey;
  activeAppFilename = associatedFile;

  document.querySelectorAll('.app-card').forEach(el => el.classList.remove('active-module'));
  const targetCard = document.getElementById(`mod-${moduleKey}`);
  if(targetCard) targetCard.classList.add('active-module');

  const titleMap = {
    "bosses": "Boss Progression Project Profiles (/bosses/)",
    "loot": "Minecraft Mod Tracker Profiles (/loot/)",
    "quests": "Storyline Data Arrays (/quests/)"
  };
  document.getElementById('current-panel-title').textContent = titleMap[moduleKey] || "Mod Profiles";

  if (!rootDirHandle) return;

  try {
    let trueCaseTargetName = moduleKey; 
    for await (const entry of rootDirHandle.values()) {
      if (entry.kind === 'directory' && entry.name.toLowerCase() === moduleKey.toLowerCase()) {
        trueCaseTargetName = entry.name;
        break;
      }
    }

    activeSubfolderHandle = await rootDirHandle.getDirectoryHandle(trueCaseTargetName, { create: true });
    document.getElementById('btn-create-file').style.display = 'block';
    await scanActiveSubFolder();
  } catch (err) { console.error("Directory router fault:", err); }
}

async function scanActiveSubFolder() {
  const container = document.getElementById('workspace-file-injector');
  if (!activeSubfolderHandle) return;

  container.innerHTML = '';
  let counter = 0;

  try {
    for await (const entry of activeSubfolderHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
        counter++;
        const file = await entry.getFile();
        
        const card = document.createElement('div');
        card.className = 'project-item';
        card.innerHTML = `
          <div class="project-meta">
            <span class="project-name">📄 ${escapeHtml(entry.name)}</span>
            <span class="project-date">Size: ${(file.size / 1024).toFixed(2)} KB · Config JSON</span>
          </div>
          <button class="proj-btn">⚡ Open in Editor</button>
        `;

        card.querySelector('.proj-btn').addEventListener('click', async () => {
          const textPayload = await file.text();
          
          // Inject shared global attributes configuration file into browser state cache prior to redirecting
          sessionStorage.setItem('shared_global_attributes', JSON.stringify(globalAttributesData));
          sessionStorage.setItem('active_project_filename', entry.name);
          sessionStorage.setItem('active_project_payload', textPayload);
          window.location.href = activeAppFilename;
        });

        container.appendChild(card);
      }
    }
  } catch(e) {
    console.error("Failed to read directory entries:", e);
  }

  if (counter === 0) {
    container.innerHTML = `<div class="no-projects">Connected to <b>/${activeSuiteKey}/</b> folder successfully!<br><span style="color:var(--muted); font-size:11px;">No active files found. Create one below to begin.</span></div>`;
  }
}

async function createNewFileInActiveSubfolder() {
  if (!activeSubfolderHandle) return;
  let name = prompt(`Enter custom profile name to create inside /${activeSuiteKey}/:`);
  if (!name || !name.trim()) return;
  let filename = name.trim().toLowerCase().endsWith('.json') ? name.trim() : name.trim() + '.json';
  try {
    const fileHandle = await activeSubfolderHandle.getFileHandle(filename, { create: true });
    
    const templateBlueprint = activeSuiteKey === 'loot'
      ? { mods: [], dependencies: [], serverPath: "" }
      : { nodes: [], edges: [] };

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(templateBlueprint, null, 2));
    await writable.close();
    await scanActiveSubFolder();
  } catch (e) { alert("Write access execution fault."); }
}

function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
