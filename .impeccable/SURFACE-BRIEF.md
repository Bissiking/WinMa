# Luma OS desktop refresh

## Approved visual direction

LUMA Fluent is one coherent desktop system with three supported window states:

- overlapping windows for freeform work (composition A),
- a focused or maximized primary application (composition B),
- snapped side-by-side windows for multitasking (composition C).

The product can switch between `Clair`, `Sombre`, and `Luma` themes. These themes share the same geometry, hierarchy, interaction model, and accessibility contract; only surface material, color, and wallpaper treatment vary.

## Direction contract

The interface should feel calm, luminous, precise, and playful enough for a personal experimental OS. Use a midnight-blue aurora wallpaper, softly translucent taskbar and windows, warm light surfaces, deep navy dark surfaces, violet-blue accent, 14–18 px radii, restrained shadows, crisp French labels, and compact custom line icons. Settings and Documents can borrow the structural familiarity of contemporary desktop settings and file explorers, but must not copy proprietary logos, exact icons, or assets. Nothing OS styling is intentionally excluded from desktop and reserved for later mobile exploration.

### THESIS

Luma OS turns everyday desktop work into a calm field of light: familiar enough to use immediately, distinct enough to feel like a place rather than a web page.

### OWN-WORLD

The world is a midnight aurora reflected through navy acrylic and warm cloud-paper surfaces. Violet and cyan signal state; compact original line icons and softly articulated window seams keep the experience precise. Nothing OS motifs do not enter this desktop world.

### STORY

The first read is the Luma signature and auroral desktop. The second is Documents as the working focal plane. Paramètres supports it from behind or beside it, while the floating taskbar makes every minimized or running application recoverable.

### FIRST VIEWPORT

At desktop width, the aurora, Luma signature, Documents shortcut, Corbeille shortcut, at least one complete working window, and the persistent taskbar are immediately legible. Documents leads when windows overlap; snap mode gives Documents and Paramètres complementary columns. Narrow widths prioritize one maximized application and a compact taskbar.

### FORM

Seed key `c388fc01`. Geometry uses 14–18 px primary radii, 8–12 px control radii, a 46 px titlebar, 52 px floating taskbar, soft offset depth, compact 1.5–1.7 px line icons, and a violet-blue active seam. Composition A supplies overlap, B supplies focus and details, and C supplies snap behavior; all three are states of one system.

## Visible ingredient inventory

- Desktop wallpaper and a small Luma OS signature.
- Desktop shortcuts for Documents and Corbeille.
- Persistent centered taskbar with launcher, pinned/running apps, active/minimized indicators, status controls, clock, and account/session access.
- Start panel with search, pinned apps, user identity, lock, and logout actions.
- Window frame with title/icon, draggable surface, minimize, maximize/restore, close, focus stacking, resize, and snap states.
- Settings application with account card, search, navigation, theme, accent, wallpaper, density/motion preferences, responsive layout, inline saving state, and keyboard focus.
- Documents application with breadcrumb, search, create folder, upload, download, rename, move, multi-select, storage meter, metadata list/grid, details, and trash entry.
- Trash application/state with restore, permanent deletion, empty trash, and 30-day retention copy.
- Toasts, dialogs, empty/loading/error states, and reduced-motion behavior.

## Medium and implementation choices

- Keep semantic HTML, modular CSS, and progressive vanilla JavaScript; no template-engine migration is needed.
- Replace scattered inline handlers and legacy window scripts with modules owned by the desktop shell.
- Use CSS custom properties for shared design tokens and theme switching.
- Use inline SVG symbols for original, consistent UI icons rather than adding an icon package.
- Keep uploaded binaries outside the database. Store document metadata in SQLite during development behind a repository boundary that can later target PostgreSQL.
- Enforce the 1 GiB quota and ownership on the server, not only in the interface.

## Acceptance bar

- A minimized window remains represented in the taskbar and restores from it.
- Maximize and snap are reversible and preserve prior bounds.
- Theme changes apply immediately and persist through the settings API.
- Core controls work with keyboard, mouse, and touch-sized targets.
- Documents V1 covers folders, upload, download, rename, move, search, multi-select, restore, and permanent deletion.
- Trash records expire after 30 days and the server can purge expired content.
- The desktop remains useful at laptop widths and degrades deliberately on narrow screens.
