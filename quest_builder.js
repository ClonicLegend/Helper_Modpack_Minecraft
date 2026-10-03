/* ===================== FTB QUESTS SCHEMA ===================== */
// Field kinds: res (namespaced id), str, int, long, bool, tri (unset/true/false), item, ivec3
const TASK_TYPES = {
  item:        { label: 'Item', icon: '📦', fields: [
                   { k: 'item', label: 'Item ID', kind: 'item', def: 'minecraft:oak_log' },
                   { k: 'count', label: 'Count', kind: 'long', def: 1 },
                   { k: 'consume_items', label: 'Consume items', kind: 'tri', def: 'default' } ] },
  kill:        { label: 'Kill Entity', icon: '⚔️', fields: [
                   { k: 'entity', label: 'Entity ID', kind: 'res', def: 'minecraft:zombie' },
                   { k: 'value', label: 'Amount', kind: 'long', def: 1 } ] },
  xp:          { label: 'XP', icon: '✨', fields: [
                   { k: 'value', label: 'Amount', kind: 'long', def: 5 },
                   { k: 'points', label: 'Count points instead of levels', kind: 'bool', def: false } ] },
  checkmark:   { label: 'Checkmark', icon: '✔️', fields: [] },
  dimension:   { label: 'Visit Dimension', icon: '🌀', fields: [
                   { k: 'dimension', label: 'Dimension', kind: 'res', def: 'minecraft:the_nether' } ] },
  biome:       { label: 'Visit Biome', icon: '🌲', fields: [
                   { k: 'biome', label: 'Biome (or #tag)', kind: 'res', tag: true, def: 'minecraft:plains' } ] },
  structure:   { label: 'Find Structure', icon: '🏰', fields: [
                   { k: 'structure', label: 'Structure (or #tag)', kind: 'res', tag: true, def: 'minecraft:stronghold' } ] },
  advancement: { label: 'Advancement', icon: '🏆', fields: [
                   { k: 'advancement', label: 'Advancement', kind: 'res', def: 'minecraft:story/mine_stone' },
                   { k: 'criterion', label: 'Criterion (optional)', kind: 'str', def: '' } ] },
  location:    { label: 'Location', icon: '📍', fields: [
                   { k: 'dimension', label: 'Dimension', kind: 'res', def: 'minecraft:overworld' },
                   { k: 'position', label: 'Position X / Y / Z', kind: 'ivec3', def: [0, 64, 0] },
                   { k: 'size', label: 'Area size W / H / D', kind: 'ivec3', def: [1, 1, 1] },
                   { k: 'ignore_dimension', label: 'Ignore dimension', kind: 'bool', def: false } ] },
  stat:        { label: 'Stat', icon: '📊', fields: [
                   { k: 'stat', label: 'Statistic', kind: 'res', def: 'minecraft:jump' },
                   { k: 'value', label: 'Value', kind: 'int', def: 1 } ] },
  fluid:       { label: 'Fluid', icon: '💧', fields: [
                   { k: 'fluid', label: 'Fluid', kind: 'res', def: 'minecraft:water' },
                   { k: 'amount', label: 'Amount (mB)', kind: 'long', def: 1000 } ] },
  gamestage:   { label: 'Stage', icon: '🎭', fields: [
                   { k: 'stage', label: 'Stage name', kind: 'str', def: '' } ] },
};

const REWARD_TYPES = {
  item:        { label: 'Item', icon: '🎁', fields: [
                   { k: 'item', label: 'Item ID', kind: 'item', def: 'minecraft:diamond' },
                   { k: 'count', label: 'Count', kind: 'int', def: 1 } ] },
  xp:          { label: 'XP Points', icon: '✨', fields: [ { k: 'xp', label: 'XP points', kind: 'int', def: 100 } ] },
  xp_levels:   { label: 'XP Levels', icon: '⭐', fields: [ { k: 'xp_levels', label: 'Levels', kind: 'int', def: 5 } ] },
  command:     { label: 'Command', icon: '⌨️', fields: [
                   { k: 'command', label: 'Command', kind: 'str', def: '/say Hello @p' },
                   { k: 'elevate_perms', label: 'Run with op permissions', kind: 'bool', def: true },
                   { k: 'silent', label: 'Silent (no chat output)', kind: 'bool', def: false } ] },
  advancement: { label: 'Advancement', icon: '🏆', fields: [ { k: 'advancement', label: 'Advancement', kind: 'res', def: 'minecraft:story/root' } ] },
  gamestage:   { label: 'Stage', icon: '🎭', fields: [
                   { k: 'stage', label: 'Stage name', kind: 'str', def: '' },
                   { k: 'remove', label: 'Remove stage instead of granting', kind: 'bool', def: false } ] },
  custom:      { label: 'Custom (KubeJS)', icon: '🧩', fields: [] },
};

const SHAPES = ['', 'circle', 'square', 'rsquare', 'diamond', 'pentagon', 'hexagon', 'octagon', 'heart', 'gear'];
const SHAPE_LABELS = { '': 'Default', circle: 'Circle', square: 'Square', rsquare: 'Rounded square', diamond: 'Diamond',
  pentagon: 'Pentagon', hexagon: 'Hexagon', octagon: 'Octagon', heart: 'Heart', gear: 'Gear' };
const DEP_REQUIREMENTS = { all_completed: 'All completed', one_completed: 'One completed', all_started: 'All started', one_started: 'One started' };

const UNIT = 60;          // canvas pixels per FTB quest-grid unit
const NODE_PX = 46;       // node diameter at quest size 1.0
const RES_RE = /^[a-z0-9_.-]+:[a-z0-9_.\/-]+$/;

/* ===================== STATE ===================== */
let project = { version: 1, target: '1.21', chapters: [], exportedChapterIds: [] };
let currentFileName = '';
let activeChapterId = null;
let selectedQuestId = null;
let selectedEdge = null;          // { from, to } — "to" depends on "from"
let currentTab = 'inspector';
let linkMode = false, linkSource = null;
let panX = 0, panY = 0, zoom = 1;

let lastSavedSnapshot = null;
function projectSnapshot() { return JSON.stringify(project); }
function markSaved() { lastSavedSnapshot = projectSnapshot(); }
window.addEventListener('beforeunload', e => {
  if (lastSavedSnapshot !== null && projectSnapshot() !== lastSavedSnapshot) { e.preventDefault(); e.returnValue = ''; }
});

const $ = id => document.getElementById(id);
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''); }
function snapHalf(v) { return Math.round(v * 2) / 2; }

