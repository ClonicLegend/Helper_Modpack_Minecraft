# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Helper_Modpack_Minecraft** — a browser-only helper suite for building Minecraft modpacks. It has no build step, no framework and no backend: plain HTML/CSS/vanilla JS served as static files. All project data is JSON files on the user's disk, read and written via the browser **File System Access API** (`showDirectoryPicker`), so it needs a Chromium-based browser (Chrome/Edge/Brave).

Three tools:

1. **Boss Progression Editor** (`boss_progression.html`) — a node graph canvas. Each node is a "boss" with stats (HP, damage, defense, … — configurable), difficulty tier, loot, notes and image. Edges between nodes express progression order (beat A before B). Has an inspector, a stat chart along the topological order, auto-layout, and JSON import/export.
2. **Minecraft Mod Tracker** (`mod_tracker.html` + `.js` + `.css`) — catalogs mods into categories. Each mod can hold a list of **mobs/bosses with attributes**, so a mod's bosses can be packaged once and pulled into the Boss Progression Editor via its **🤖 Auto-Import Mod Mobs** wizard.
3. **FTB Quests Builder** (`quest_builder.html` + `.js` + `.css`, SNBT reader/writer in `ftbq_snbt.js`) — chapter/quest graph editor that exports FTB Quests `.snbt` chapter files the game loads directly. Can import existing chapters (from files or a game folder) and turn a boss project into kill-quests.

## Running

```bash
./start.sh        # Linux — serves on :5500 and opens the browser
start.bat         # Windows
```

## File map

| File | Role |
|---|---|
| `index.html` + `script.js` + `styles.css` | **Hub**. Connect the "master mod folder", list/create boss projects, open the Mod Tracker, edit shared global attributes. |
| `boss_progression.html` | Boss editor — HTML, CSS and JS all inline in one file (~1000 lines). |
| `mod_tracker.html` / `.js` / `.css` | Mod tracker. |
| `quest_builder.html` / `.js` / `.css` | FTB Quests Builder. |
| `ftbq_snbt.js` | Generic SNBT `parse`/`write` (FTB flavour: `#` comments, optional commas). Keeps each object's raw source per key (`SNBT.rawOf`). |
| `quests/*.json` | FTB Quests Builder project files. |
| `global_attributes.json` | Shared stat schema `[{key, label, default}]` used by both tools. |
| `bosses/*.json` | Boss Progression project files. |
| `mod_tracker.json` | The **single** Mod Tracker data file, at the master folder root. |
| `loot/*.json` | **Legacy** multi-file Mod Tracker profiles. Only read once, to merge into `mod_tracker.json` when that file doesn't exist yet; never written. |

## Architecture & data flow

- **Root folder handle**: the hub stores the user-picked directory handle in IndexedDB (`WorkspaceSuiteDB` → store `settings` → key `root_folder_handle`). The tool pages re-open that same DB to read/write files directly. Each page re-declares its own small `getDB()` / `getWorkspaceDB()` helper — there's no shared JS module.
- **Opening a boss project**: the hub reads the file and navigates to the editor, passing data through `sessionStorage`: `active_project_filename`, `active_project_payload` (raw JSON text), `shared_global_attributes` (the global schema). The hub lists `bosses/` via `switchActiveSuiteModule` (subfolder matched case-insensitively, created if missing).
- **Opening the Mod Tracker** (`openModTracker` in `script.js`): no file list. The hub reads `<root>/mod_tracker.json` into `sessionStorage.mod_tracker_payload`. If the file is missing, it puts any old `loot/*.json` contents into `mod_tracker_legacy_files` instead, and the tracker merges them (`mergeDataset`) and marks them unsaved.
- **Saving**: the boss editor writes `<root>/bosses/<file>`; the tracker writes `<root>/mod_tracker.json`. Both fall back to `localStorage` (`suite_backup_<file>`) if the handle isn't usable.
- **Mod → Boss import** (`importBossesFromMod` … `executeImportSelection` in `boss_progression.html`): reads `mod_tracker.json` → pick a mod → checkboxes of its mobs. Each mob becomes a node: global-attribute defaults first, then the mob's own `attributes` overlay them. Imported nodes get `difficulty: "medium"` and `entityId` (see below).
- **In-game entity ids** flow Mod Tracker → Boss editor → Quests Builder: a mod's `namespace` (e.g. `cataclysm`) + a mob's `entityName` (e.g. `ignis`) = `cataclysm:ignis`, computed by `mobEntityId(mod, mob)` (duplicated in `mod_tracker.js` and `boss_progression.html` — keep them in sync). An `entityName` that already contains `:` is used as-is. Boss nodes store the result as `entityId` (editable in the inspector); the Quests Builder's boss import uses it for the Kill task and only guesses `namespace:slug(name)` when it's missing.

