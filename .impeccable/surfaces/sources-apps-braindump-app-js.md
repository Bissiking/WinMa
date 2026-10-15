---
version: 1
slug: "sources-apps-braindump-app-js"
primary_target: "sources/apps/braindump/app.js"
related_targets: ["sources/apps/braindump/style.css"]
---

# BrainDump capture workspace

## Scope

**Mode:** Operate

BrainDump is an application surface inside LUMA Fluent, not a replacement visual world. It inherits the desktop themes, Luma Sans, surface variables, compact control geometry, window behavior, and accessibility commitments from `DESIGN.md`. This brief owns only BrainDump's capture workflow, split workspace, and local semantic color.

## Direction contract

**THESIS:** BrainDump transforme une pensée brute en information rangée sans détour par un tableau de notes générique.

**OWN-WORLD:** Surfaces LUMA calmes, feuille de capture centrale et rail d’historique compact.

**STORY:** Écrire, vérifier ce que BrainDump comprend, enregistrer, puis retrouver ou supprimer.

**FIRST VIEWPORT:** Grand champ de capture à gauche, classification directement sous le texte et notes récentes dans le rail droit.

**FORM:** Espace de capture focalisé avec historique latéral, structure 4, seed `2c77f92f`.

## Visual extension

- **Vert de classement** (`--brain-green`, `#43ad87`) is local to BrainDump. It marks capture focus, analysis, save actions, and the app identity; it does not replace the global Violet d’aurore elsewhere in Luma OS.
- The app continues to use the current theme's shared `--ink`, `--ink-muted`, `--line`, and `--surface-*` tokens so Clair, Sombre, and Luma retain identical geometry and behavior.
- The logo is a compact green gradient tile with the existing original line icon. The main writing field is the only raised paper-like plane; history remains quieter and denser.
- Classification chips use restrained functional colors for task, idea, bug, reminder, and information. These colors communicate categories and are not decorative palette additions.

**The One Capture Signal Rule.** Green belongs to BrainDump's act of capturing and understanding. Keep large content surfaces in the active LUMA theme and avoid green decorative fills.

## Layout and behavior

- The application header keeps identity and synchronization status visible above the workspace.
- At wide window sizes, the capture plane leads at roughly two-thirds of the width and the recent-notes rail occupies the remainder, never below 300 px.
- Analysis appears directly below the text field and preserves the user's content until that content changes. Save clears the capture plane, refreshes history, and restores focus to writing.
- At 760 px container width, capture and history stack vertically. At 520 px, the shortcut hint yields, heading metadata stacks, and the two actions share the available row.
- Empty, loading, offline, error, filtered-empty, and populated history states remain part of the same composition rather than opening secondary panels.

## Interaction and accessibility guardrails

- Preserve the `Ctrl`/`Cmd` + `Enter` save path, immediate character count, visible focus treatment, live synchronization status, and localized error announcement.
- Keep Analyze secondary to Ranger la pensée. Destructive deletion always requires confirmation.
- Reveal note deletion on hover and keyboard focus; keep it permanently visible for coarse pointers.
- Coarse-pointer filters and icon buttons use 44 px targets. Reduced-motion mode collapses transitions to `.01ms`.
- Maintain the French, direct, reassuring copy. BrainDump organizes what the user writes; it does not claim intelligence or certainty beyond the displayed analysis confidence.

## Acceptance bar

- The capture field is the strongest element in the first viewport, with analysis and primary save action in the same working plane.
- Recent notes remain scannable without competing with writing, and filters never hide access to the full collection.
- All three LUMA Fluent themes preserve hierarchy, focus visibility, and category legibility.
- Narrow layouts retain the complete write, analyze, save, retrieve, filter, refresh, and delete workflow.