/* ===================== IDS & MODEL ===================== */
function allIds() {
  const ids = new Set();
  project.chapters.forEach(c => {
    ids.add(c.id);
    c.quests.forEach(q => { ids.add(q.id); q.tasks.forEach(t => ids.add(t.id)); q.rewards.forEach(r => ids.add(r.id)); });
  });
  return ids;
}
// FTB object ids: 16 hex chars of a random 64-bit number.
function newId(taken = allIds()) {
  for (;;) {
    const b = crypto.getRandomValues(new Uint8Array(8));
    b[0] = (b[0] & 0x7f) || 1;
    const id = [...b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (!taken.has(id)) { taken.add(id); return id; }
  }
}

function activeChapter() { return project.chapters.find(c => c.id === activeChapterId) || null; }
function findQuest(id) {
  for (const c of project.chapters) { const q = c.quests.find(q => q.id === id); if (q) return { quest: q, chapter: c }; }
  return null;
}
function newChapter(title) {
  let filename = slug(title) || 'chapter', n = 2;
  while (project.chapters.some(c => c.filename === filename)) filename = `${slug(title) || 'chapter'}_${n++}`;
  return { id: newId(), filename, title, subtitle: '', icon: '', group: '', defaultShape: '', defaultHideDependencyLines: false, quests: [], extra: {} };
}
function newQuest(x, y, title = 'New Quest') {
  return { id: newId(), title, subtitle: '', description: '', icon: '', x, y, shape: '', size: 1,
    dependencies: [], dependencyRequirement: 'all_completed', optional: false, hideUntilDepsVisible: false,
    hideDependencyLines: false, tasks: [], rewards: [], extra: {} };
}
function newEntry(type, schemaSet) {
  const e = { id: newId(), type, extra: {} };
  (schemaSet[type]?.fields || []).forEach(f => { e[f.k] = Array.isArray(f.def) ? [...f.def] : f.def; });
  return e;
}

function normalizeProject(data) {
  const p = { version: 1, target: data.target === '1.20' ? '1.20' : '1.21', chapters: [], exportedChapterIds: data.exportedChapterIds || [] };
  (data.chapters || []).forEach(c => {
    p.chapters.push({ ...newChapterShape(), ...c,
      quests: (c.quests || []).map(q => ({ ...newQuestShape(), ...q,
        tasks: (q.tasks || []).map(t => ({ extra: {}, ...t })),
        rewards: (q.rewards || []).map(r => ({ extra: {}, ...r })) })) });
  });
  return p;
}
function newChapterShape() { return { subtitle: '', icon: '', group: '', defaultShape: '', defaultHideDependencyLines: false, quests: [], extra: {} }; }
function newQuestShape() {
  return { title: '', subtitle: '', description: '', icon: '', x: 0, y: 0, shape: '', size: 1, dependencies: [],
    dependencyRequirement: 'all_completed', optional: false, hideUntilDepsVisible: false, hideDependencyLines: false,
    tasks: [], rewards: [], extra: {} };
}

/* ===================== SNBT EXPORT ===================== */
function itemValue(id, target) { return target === '1.20' ? id : { count: 1, id }; }
function extrasToRaw(extra) {
  const o = {};
  Object.entries(extra || {}).forEach(([k, text]) => { o[k] = SNBT.raw(text); });
  return o;
}
function textLines(s) { return String(s || '').split('\n'); }

function entryToSnbt(e, schemaSet, target) {
  const o = extrasToRaw(e.extra);
  o.id = e.id;
  o.type = e.type;
  (schemaSet[e.type]?.fields || []).forEach(f => {
    const v = e[f.k];
    switch (f.kind) {
      case 'item': o[f.k] = e.itemRaw ? SNBT.raw(e.itemRaw) : itemValue(v, target); break;
      case 'long': o[f.k] = SNBT.L(v); break;
      case 'int': o[f.k] = Math.trunc(Number(v) || 0); break;
      case 'bool': o[f.k] = !!v; break;
      case 'tri': if (v === 'true' || v === 'false') o[f.k] = v === 'true'; break;
      case 'ivec3': o[f.k] = SNBT.intArray((v || [0, 0, 0]).map(n => Number(n) || 0)); break;
      default: if (v !== '' || f.k !== 'criterion') o[f.k] = String(v ?? ''); // empty criterion = "any"
    }
  });
  return o;
}

function questToSnbt(q, target) {
  const o = extrasToRaw(q.extra);
  o.id = q.id;
  if (q.title) o.title = q.title;
  if (q.subtitle) o.subtitle = q.subtitle;
  if (q.description.trim()) o.description = textLines(q.description);
  if (q.icon) o.icon = itemValue(q.icon, target);
  o.x = SNBT.D(q.x);
  o.y = SNBT.D(q.y);
  if (q.shape) o.shape = q.shape;
  if (Number(q.size) && Number(q.size) !== 1) o.size = SNBT.D(q.size);
  if (q.dependencies.length) o.dependencies = [...q.dependencies];
  if (q.dependencyRequirement && q.dependencyRequirement !== 'all_completed') o.dependency_requirement = q.dependencyRequirement;
  if (q.optional) o.optional = true;
  if (q.hideUntilDepsVisible) o.hide_until_deps_visible = true;
  if (q.hideDependencyLines) o.hide_dependency_lines = true;
  o.tasks = q.tasks.map(t => entryToSnbt(t, TASK_TYPES, target));
  o.rewards = q.rewards.map(r => entryToSnbt(r, REWARD_TYPES, target));
  return o;
}

function chapterToSnbt(ch, target = project.target) {
  const o = extrasToRaw(ch.extra);
  o.id = ch.id;
  o.filename = ch.filename;
  o.group = ch.group || '';
  o.order_index = project.chapters.indexOf(ch);
  o.title = ch.title;
  if (ch.subtitle.trim()) o.subtitle = textLines(ch.subtitle);
  if (ch.icon) o.icon = itemValue(ch.icon, target);
  o.default_quest_shape = ch.defaultShape || '';
  o.default_hide_dependency_lines = !!ch.defaultHideDependencyLines;
  if (!o.quest_links) o.quest_links = [];
  o.quests = ch.quests.map(q => questToSnbt(q, target));
  return SNBT.write(o);
}

/* ===================== SNBT IMPORT ===================== */
function extrasFrom(obj, known) {
  const raws = SNBT.rawOf(obj), extra = {};
  Object.keys(obj).forEach(k => { if (!known.includes(k) && raws[k] !== undefined) extra[k] = raws[k]; });
  return extra;
}
function itemIdOf(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return String(v.id || v.item || '');
  return '';
}
function joinLines(v) { return Array.isArray(v) ? v.join('\n') : (v == null ? '' : String(v)); }

function entryFromSnbt(o, schemaSet, taken) {
  const type = String(o.type || '').replace(/^ftbquests:/, '');
  const def = schemaSet[type];
  const fields = def ? def.fields : [];
  const e = { id: String(o.id || newId(taken)), type, extra: extrasFrom(o, ['id', 'type', ...fields.map(f => f.k)]) };
  fields.forEach(f => {
    const v = o[f.k];
    if (v === undefined) { e[f.k] = Array.isArray(f.def) ? [...f.def] : f.def; return; }
    switch (f.kind) {
      case 'item': {
        e[f.k] = itemIdOf(v);
        // Items carrying components/NBT can't be edited here; keep the exact source text.
        if (v && typeof v === 'object' && Object.keys(v).some(k => !['id', 'count', 'Count'].includes(k))) e.itemRaw = SNBT.rawOf(o)[f.k];
        break;
      }
      case 'bool': e[f.k] = !!v; break;
      case 'tri': e[f.k] = v === true ? 'true' : v === false ? 'false' : 'default'; break;
      case 'ivec3': e[f.k] = Array.isArray(v) ? v.slice(0, 3).map(Number) : [...f.def]; break;
      case 'int': case 'long': e[f.k] = Number(v) || 0; break;
      default: e[f.k] = String(v);
    }
  });
  return e;
}

const QUEST_KEYS = ['id', 'title', 'subtitle', 'description', 'icon', 'x', 'y', 'shape', 'size', 'dependencies',
  'dependency_requirement', 'optional', 'hide_until_deps_visible', 'hide_dependency_lines', 'tasks', 'rewards'];
const CHAPTER_KEYS = ['id', 'filename', 'group', 'order_index', 'title', 'subtitle', 'icon', 'default_quest_shape',
  'default_hide_dependency_lines', 'quests'];

// `lang` = parsed lang/en_us.snbt (1.21+ keeps quest text there instead of in the chapter file).
function chapterFromSnbt(o, lang = {}, taken = allIds()) {
  const id = String(o.id || newId(taken));
  const ch = {
    id, filename: String(o.filename || ''), group: String(o.group || ''),
    title: String(o.title ?? lang[`chapter.${id}.title`] ?? ''),
    subtitle: joinLines(o.subtitle ?? lang[`chapter.${id}.chapter_subtitle`]),
    icon: itemIdOf(o.icon), defaultShape: String(o.default_quest_shape || ''),
    defaultHideDependencyLines: !!o.default_hide_dependency_lines,
    extra: extrasFrom(o, CHAPTER_KEYS), _order: Number(o.order_index) || 0,
    quests: (o.quests || []).map(qo => {
      const qid = String(qo.id || newId(taken));
      return {
        id: qid,
        title: String(qo.title ?? lang[`quest.${qid}.title`] ?? ''),
        subtitle: String(qo.subtitle ?? lang[`quest.${qid}.quest_subtitle`] ?? ''),
        description: joinLines(qo.description ?? lang[`quest.${qid}.quest_desc`]),
        icon: itemIdOf(qo.icon), x: Number(qo.x) || 0, y: Number(qo.y) || 0,
        shape: String(qo.shape || '').replace(/^default$/, ''), size: Number(qo.size) || 1,
        dependencies: (qo.dependencies || []).map(String),
        dependencyRequirement: DEP_REQUIREMENTS[qo.dependency_requirement] ? qo.dependency_requirement : 'all_completed',
        optional: !!qo.optional, hideUntilDepsVisible: !!qo.hide_until_deps_visible, hideDependencyLines: !!qo.hide_dependency_lines,
        tasks: (qo.tasks || []).map(t => entryFromSnbt(t, TASK_TYPES, taken)),
        rewards: (qo.rewards || []).map(r => entryFromSnbt(r, REWARD_TYPES, taken)),
        extra: extrasFrom(qo, QUEST_KEYS),
      };
    }),
  };
  if (!ch.filename) ch.filename = slug(ch.title) || 'chapter_' + id.toLowerCase();
  return ch;
}

// Adds chapters; a chapter whose id already exists replaces the old one in place.
function mergeChapters(chs) {
  chs.sort((a, b) => a._order - b._order).forEach(ch => {
    delete ch._order;
    const i = project.chapters.findIndex(c => c.id === ch.id);
    if (i >= 0) project.chapters[i] = ch; else project.chapters.push(ch);
    if (!project.exportedChapterIds.includes(ch.id)) project.exportedChapterIds.push(ch.id);
  });
  if (chs.length) activeChapterId = chs[0].id;
  selectedQuestId = null; selectedEdge = null;
  renderAll(true);
}

/* ===================== LOAD / SAVE ===================== */
function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('WorkspaceSuiteDB');
    req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('settings')) e.target.result.createObjectStore('settings'); };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}