- **FTB Quests export** (`exportToGame` in `quest_builder.js`): user picks the instance folder (or `config/`, `config/ftbquests`, `.../quests`); handle remembered in IndexedDB `settings` → `ftbquests_game_handle`. Writes `quests/chapters/<filename>.snbt` per chapter. Files whose chapter `id` is in `project.exportedChapterIds` but no longer match a current file name are deleted; chapters not created here are never touched (only overwritten after a warning on a file-name clash). For the 1.21 target it also merges titles/descriptions into an existing `lang/en_us.snbt` (FTB 1.21 keeps text there and only reads inline text for new objects). Never writes `data.snbt`.

## JSON formats

**Boss project** (`bosses/*.json`):
```json
{
  "nodes": [{ "id": "n1", "name": "...", "entityId": "modid:entity", "difficulty": "easy", "attrs": { "hp": 200 },
              "image": null, "loot": "", "notes": "", "x": 0, "y": 0 }],
  "edges": [{ "id": "e1", "from": "n1", "to": "n2" }],
  "difficulties": [{ "key": "easy", "label": "Easy", "emoji": "🐢", "color": "#27ae60", "description": "" }],
  "attrDefs": [{ "key": "hp", "label": "HP", "default": 200 }],
  "imageLibrary": { "file.png": "data:image/png;base64,..." }
}
```
Node ids are `n<number>`, edge ids `e<number>`; counters are recomputed from these on load, so keep that format.

**Mod tracker** (`mod_tracker.json`):
```json
{
  "categoryNames": ["mods", "dependencies"],
  "mods": [{ "id": "id_...", "name": "...", "namespace": "modid", "link": "", "image": "", "notes": "",
             "categories": ["mods"],
             "mobs": [{ "id": "id_...", "name": "...", "entityName": "entity", "image": "", "attributes": { "hp": 200 } }] }]
}
```
`loadDataset` also accepts a legacy shape (`{ categories: { name: [mods] } }` or a bare object of arrays). Old hub-created `loot/` files (`{ mods: [], dependencies: [], serverPath: "" }`) go through that path, which is why merged data can contain an empty `serverPath` category.

**FTB Quests Builder project** (`quests/*.json`):
```json
{ "version": 1, "target": "1.21", "exportedChapterIds": ["..."],
  "chapters": [{ "id": "16HEX", "filename": "getting_started", "title": "", "subtitle": "", "icon": "minecraft:book",
                 "group": "", "defaultShape": "", "defaultHideDependencyLines": false, "extra": {},
                 "quests": [{ "id": "16HEX", "title": "", "subtitle": "", "description": "multi\nline", "icon": "",
                              "x": 0, "y": 0, "shape": "", "size": 1, "dependencies": ["16HEX"],
                              "dependencyRequirement": "all_completed", "optional": false, "hideUntilDepsVisible": false,
                              "hideDependencyLines": false, "extra": {},
                              "tasks": [{ "id": "16HEX", "type": "item", "item": "minecraft:oak_log", "count": 16, "extra": {} }],
                              "rewards": [{ "id": "16HEX", "type": "xp", "xp": 100, "extra": {} }] }] }]
}
```
IDs are FTB-style 16-char hex (`newId()`), unique across the project. Task/reward fields are driven by `TASK_TYPES` / `REWARD_TYPES` in `quest_builder.js`; add a type there and both the inspector and export pick it up. `extra` holds SNBT source text of fields the builder doesn't model (from imports) and is written back verbatim; `itemRaw` does the same for items with NBT/components. `target` switches item encoding: `"1.20"` → `item: "id"`, `"1.21"` → `item: { count: 1, id: "id" }`. Quest x/y are FTB grid units (`UNIT` = 60 canvas px; drag snaps to 0.5).

**Attribute keys**: labels are slugified into keys (`toLowerCase().replace(/[^a-z0-9_]/g, '_')`). Renaming a stat in the boss editor migrates the key across all nodes.

## Known quirks / gotchas

- Canonical stat keys are `hp`, `damage`, `defense` (matching `global_attributes.json`). Old projects may still contain `dmg`; the chart's "Power" metric reads `damage` and falls back to `dmg`.
- Attribute schema sources, in priority order for the boss editor: per-file `attrDefs` → `sessionStorage.shared_global_attributes` → hardcoded defaults. Importing mobs adds any unknown attribute keys to `attrDefs`.
- Both editors warn on leaving with unsaved changes (`lastSavedSnapshot` / `markSaved()`); call `markSaved()` after any new successful save path.
- Open IndexedDB **without** a pinned version (`indexedDB.open("WorkspaceSuiteDB")`) — the boss editor can bump the version, and a pinned `1` would then throw `VersionError`.
- Opening a tool page directly (not via the hub) seeds demo bosses / empty state and has no file to save to.
- `esc`/`escapeHtml` escape `& < > " '`; use them for any user text put into `innerHTML`. They do **not** make a value safe inside an inline `onclick="fn('...')"` JS string — prefer `addEventListener` for new code.

## Conventions

- Vanilla JS, global functions wired with inline `onclick=` handlers; UI built as template strings + `innerHTML`.
- Dark theme driven by CSS variables (`--accent`, `--panel`, `--muted`, …).
- No tests, linter or package manager. Verify changes by running the local server and exercising the page in Chromium.