async function dbGet(key) {
  const db = await getDB();
  if (!db.objectStoreNames.contains('settings')) return null;
  return new Promise(res => {
    const r = db.transaction('settings', 'readonly').objectStore('settings').get(key);
    r.onsuccess = () => res(r.result); r.onerror = () => res(null);
  });
}
async function dbPut(key, value) {
  const db = await getDB();
  db.transaction('settings', 'readwrite').objectStore('settings').put(value, key);
}
async function subDir(parent, name, create) {
  for await (const entry of parent.values()) {
    if (entry.kind === 'directory' && entry.name.toLowerCase() === name.toLowerCase()) return entry;
  }
  return create ? parent.getDirectoryHandle(name, { create: true }) : null;
}

async function saveProject(silent = false) {
  const json = JSON.stringify(project, null, 2);
  if (!currentFileName) {
    if (!silent) alert('This page was opened directly, so there is no project file to save to.\nOpen it from the hub, or use 🚀 Export to game.');
    return;
  }
  sessionStorage.setItem('active_project_payload', json);
  try {
    const root = await dbGet('root_folder_handle');
    if (root && (await root.queryPermission({ mode: 'readwrite' })) === 'granted') {
      const dir = await subDir(root, 'quests', true);
      const writable = await (await dir.getFileHandle(currentFileName, { create: true })).createWritable();
      await writable.write(json);
      await writable.close();
      markSaved();
      if (!silent) toast(`💾 Saved /quests/${currentFileName}`);
      return;
    }
  } catch (e) { console.error(e); }
  localStorage.setItem('suite_backup_' + currentFileName, json);
  markSaved();
  if (!silent) alert('Folder not accessible — saved to the browser cache instead.');
}

function toast(msg) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e352f;border:1px solid #27ae60;color:#5ddb8e;padding:8px 16px;border-radius:8px;font-size:13px;z-index:3000;transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

function seedDemo() {
  const ch = newChapter('Getting Started');
  ch.icon = 'minecraft:oak_sapling';
  const a = newQuest(0, 0, 'Punch a Tree'); a.description = 'Every journey starts with wood.\n\n&aGet some logs!&r';
  a.tasks.push({ ...newEntry('item', TASK_TYPES), count: 16 });
  a.rewards.push({ ...newEntry('item', REWARD_TYPES), item: 'minecraft:apple', count: 4 });
  const b = newQuest(2, 0, 'Stone Age'); b.tasks.push({ ...newEntry('item', TASK_TYPES), item: 'minecraft:cobblestone', count: 32 });
  b.dependencies.push(a.id);
  const c = newQuest(4, 0, 'Into the Nether'); c.shape = 'hexagon'; c.tasks.push(newEntry('dimension', TASK_TYPES));
  c.dependencies.push(b.id); c.rewards.push(newEntry('xp_levels', REWARD_TYPES));
  ch.quests.push(a, b, c);
  project.chapters.push(ch);
}

window.addEventListener('DOMContentLoaded', () => {
  currentFileName = sessionStorage.getItem('active_project_filename') || '';
  const payload = sessionStorage.getItem('active_project_payload');
  if (currentFileName && payload) {
    try { project = normalizeProject(JSON.parse(payload)); } catch (e) { alert('Could not read project file: ' + e.message); }
    if (!project.chapters.length) project.chapters.push(newChapter('Getting Started'));
  } else {
    currentFileName = '';
    seedDemo();
  }
  $('project-name').textContent = currentFileName ? `/quests/${currentFileName}` : '(demo — not saved)';
  $('target-select').value = project.target;
  activeChapterId = project.chapters[0]?.id || null;
  wireEvents();
  renderAll(true);
  markSaved();
});

/* ===================== RENDERING ===================== */
function renderAll(fit = false) {
  renderSidebar();
  renderCanvas();
  if (fit) fitView();
  renderPanel();
}

function renderSidebar() {
  $('chapter-list').innerHTML = project.chapters.map((c, i) => `
    <div class="chapter-item ${c.id === activeChapterId ? 'active' : ''}" data-action="pick-chapter" data-id="${c.id}">
      <span class="ch-name">${esc(c.title || c.filename)}</span>
      <span class="ch-count">${c.quests.length}</span>
      <button class="ch-btn" data-action="chapter-up" data-idx="${i}" title="Move up">▲</button>
      <button class="ch-btn" data-action="chapter-down" data-idx="${i}" title="Move down">▼</button>
      <button class="ch-btn" data-action="chapter-delete" data-idx="${i}" title="Delete">✕</button>
    </div>`).join('') || '<div class="empty-note">No chapters yet.</div>';
}

function effectiveShape(q, ch) { return q.shape || ch?.defaultShape || 'circle'; }

function polygon(n, r, rot = -90) {
  return Array.from({ length: n }, (_, i) => {
    const a = (rot + i * 360 / n) * Math.PI / 180;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}
function shapeSVG(shape) {
  switch (shape) {
    case 'square': return '<rect class="shape-fill" x="6" y="6" width="88" height="88"/>';
    case 'rsquare': return '<rect class="shape-fill" x="6" y="6" width="88" height="88" rx="22"/>';
    case 'diamond': return '<polygon class="shape-fill" points="50,3 97,50 50,97 3,50"/>';
    case 'pentagon': return `<polygon class="shape-fill" points="${polygon(5, 48)}"/>`;
    case 'hexagon': return `<polygon class="shape-fill" points="${polygon(6, 48, 0)}"/>`;
    case 'octagon': return `<polygon class="shape-fill" points="${polygon(8, 48, 22.5)}"/>`;
    case 'heart': return '<path class="shape-fill" d="M50,92 C20,70 4,52 4,32 C4,16 16,6 30,6 C40,6 47,12 50,20 C53,12 60,6 70,6 C84,6 96,16 96,32 C96,52 80,70 50,92 Z"/>';
    case 'gear': {
      const pts = Array.from({ length: 16 }, (_, i) => {
        const a = (i * 22.5) * Math.PI / 180, r = i % 2 ? 40 : 48;
        return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      return `<polygon class="shape-fill" points="${pts}"/>`;
    }
    default: return '<circle class="shape-fill" cx="50" cy="50" r="46"/>';
  }
}
function questEmoji(q) {
  const t = q.tasks[0];
  if (!t) return '❔';
  return TASK_TYPES[t.type]?.icon || '🧩';
}

function renderCanvas() {
  $('nodes-layer').innerHTML = '';
  const ch = activeChapter();
  if (ch) ch.quests.forEach(q => renderQuestNode(q));
  renderEdges();
  applyTransform();
}

function renderQuestNode(q) {
  const ch = activeChapter();
  let el = $('q-' + q.id);
  if (!el) {
    el = document.createElement('div');
    el.id = 'q-' + q.id;
    el.className = 'quest-node';
    el.dataset.id = q.id;
    $('nodes-layer').appendChild(el);
  }
  const px = NODE_PX * (Number(q.size) || 1);
  el.style.width = el.style.height = px + 'px';
  el.style.left = (q.x * UNIT - px / 2) + 'px';
  el.style.top = (q.y * UNIT - px / 2) + 'px';
  const sel = selectedQuestId && findQuest(selectedQuestId)?.quest;
  el.classList.toggle('selected', q.id === selectedQuestId);
  el.classList.toggle('has-tasks', q.tasks.length > 0);
  el.classList.toggle('optional', !!q.optional);
  el.classList.toggle('link-source', q.id === linkSource);
  el.classList.toggle('dep-of-selected', !!sel && sel.dependencies.includes(q.id));
  el.innerHTML = `<svg class="shape" viewBox="0 0 100 100">${shapeSVG(effectiveShape(q, ch))}</svg>
    <div class="q-icon">${questEmoji(q)}</div>
    <div class="q-title">${esc(q.title || '(untitled)')}</div>
    <div class="q-port" title="Drag onto another quest to make it depend on this one"></div>`;
}

function renderEdges() {
  const g = $('edges-g');
  g.innerHTML = '';
  const ch = activeChapter();
  if (!ch) return;
  const byId = new Map(ch.quests.map(q => [q.id, q]));
  ch.quests.forEach(q => q.dependencies.forEach(depId => {
    const d = byId.get(depId);
    if (!d) return;
    const x1 = d.x * UNIT, y1 = d.y * UNIT, x2 = q.x * UNIT, y2 = q.y * UNIT;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const r1 = NODE_PX * (d.size || 1) / 2, r2 = NODE_PX * (q.size || 1) / 2 + 3;
    if (len <= r1 + r2) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const a = `M${x1 + ux * r1},${y1 + uy * r1} L${x2 - ux * r2},${y2 - uy * r2}`;
    const isSel = selectedEdge && selectedEdge.from === depId && selectedEdge.to === q.id;
    const ns = 'http://www.w3.org/2000/svg';
    const hit = document.createElementNS(ns, 'path');
    hit.setAttribute('d', a); hit.setAttribute('class', 'edge-hit');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', a); p.setAttribute('class', 'edge' + (isSel ? ' selected' : ''));
    p.setAttribute('marker-end', `url(#${isSel ? 'arrow-sel' : 'arrow'})`);
    if (q.hideDependencyLines) p.setAttribute('stroke-dasharray', '4 5');
    [hit, p].forEach(el => { el.dataset.from = depId; el.dataset.to = q.id; });
    g.append(p, hit);
  }));
}

function applyTransform() {
  $('canvas-world').style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const wrap = $('canvas-wrap');
  wrap.style.backgroundSize = `${UNIT * zoom}px ${UNIT * zoom}px`;
  wrap.style.backgroundPosition = `${panX - UNIT * zoom / 2}px ${panY - UNIT * zoom / 2}px`;
  $('zoom-lbl').textContent = Math.round(zoom * 100) + '%';
}

function fitView() {
  const ch = activeChapter(), wrap = $('canvas-wrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!ch || !ch.quests.length) { zoom = 1; panX = w / 2; panY = h / 2; applyTransform(); return; }
  const xs = ch.quests.map(q => q.x * UNIT), ys = ch.quests.map(q => q.y * UNIT);
  const minX = Math.min(...xs) - UNIT, maxX = Math.max(...xs) + UNIT, minY = Math.min(...ys) - UNIT, maxY = Math.max(...ys) + UNIT * 1.4;
  zoom = Math.max(0.3, Math.min(1.6, Math.min(w / (maxX - minX), h / (maxY - minY))));
  panX = w / 2 - (minX + maxX) / 2 * zoom;
  panY = h / 2 - (minY + maxY) / 2 * zoom;
  applyTransform();
}
function zoomAt(factor, cx, cy) {
  const nz = Math.max(0.25, Math.min(2.5, zoom * factor));
  panX = cx - (cx - panX) * (nz / zoom);
  panY = cy - (cy - panY) * (nz / zoom);
  zoom = nz;
  applyTransform();
}
function screenToUnits(clientX, clientY) {
  const r = $('canvas-wrap').getBoundingClientRect();
  return { x: (clientX - r.left - panX) / zoom / UNIT, y: (clientY - r.top - panY) / zoom / UNIT };
}

/* ===================== SELECTION & EDITING ===================== */
function selectQuest(id) {
  selectedQuestId = id; selectedEdge = null;
  if (currentTab !== 'inspector' && id) setTab('inspector');
  const ch = activeChapter();
  if (ch) ch.quests.forEach(renderQuestNode);
  renderEdges();
  renderPanel();
}
function selectEdge(from, to) {
  selectedEdge = { from, to }; selectedQuestId = null;
  if (currentTab !== 'inspector') setTab('inspector');
  const ch = activeChapter();
  if (ch) ch.quests.forEach(renderQuestNode);
  renderEdges();
  renderPanel();
}
function pickChapter(id) {
  activeChapterId = id; selectedQuestId = null; selectedEdge = null; setLinkMode(false);
  renderAll(true);
}

function wouldCycle(fromId, toId) {
  // Adding "to depends on from" creates a cycle if "from" already (transitively) depends on "to".
  const seen = new Set(), stack = [fromId];
  while (stack.length) {
    const id = stack.pop();
    if (id === toId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    findQuest(id)?.quest.dependencies.forEach(d => stack.push(d));
  }
  return false;
}
function toggleDependency(fromId, toId) {
  if (fromId === toId) return;
  const target = findQuest(toId)?.quest;
  if (!target) return;
  const i = target.dependencies.indexOf(fromId);
  if (i >= 0) target.dependencies.splice(i, 1);
  else {
    if (wouldCycle(fromId, toId)) { alert('That would create a circular dependency — FTB Quests refuses to load those.'); return; }
    target.dependencies.push(fromId);
  }
  activeChapter()?.quests.forEach(renderQuestNode);
  renderEdges();
  renderPanel();
}

function addQuestAt(x, y) {
  const ch = activeChapter();
  if (!ch) { alert('Create a chapter first.'); return; }
  let px = snapHalf(x), py = snapHalf(y);
  while (ch.quests.some(q => q.x === px && q.y === py)) px += 1;
  const q = newQuest(px, py);
  q.tasks.push(newEntry('checkmark', TASK_TYPES));
  ch.quests.push(q);
  renderQuestNode(q);
  renderSidebar();
  selectQuest(q.id);
  setTimeout(() => document.querySelector('[data-q="title"]')?.select(), 0);
}
function deleteQuest(id) {
  const ch = activeChapter();
  if (!ch) return;
  ch.quests = ch.quests.filter(q => q.id !== id);
  project.chapters.forEach(c => c.quests.forEach(q => { q.dependencies = q.dependencies.filter(d => d !== id); }));
  if (selectedQuestId === id) selectedQuestId = null;
  renderCanvas(); renderSidebar(); renderPanel();
}
function duplicateQuest(id) {
  const ch = activeChapter(), src = ch?.quests.find(q => q.id === id);
  if (!src) return;
  const taken = allIds();
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = newId(taken);
  copy.title = src.title + ' (copy)';
  copy.y = src.y + 1;
  copy.tasks.forEach(t => { t.id = newId(taken); });
  copy.rewards.forEach(r => { r.id = newId(taken); });
  ch.quests.push(copy);
  renderQuestNode(copy); renderSidebar(); selectQuest(copy.id);
}

function setLinkMode(on) {
  linkMode = on; linkSource = null;
  $('connect-btn').classList.toggle('on', on);
  $('connect-btn').textContent = on ? '🔗 Link ON' : '🔗 Link';
  $('canvas-wrap').classList.toggle('connect-mode', on);
  activeChapter()?.quests.forEach(renderQuestNode);
}

/* ===================== PANEL ===================== */
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.ptab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderPanel();
}
function renderPanel() {
  updateProblemCount();
  const body = $('panel-body');
  if (currentTab === 'snbt') { body.innerHTML = snbtPanelHTML(); return; }
  if (currentTab === 'problems') { body.innerHTML = problemsPanelHTML(); return; }
  const found = selectedQuestId && findQuest(selectedQuestId);
  if (found) body.innerHTML = questPanelHTML(found.quest);
  else if (selectedEdge) body.innerHTML = edgePanelHTML();
  else body.innerHTML = chapterPanelHTML();
}

function opt(value, label, current) { return `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`; }
function resValid(v, allowTag) { return RES_RE.test(allowTag ? String(v).replace(/^#/, '') : v); }

function chapterPanelHTML() {
  const ch = activeChapter();
  if (!ch) return '<div class="empty-note">Create a chapter on the left to start.</div>';
  const taskCount = ch.quests.reduce((n, q) => n + q.tasks.length, 0);
  return `
  <div class="sec">
    <div class="sec-title">Chapter <span class="idtag">${ch.id}</span></div>
    <div class="fg"><label class="fl">Title</label><input class="fi" data-ch="title" value="${esc(ch.title)}"></div>
    <div class="fg"><label class="fl">Subtitle (tooltip, one line per line)</label><textarea class="fi" data-ch="subtitle" rows="2">${esc(ch.subtitle)}</textarea></div>
    <div class="row">
      <div class="fg"><label class="fl">Icon item</label><input class="fi ${ch.icon && !resValid(ch.icon) ? 'bad' : ''}" data-ch="icon" data-kind="res" data-optional="1" value="${esc(ch.icon)}" placeholder="minecraft:book"></div>
      <div class="fg"><label class="fl">File name (.snbt)</label><input class="fi" data-ch="filename" value="${esc(ch.filename)}"></div>
    </div>
    <div class="fg"><label class="fl">Default quest shape</label><select class="fi" data-ch="defaultShape">${SHAPES.map(s => opt(s, SHAPE_LABELS[s], ch.defaultShape)).join('')}</select></div>
    <label class="chk"><input type="checkbox" data-ch="defaultHideDependencyLines" ${ch.defaultHideDependencyLines ? 'checked' : ''}> Hide dependency lines by default</label>
  </div>
  <div class="sec">
    <div class="sec-title">Contents</div>
    <div class="hint">${ch.quests.length} quest(s), ${taskCount} task(s).</div>
    <button class="mini-btn" data-action="add-quest">＋ Add quest</button>
  </div>
  <div class="sec">
    <div class="sec-title">Getting it into the game</div>
    <div class="hint">
      1. <b>🚀 Export to game</b> and pick your instance folder (or <code>config/ftbquests/quests</code>).<br>
      2. In game run <code>/ftbquests reload</code>, or restart.<br>
      Or copy/download this chapter from the <b>SNBT</b> tab and drop it into <code>config/ftbquests/quests/chapters/</code>.<br><br>
      ⚠️ Don't edit quests in-game while exporting from here — the game will overwrite the file on its next save. To bring in-game edits back, use <b>📂 Import from game</b>.
    </div>
  </div>`;
}

function edgePanelHTML() {
  const from = findQuest(selectedEdge.from)?.quest, to = findQuest(selectedEdge.to)?.quest;
  return `<div class="sec">
    <div class="sec-title">Dependency</div>
    <div class="hint"><b>${esc(to?.title || '?')}</b> requires <b>${esc(from?.title || '?')}</b>.</div>
    <button class="mini-btn danger" data-action="delete-edge">🗑 Remove dependency</button>
  </div>`;
}

function fieldHTML(listName, idx, f, e) {
  const base = `data-list="${listName}" data-idx="${idx}" data-f="${f.k}" data-kind="${f.kind}"`;
  const v = e[f.k];
  switch (f.kind) {
    case 'bool': return `<label class="chk"><input type="checkbox" ${base} ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'tri': return `<div class="fg"><label class="fl">${esc(f.label)}</label><select class="fi" ${base}>
        ${opt('default', 'Chapter / file default', v)}${opt('true', 'Yes', v)}${opt('false', 'No', v)}</select></div>`;
    case 'ivec3': return `<div class="fg"><label class="fl">${esc(f.label)}</label><div class="row">
        ${[0, 1, 2].map(i => `<input class="fi" type="number" step="1" ${base} data-sub="${i}" value="${Number((v || [])[i]) || 0}">`).join('')}</div></div>`;
    case 'int': case 'long': return `<div class="fg"><label class="fl">${esc(f.label)}</label><input class="fi" type="number" step="1" min="0" ${base} value="${Number(v) || 0}"></div>`;
    case 'item': {
      if (e.itemRaw) return `<div class="fg"><label class="fl">${esc(f.label)}</label><div class="raw-note">${esc(v)} — has custom NBT/components from import, kept exactly as-is.</div>
        <button class="mini-btn" data-action="clear-itemraw" data-list="${listName}" data-idx="${idx}">Make it a plain item</button></div>`;
      return `<div class="fg"><label class="fl">${esc(f.label)}</label><input class="fi ${resValid(v) ? '' : 'bad'}" ${base} value="${esc(v)}" placeholder="modid:item_name"></div>`;
    }
    case 'res': return `<div class="fg"><label class="fl">${esc(f.label)}</label><input class="fi ${resValid(v, f.tag) ? '' : 'bad'}" ${base} ${f.tag ? 'data-tag="1"' : ''} value="${esc(v)}" placeholder="modid:name"></div>`;
    default: return `<div class="fg"><label class="fl">${esc(f.label)}</label><input class="fi" ${base} value="${esc(v)}"></div>`;
  }
}

function entriesHTML(q, listName, schemaSet) {
  const list = q[listName];
  const items = list.map((e, i) => {
    const def = schemaSet[e.type];
    const extraKeys = Object.keys(e.extra || {});
    return `<div class="entry">
      <div class="entry-head">${def ? def.icon : '🧩'} ${esc(def ? def.label : e.type)}<span class="grow"></span>
        <button class="mini-btn" data-action="move-entry" data-list="${listName}" data-idx="${i}" data-dir="-1" title="Move up">↑</button>
        <button class="mini-btn danger" data-action="delete-entry" data-list="${listName}" data-idx="${i}" title="Remove">✕</button>
      </div>
      ${def ? def.fields.map(f => fieldHTML(listName, i, f, e)).join('') : `<div class="raw-note">Type "${esc(e.type)}" can't be edited here — it's exported exactly as imported.</div>`}
      ${def && extraKeys.length ? `<div class="raw-note">Also keeps imported settings: ${esc(extraKeys.join(', '))}</div>` : ''}
    </div>`;
  }).join('');
  return `${items || `<div class="hint">No ${listName} yet.</div>`}
    <div class="add-row">
      <select class="fi" id="add-${listName}-type">${Object.entries(schemaSet).map(([k, d]) => `<option value="${k}">${d.icon} ${esc(d.label)}</option>`).join('')}</select>
      <button class="mini-btn" data-action="add-entry" data-list="${listName}">＋ Add</button>
    </div>`;
}

function questPanelHTML(q) {
  const depsHTML = q.dependencies.map(id => {
    const f = findQuest(id);
    const label = f ? (f.quest.title || '(untitled)') : `Missing quest ${id}`;
    const other = f && f.chapter.id !== activeChapterId ? `<span class="other">${esc(f.chapter.title)}</span>` : '';
    return `<div class="dep-item"><span class="grow">${f ? '' : '⚠️ '}${esc(label)}</span>${other}
      <button class="mini-btn danger" data-action="remove-dep" data-id="${id}">✕</button></div>`;
  }).join('') || '<div class="hint">No dependencies — available from the start.</div>';

  const options = project.chapters.map(c => {
    const qs = c.quests.filter(o => o.id !== q.id && !q.dependencies.includes(o.id));
    if (!qs.length) return '';
    return `<optgroup label="${esc(c.title || c.filename)}">${qs.map(o => `<option value="${o.id}">${esc(o.title || '(untitled)')}</option>`).join('')}</optgroup>`;
  }).join('');
  const extraKeys = Object.keys(q.extra || {});

  return `
  <div class="sec">
    <div class="sec-title">Quest <span class="idtag">${q.id}</span></div>
    <div class="fg"><label class="fl">Title</label><input class="fi" data-q="title" value="${esc(q.title)}"></div>
    <div class="fg"><label class="fl">Subtitle</label><input class="fi" data-q="subtitle" value="${esc(q.subtitle)}"></div>
    <div class="fg"><label class="fl">Description</label><textarea class="fi" data-q="description" rows="4">${esc(q.description)}</textarea>
      <div class="hint">One line per line. Colour codes like <code>&amp;a</code> <code>&amp;l</code> <code>&amp;r</code> and <code>{@pagebreak}</code> work.</div></div>
    <div class="row">
      <div class="fg"><label class="fl">Icon item (optional)</label><input class="fi ${q.icon && !resValid(q.icon) ? 'bad' : ''}" data-q="icon" data-kind="res" data-optional="1" value="${esc(q.icon)}" placeholder="auto from task"></div>
      <div class="fg"><label class="fl">Shape</label><select class="fi" data-q="shape">${SHAPES.map(s => opt(s, SHAPE_LABELS[s], q.shape)).join('')}</select></div>
    </div>
    <div class="row">
      <div class="fg"><label class="fl">X</label><input class="fi" type="number" step="0.5" data-q="x" data-kind="num" value="${q.x}"></div>
      <div class="fg"><label class="fl">Y</label><input class="fi" type="number" step="0.5" data-q="y" data-kind="num" value="${q.y}"></div>
      <div class="fg"><label class="fl">Size</label><input class="fi" type="number" step="0.25" min="0.25" data-q="size" data-kind="num" value="${q.size}"></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-title">Tasks</div>
    ${entriesHTML(q, 'tasks', TASK_TYPES)}
  </div>
  <div class="sec">
    <div class="sec-title">Rewards</div>
    ${entriesHTML(q, 'rewards', REWARD_TYPES)}
  </div>
  <div class="sec">
    <div class="sec-title">Dependencies</div>
    ${depsHTML}
    ${options ? `<div class="add-row"><select class="fi" id="add-dep-select">${options}</select><button class="mini-btn" data-action="add-dep">＋ Add</button></div>` : ''}
    <div class="fg"><label class="fl">Requirement</label><select class="fi" data-q="dependencyRequirement">${Object.entries(DEP_REQUIREMENTS).map(([k, l]) => opt(k, l, q.dependencyRequirement)).join('')}</select></div>
  </div>
  <div class="sec">
    <div class="sec-title">Visibility &amp; misc</div>
    <label class="chk"><input type="checkbox" data-q="optional" ${q.optional ? 'checked' : ''}> Optional quest</label>
    <label class="chk"><input type="checkbox" data-q="hideUntilDepsVisible" ${q.hideUntilDepsVisible ? 'checked' : ''}> Hide until dependencies are visible</label>
    <label class="chk"><input type="checkbox" data-q="hideDependencyLines" ${q.hideDependencyLines ? 'checked' : ''}> Hide dependency lines</label>
    ${extraKeys.length ? `<div class="raw-note">Also keeps imported settings: ${esc(extraKeys.join(', '))}</div>` : ''}
  </div>
  <div class="row">
    <button class="mini-btn" data-action="duplicate-quest">⧉ Duplicate</button>
    <button class="mini-btn danger" data-action="delete-quest">🗑 Delete quest</button>
  </div>`;
}

function snbtPanelHTML() {
  const ch = activeChapter();
  if (!ch) return '<div class="empty-note">No chapter selected.</div>';
  return `<div class="sec">
    <div class="sec-title">${esc(ch.filename)}.snbt <span>
      <button class="mini-btn" data-action="copy-snbt">📋 Copy</button>
      <button class="mini-btn" data-action="download-snbt">⬇ Download</button></span></div>
    <div class="hint">Goes in <code>config/ftbquests/quests/chapters/</code>. Format: Minecraft ${project.target === '1.20' ? '1.20 and older' : '1.21+'}.</div>
    <pre class="snbt">${esc(chapterToSnbt(ch))}</pre>
  </div>`;
}

/* ===================== VALIDATION ===================== */
function validate() {
  const out = [];
  const push = (level, msg, chapterId, questId) => out.push({ level, msg, chapterId, questId });
  const files = new Map();
  project.chapters.forEach(ch => {
    const cname = ch.title || ch.filename;
    if (!/^[a-z0-9_]+$/.test(ch.filename)) push('error', `Chapter "${cname}": file name must be lowercase letters, numbers and _ only.`, ch.id);
    if (files.has(ch.filename)) push('error', `Chapters "${files.get(ch.filename)}" and "${cname}" use the same file name.`, ch.id);
    files.set(ch.filename, cname);
    if (!ch.title.trim()) push('warn', `Chapter "${ch.filename}" has no title.`, ch.id);
    if (ch.icon && !resValid(ch.icon)) push('warn', `Chapter "${cname}": icon "${ch.icon}" isn't a valid item id.`, ch.id);
    const spots = new Map();
    ch.quests.forEach(q => {
      const qn = `"${q.title || '(untitled)'}"`;
      if (!q.tasks.length) push('warn', `${qn} has no tasks, so it can never be completed.`, ch.id, q.id);
      if (q.icon && !resValid(q.icon)) push('warn', `${qn}: icon "${q.icon}" isn't a valid item id.`, ch.id, q.id);
      q.dependencies.forEach(d => { if (!findQuest(d)) push('error', `${qn} depends on a quest that no longer exists (${d}).`, ch.id, q.id); });
      const spot = q.x + ',' + q.y;
      if (spots.has(spot)) push('warn', `${qn} sits exactly on top of "${spots.get(spot)}".`, ch.id, q.id);
      spots.set(spot, q.title);
      [['tasks', TASK_TYPES], ['rewards', REWARD_TYPES]].forEach(([listName, set]) => q[listName].forEach(e => {
        const def = set[e.type];
        if (!def) return;
        def.fields.forEach(f => {
          if ((f.kind === 'res' || f.kind === 'item') && !e.itemRaw && !resValid(e[f.k], f.tag)) {
            push('error', `${qn}: ${def.label} ${listName === 'tasks' ? 'task' : 'reward'} has an invalid ${f.label.toLowerCase()} "${e[f.k]}".`, ch.id, q.id);
          }
        });
        if (e.type === 'gamestage' && !String(e.stage).trim()) push('error', `${qn}: stage name is empty.`, ch.id, q.id);
        if (e.type === 'command' && !String(e.command).trim()) push('error', `${qn}: command reward is empty.`, ch.id, q.id);
      }));
      if (wouldCycleFromSelf(q)) push('error', `${qn} is part of a circular dependency.`, ch.id, q.id);
    });
  });
  return out;
}
function wouldCycleFromSelf(q) {
  const seen = new Set(), stack = [...q.dependencies];
  while (stack.length) {
    const id = stack.pop();
    if (id === q.id) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    findQuest(id)?.quest.dependencies.forEach(d => stack.push(d));
  }
  return false;
}
function updateProblemCount() {
  const n = validate().length, el = $('problem-count');
  el.textContent = n ? n : '';
  el.classList.toggle('has', n > 0);
}
function problemsPanelHTML() {
  const list = validate();
  if (!list.length) return '<div class="empty-note">✅ No problems found.<br>Ready to export.</div>';
  return list.map(p => `<div class="problem ${p.level}" data-action="goto-problem" data-ch="${p.chapterId || ''}" data-qid="${p.questId || ''}">
    <span>${p.level === 'error' ? '⛔' : '⚠️'}</span><span>${esc(p.msg)}</span></div>`).join('');
}

/* ===================== GAME FOLDER EXPORT / IMPORT ===================== */
async function hasEntry(dir, name, kind) {
  try { kind === 'dir' ? await dir.getDirectoryHandle(name) : await dir.getFileHandle(name); return true; } catch { return false; }
}
// Accepts the instance folder, config/, config/ftbquests or config/ftbquests/quests.
async function resolveQuestsDir(dir, create) {
  const opts = { create };
  try {
    if (await hasEntry(dir, 'config', 'dir')) dir = await dir.getDirectoryHandle('config');
    if (dir.name === 'config') {
      if (!create && !(await hasEntry(dir, 'ftbquests', 'dir'))) return null;
      dir = await dir.getDirectoryHandle('ftbquests', opts);
    }
    if (dir.name === 'ftbquests') {
      if (!create && !(await hasEntry(dir, 'quests', 'dir'))) return null;
      dir = await dir.getDirectoryHandle('quests', opts);
    }
  } catch { return null; }
  if (dir.name === 'chapters') { alert('Pick the folder that contains "chapters" (usually config/ftbquests/quests), not "chapters" itself.'); return undefined; }
  if (dir.name === 'quests' || await hasEntry(dir, 'chapters', 'dir') || await hasEntry(dir, 'data.snbt')) return dir;
  if (!create) return null;
  return confirm(`"${dir.name}" doesn't look like a Minecraft instance or an FTB Quests folder.\n\nUse it anyway? (a "chapters" folder will be created inside)`) ? dir : undefined;
}

async function pickGameFolder(purpose) {
  const saved = await dbGet('ftbquests_game_handle');
  if (saved) {
    const reuse = confirm(`${purpose} using the remembered folder "${saved.name}"?\n\nOK = yes · Cancel = choose a different folder`);
    if (reuse) {
      if ((await saved.queryPermission({ mode: 'readwrite' })) === 'granted' || (await saved.requestPermission({ mode: 'readwrite' })) === 'granted') return saved;
    }
  }
  if (!('showDirectoryPicker' in window)) { alert('This browser does not support picking folders. Use Chrome, Edge or Brave.'); return null; }
  try {
    const dir = await window.showDirectoryPicker({ id: 'ftbquests', mode: 'readwrite' });
    await dbPut('ftbquests_game_handle', dir);
    return dir;
  } catch { return null; }
}

async function readText(dir, name) { return (await (await dir.getFileHandle(name)).getFile()).text(); }

async function exportToGame() {
  if (!project.chapters.length) { alert('Nothing to export yet.'); return; }
  const errors = validate().filter(p => p.level === 'error');
  if (errors.length && !confirm(`There are ${errors.length} error(s) (see Problems tab). FTB Quests may fail to load these quests.\n\nExport anyway?`)) return;

  const picked = await pickGameFolder('Export');
  if (!picked) return;
  const questsDir = await resolveQuestsDir(picked, true);
  if (!questsDir) return;

  try {
    const chaptersDir = await questsDir.getDirectoryHandle('chapters', { create: true });
    const ours = new Set([...project.chapters.map(c => c.id), ...(project.exportedChapterIds || [])]);
    const wanted = new Map(project.chapters.map(c => [c.filename + '.snbt', c]));
    const stale = [], overwrite = [];
    for await (const entry of chaptersDir.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.snbt')) continue;
      let id = null;
      try { id = String(SNBT.parse(await (await entry.getFile()).text()).id || ''); } catch { /* unreadable: leave it alone */ }
      const target = wanted.get(entry.name);
      if (target && target.id === id) continue;                    // same chapter, overwritten in place
      if (id && ours.has(id)) stale.push(entry.name);              // our chapter under an old file name, or one deleted here
      else if (target) overwrite.push(entry.name);                 // someone else's chapter with the same file name
    }

    const lines = [`Write ${wanted.size} chapter file(s) to:\n${picked.name}/…/${questsDir.name}/chapters/`];
    if (stale.length) lines.push(`\nRemove ${stale.length} old file(s) from earlier exports (renamed/deleted chapters):\n  ${stale.join('\n  ')}`);
    if (overwrite.length) lines.push(`\n⚠️ OVERWRITE ${overwrite.length} existing chapter(s) that were NOT made here:\n  ${overwrite.join('\n  ')}`);
    if (!confirm(lines.join('\n'))) return;

    for (const name of stale) await chaptersDir.removeEntry(name);
    for (const [name, ch] of wanted) {
      const w = await (await chaptersDir.getFileHandle(name, { create: true })).createWritable();
      await w.write(chapterToSnbt(ch));
      await w.close();
    }
    const langNote = project.target === '1.21' ? await mergeLangFile(questsDir) : '';

    project.exportedChapterIds = project.chapters.map(c => c.id);
    if (currentFileName) await saveProject(true);
    alert(`🚀 Exported ${wanted.size} chapter(s).${langNote}\n\nIn game: run /ftbquests reload (needs op), or restart the world.`);
  } catch (e) {
    console.error(e);
    alert('Export failed: ' + e.message);
  }
}

// FTB Quests for 1.21 keeps titles/descriptions in lang/en_us.snbt and only takes the text in the
// chapter file the first time it sees a quest. Update our entries there so edits made here show up.
async function mergeLangFile(questsDir) {
  let langDir, text;
  try {
    langDir = await questsDir.getDirectoryHandle('lang');
    text = await readText(langDir, 'en_us.snbt');
  } catch { return ''; } // no lang file: the game will build it from the chapter files
  let lang;
  try { lang = SNBT.parse(text); } catch (e) { return `\n\n⚠️ Couldn't read lang/en_us.snbt (${e.message}) — it was left unchanged.`; }
  const keys = Object.keys(lang);
  if (keys.length && !keys.some(k => /^(chapter|quest|task|reward)\.[0-9A-F]{16}\./.test(k))) return '';

  const raws = SNBT.rawOf(lang), out = {};
  keys.forEach(k => { out[k] = SNBT.raw(raws[k]); });
  const set = (k, v) => { if (v === '' || (Array.isArray(v) && !v.join('').trim())) delete out[k]; else out[k] = v; };
  project.chapters.forEach(ch => {
    set(`chapter.${ch.id}.title`, ch.title);
    set(`chapter.${ch.id}.chapter_subtitle`, ch.subtitle.trim() ? textLines(ch.subtitle) : '');
    ch.quests.forEach(q => {
      set(`quest.${q.id}.title`, q.title);
      set(`quest.${q.id}.quest_subtitle`, q.subtitle);
      set(`quest.${q.id}.quest_desc`, q.description.trim() ? textLines(q.description) : '');
    });
  });
  const w = await (await langDir.getFileHandle('en_us.snbt')).createWritable();
  await w.write(SNBT.write(out));
  await w.close();
  return '\nUpdated quest text in lang/en_us.snbt.';
}

async function importFromGame() {
  const picked = await pickGameFolder('Import');
  if (!picked) return;
  const questsDir = await resolveQuestsDir(picked, false);
  if (!questsDir) { if (questsDir === null) alert(`No FTB Quests data found in "${picked.name}".`); return; }
  let chaptersDir;
  try { chaptersDir = await questsDir.getDirectoryHandle('chapters'); } catch { alert('That quests folder has no "chapters" folder yet.'); return; }

  let lang = {};
  try { lang = SNBT.parse(await readText(await questsDir.getDirectoryHandle('lang'), 'en_us.snbt')); } catch { /* pre-1.21 or none */ }

  const taken = allIds(), chs = [], failed = [];
  for await (const entry of chaptersDir.values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.snbt')) continue;
    try { chs.push(chapterFromSnbt(SNBT.parse(await (await entry.getFile()).text()), lang, taken)); }
    catch (e) { failed.push(`${entry.name}: ${e.message}`); }
  }
  if (!chs.length) { alert('No chapter files could be read.' + (failed.length ? '\n\n' + failed.join('\n') : '')); return; }
  const replacing = chs.filter(c => project.chapters.some(p => p.id === c.id)).length;
  if (!confirm(`Import ${chs.length} chapter(s)${replacing ? ` (${replacing} will replace chapters already here)` : ''}?${failed.length ? `\n\nSkipped:\n${failed.join('\n')}` : ''}`)) return;
  if (Object.keys(lang).length) project.target = '1.21';
  $('target-select').value = project.target;
  mergeChapters(chs);
}

async function importSnbtFiles(files) {
  const taken = allIds(), chs = [], failed = [];
  for (const f of files) {
    try { chs.push(chapterFromSnbt(SNBT.parse(await f.text()), {}, taken)); }
    catch (e) { failed.push(`${f.name}: ${e.message}`); }
  }
  if (failed.length) alert('Could not read:\n' + failed.join('\n'));
  if (chs.length) mergeChapters(chs);
}

function downloadText(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ===================== BOSS PROJECT → QUESTS ===================== */
async function openBossImport() {
  if (!activeChapter()) { alert('Create a chapter first.'); return; }
  const sel = $('boss-file');
  sel.innerHTML = '';
  try {
    const root = await dbGet('root_folder_handle');
    const dir = root && (await root.queryPermission({ mode: 'readwrite' })) === 'granted' ? await subDir(root, 'bosses', false) : null;
    if (dir) {
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) sel.add(new Option(entry.name, entry.name));
      }
    }
  } catch (e) { console.error(e); }
  if (!sel.options.length) { alert('No boss projects found. Open this tool from the hub with your master folder connected, and create a boss project first.'); return; }
  $('boss-modal').classList.add('open');
}

async function runBossImport() {
  const ch = activeChapter();
  const ns = slug($('boss-ns').value) || 'minecraft';
  let data;
  try {
    const root = await dbGet('root_folder_handle');
    const dir = await subDir(root, 'bosses', false);
    data = JSON.parse(await readText(dir, $('boss-file').value));
  } catch (e) { alert('Could not read that boss project: ' + e.message); return; }
  const nodes = data.nodes || [];
  if (!nodes.length) { alert('That boss project has no bosses.'); return; }

  const diffShape = { easy: 'circle', medium: 'square', hard: 'hexagon', legendary: 'gear' };
  const diffLabel = Object.fromEntries((data.difficulties || []).map(d => [d.key, d.label]));
  const minX = Math.min(...nodes.map(n => n.x || 0)), minY = Math.min(...nodes.map(n => n.y || 0));
  const offsetX = ch.quests.length ? Math.max(...ch.quests.map(q => q.x)) + 2 : 0;
  const taken = allIds(), map = {};
  let guessed = 0;
  nodes.forEach(n => {
    const q = newQuest(snapHalf((n.x - minX) / 110) + offsetX, snapHalf((n.y - minY) / 110), n.name || 'Boss');
    q.id = newId(taken);
    q.subtitle = diffLabel[n.difficulty] || '';
    q.shape = diffShape[n.difficulty] || '';
    const desc = [];
    if (n.notes) desc.push(n.notes);
    if (n.loot) desc.push('', '&6Loot:&r ' + n.loot);
    q.description = desc.join('\n');
    const entity = RES_RE.test(n.entityId || '') ? n.entityId : `${ns}:${slug(n.name) || 'boss'}`;
    if (entity !== n.entityId) guessed++;
    q.tasks.push({ id: newId(taken), type: 'kill', entity, value: 1, extra: {} });
    map[n.id] = q;
    ch.quests.push(q);
  });
  (data.edges || []).forEach(e => { if (map[e.from] && map[e.to]) map[e.to].dependencies.push(map[e.from].id); });
  $('boss-modal').classList.remove('open');
  selectedQuestId = null;
  renderAll(true);
  toast(guessed ? `⚔️ Added ${nodes.length} boss quest(s) — ${guessed} entity id(s) were guessed, check them`
                : `⚔️ Added ${nodes.length} boss quest(s) with their in-game ids`);
}

/* ===================== EVENTS ===================== */
function wireEvents() {
  document.addEventListener('click', onActionClick);
  $('panel-body').addEventListener('input', onPanelInput);
  $('panel-body').addEventListener('change', onPanelInput);
  $('target-select').addEventListener('change', e => { project.target = e.target.value; renderPanel(); });
  $('snbt-input').addEventListener('change', e => { importSnbtFiles([...e.target.files]); e.target.value = ''; });
  document.querySelectorAll('.ptab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  const wrap = $('canvas-wrap');
  wrap.addEventListener('mousedown', onCanvasMouseDown);
  wrap.addEventListener('dblclick', e => {
    if (e.target.closest('.quest-node, #zoom-ctl')) return;
    const p = screenToUnits(e.clientX, e.clientY);
    addQuestAt(p.x, p.y);
  });
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  window.addEventListener('resize', applyTransform);
  document.addEventListener('keydown', onKey);
}

function onCanvasMouseDown(e) {
  if (e.button !== 0 || e.target.closest('#zoom-ctl')) return;
  const port = e.target.closest('.q-port');
  const node = e.target.closest('.quest-node');
  const edge = e.target.closest('.edge, .edge-hit');
  if (edge) { e.stopPropagation(); selectEdge(edge.dataset.from, edge.dataset.to); return; }

  if (port && node) { startLinkDrag(e, node.dataset.id); return; }

  if (node) {
    const id = node.dataset.id, q = findQuest(id).quest;
    const sx = e.clientX, sy = e.clientY, ox = q.x, oy = q.y;
    let moved = false;
    const mm = ev => {
      const dx = (ev.clientX - sx) / zoom / UNIT, dy = (ev.clientY - sy) / zoom / UNIT;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      q.x = ev.altKey ? +(ox + dx).toFixed(2) : snapHalf(ox + dx);
      q.y = ev.altKey ? +(oy + dy).toFixed(2) : snapHalf(oy + dy);
      renderQuestNode(q);
      renderEdges();
    };
    const mu = ev => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      if (moved) { if (selectedQuestId === id) renderPanel(); return; }
      if (linkMode) {
        if (!linkSource) { linkSource = id; renderQuestNode(q); }
        else { const from = linkSource; linkSource = null; toggleDependency(from, id); }
      } else if (ev.shiftKey && selectedQuestId && selectedQuestId !== id) {
        toggleDependency(selectedQuestId, id);
      } else selectQuest(id);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return;
  }

  // Empty canvas: pan, or deselect on a plain click.
  const sx = e.clientX, sy = e.clientY, px = panX, py = panY;
  let moved = false;
  $('canvas-wrap').classList.add('panning');
  const mm = ev => {
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true;
    panX = px + ev.clientX - sx; panY = py + ev.clientY - sy;
    applyTransform();
  };
  const mu = () => {
    $('canvas-wrap').classList.remove('panning');
    window.removeEventListener('mousemove', mm);
    window.removeEventListener('mouseup', mu);
    if (!moved && (selectedQuestId || selectedEdge || linkSource)) {
      selectedQuestId = null; selectedEdge = null; linkSource = null;
      activeChapter()?.quests.forEach(renderQuestNode);
      renderEdges(); renderPanel();
    }
  };
  window.addEventListener('mousemove', mm);
  window.addEventListener('mouseup', mu);
}

function startLinkDrag(e, fromId) {
  e.stopPropagation();
  e.preventDefault();
  const from = findQuest(fromId).quest, line = $('drag-line');
  line.setAttribute('x1', from.x * UNIT); line.setAttribute('y1', from.y * UNIT);
  line.setAttribute('x2', from.x * UNIT); line.setAttribute('y2', from.y * UNIT);
  line.setAttribute('display', 'block');
  const mm = ev => {
    const p = screenToUnits(ev.clientX, ev.clientY);
    line.setAttribute('x2', p.x * UNIT); line.setAttribute('y2', p.y * UNIT);
  };
  const mu = ev => {
    line.setAttribute('display', 'none');
    window.removeEventListener('mousemove', mm);
    window.removeEventListener('mouseup', mu);
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.quest-node');
    if (target && target.dataset.id !== fromId) toggleDependency(fromId, target.dataset.id);
  };
  window.addEventListener('mousemove', mm);
  window.addEventListener('mouseup', mu);
}

function onKey(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
  if (typing) return;
  if (e.key === 'Escape') { setLinkMode(false); selectedQuestId = null; selectedEdge = null; renderCanvas(); renderPanel(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedQuestId) { e.preventDefault(); deleteQuest(selectedQuestId); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge) { e.preventDefault(); toggleDependency(selectedEdge.from, selectedEdge.to); selectedEdge = null; renderEdges(); renderPanel(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedQuestId) { e.preventDefault(); duplicateQuest(selectedQuestId); }
}

function onPanelInput(e) {
  const el = e.target;
  // Text inputs update on 'input'; checkboxes/selects on 'change'. Skip the duplicate event.
  const isToggle = el.type === 'checkbox' || el.tagName === 'SELECT';
  if ((e.type === 'change') !== isToggle) return;
  if (el.id && el.id.startsWith('add-')) return;

  const kind = el.dataset.kind;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (kind === 'num') v = Number(v) || 0;
  if (kind === 'int' || kind === 'long') v = Math.max(0, Math.trunc(Number(v) || 0));
  if (kind === 'res' || kind === 'item') {
    v = String(v).trim();
    el.classList.toggle('bad', !(el.dataset.optional && !v) && !resValid(v, el.dataset.tag));
  }

  if (el.dataset.ch) {
    const ch = activeChapter();
    if (el.dataset.ch === 'filename') v = slug(v);
    ch[el.dataset.ch] = v;
    if (el.dataset.ch === 'title' || el.dataset.ch === 'filename') renderSidebar();
    if (el.dataset.ch === 'defaultShape') ch.quests.forEach(renderQuestNode);
    if (el.dataset.ch === 'defaultHideDependencyLines') renderEdges();
  } else if (el.dataset.q) {
    const q = findQuest(selectedQuestId)?.quest;
    if (!q) return;
    if (el.dataset.q === 'size') v = Math.max(0.25, v);
    q[el.dataset.q] = v;
    renderQuestNode(q);
    if (['x', 'y', 'size', 'hideDependencyLines'].includes(el.dataset.q)) renderEdges();
  } else if (el.dataset.list) {
    const q = findQuest(selectedQuestId)?.quest;
    const entry = q?.[el.dataset.list]?.[Number(el.dataset.idx)];
    if (!entry) return;
    if (kind === 'ivec3') {
      const arr = [...(entry[el.dataset.f] || [0, 0, 0])];
      arr[Number(el.dataset.sub)] = Math.trunc(Number(el.value) || 0);
      entry[el.dataset.f] = arr;
    } else entry[el.dataset.f] = v;
  }
  updateProblemCount();
}

async function onActionClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const q = selectedQuestId ? findQuest(selectedQuestId)?.quest : null;

  switch (a) {
    case 'hub': window.location.href = 'index.html'; break;
    case 'save': saveProject(); break;
    case 'connect': setLinkMode(!linkMode); break;
    case 'add-quest': {
      const ch = activeChapter();
      const maxX = ch && ch.quests.length ? Math.max(...ch.quests.map(q => q.x)) + 1.5 : 0;
      addQuestAt(maxX, 0);
      break;
    }
    case 'add-chapter': {
      const title = prompt('Chapter title:', 'New Chapter');
      if (!title) return;
      const ch = newChapter(title.trim());
      project.chapters.push(ch);
      pickChapter(ch.id);
      break;
    }
    case 'pick-chapter': if (!e.target.closest('.ch-btn')) pickChapter(el.dataset.id); break;
    case 'chapter-up': case 'chapter-down': {
      const i = Number(el.dataset.idx), j = i + (a === 'chapter-up' ? -1 : 1);
      if (j < 0 || j >= project.chapters.length) return;
      [project.chapters[i], project.chapters[j]] = [project.chapters[j], project.chapters[i]];
      renderSidebar();
      break;
    }
    case 'chapter-delete': {
      const ch = project.chapters[Number(el.dataset.idx)];
      if (!confirm(`Delete chapter "${ch.title || ch.filename}" and its ${ch.quests.length} quest(s)?`)) return;
      const gone = new Set(ch.quests.map(q => q.id));
      project.chapters.splice(Number(el.dataset.idx), 1);
      project.chapters.forEach(c => c.quests.forEach(q => { q.dependencies = q.dependencies.filter(d => !gone.has(d)); }));
      if (activeChapterId === ch.id) activeChapterId = project.chapters[0]?.id || null;
      selectedQuestId = null;
      renderAll(true);
      break;
    }
    case 'zoom-in': zoomAt(1.2, $('canvas-wrap').clientWidth / 2, $('canvas-wrap').clientHeight / 2); break;
    case 'zoom-out': zoomAt(1 / 1.2, $('canvas-wrap').clientWidth / 2, $('canvas-wrap').clientHeight / 2); break;
    case 'zoom-fit': fitView(); break;

    case 'add-entry': {
      if (!q) return;
      const list = el.dataset.list, set = list === 'tasks' ? TASK_TYPES : REWARD_TYPES;
      q[list].push(newEntry($(`add-${list}-type`).value, set));
      renderQuestNode(q); renderPanel();
      break;
    }
    case 'delete-entry': if (q) { q[el.dataset.list].splice(Number(el.dataset.idx), 1); renderQuestNode(q); renderPanel(); } break;
    case 'move-entry': {
      if (!q) return;
      const list = q[el.dataset.list], i = Number(el.dataset.idx), j = i + Number(el.dataset.dir);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      renderQuestNode(q); renderPanel();
      break;
    }
    case 'clear-itemraw': if (q) { delete q[el.dataset.list][Number(el.dataset.idx)].itemRaw; renderPanel(); } break;
    case 'add-dep': if (q) toggleDependency($('add-dep-select').value, q.id); break;
    case 'remove-dep': if (q) toggleDependency(el.dataset.id, q.id); break;
    case 'delete-edge': if (selectedEdge) { toggleDependency(selectedEdge.from, selectedEdge.to); selectedEdge = null; renderEdges(); renderPanel(); } break;
    case 'delete-quest': if (q && confirm(`Delete quest "${q.title || '(untitled)'}"?`)) deleteQuest(q.id); break;
    case 'duplicate-quest': if (q) duplicateQuest(q.id); break;

    case 'copy-snbt': {
      const ch = activeChapter();
      try { await navigator.clipboard.writeText(chapterToSnbt(ch)); toast('📋 Copied ' + ch.filename + '.snbt'); }
      catch { alert('Clipboard blocked by the browser — use Download instead.'); }
      break;
    }
    case 'download-snbt': { const ch = activeChapter(); downloadText(ch.filename + '.snbt', chapterToSnbt(ch)); break; }
    case 'goto-problem': {
      if (el.dataset.ch && el.dataset.ch !== activeChapterId) pickChapter(el.dataset.ch);
      if (el.dataset.qid) selectQuest(el.dataset.qid);
      else { selectedQuestId = null; setTab('inspector'); }
      break;
    }
    case 'import-snbt': $('snbt-input').click(); break;
    case 'import-game': importFromGame(); break;
    case 'export-game': exportToGame(); break;
    case 'import-bosses': openBossImport(); break;
    case 'run-boss-import': runBossImport(); break;
    case 'close-modal': el.closest('.modal-overlay').classList.remove('open'); break;
  }
}
