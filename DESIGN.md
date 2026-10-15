---
name: Luma OS
description: Un bureau web calme et lumineux, modelé par l’aurore LUMA.
colors:
  accent-violet: "#6d5ee8"
  desktop-midnight: "#0d1532"
  desktop-ink: "#f7f7ff"
  light-surface-acrylic: "rgba(250, 249, 255, .94)"
  light-surface-solid: "#faf9ff"
  light-surface-muted: "#f0eef8"
  light-surface-raised: "#ffffff"
  light-ink: "#17182a"
  light-ink-muted: "#626478"
  light-line: "rgba(35, 37, 64, .1)"
  light-taskbar-acrylic: "rgba(237, 238, 255, .76)"
  light-taskbar-ink: "#16182b"
  dark-surface-acrylic: "rgba(17, 26, 55, .95)"
  dark-surface-solid: "#111a37"
  dark-surface-muted: "#1a2548"
  dark-surface-raised: "#202d55"
  dark-ink: "#f5f6ff"
  dark-ink-muted: "#b9c2dd"
  dark-line: "rgba(230, 235, 255, .12)"
  dark-taskbar-acrylic: "rgba(12, 20, 44, .78)"
  luma-surface-acrylic: "rgba(11, 27, 64, .93)"
  luma-surface-solid: "#0d214a"
  luma-surface-muted: "#162f60"
  luma-surface-raised: "#1b3970"
  luma-ink: "#f6f8ff"
  luma-ink-muted: "#c1cff0"
  luma-line: "rgba(193, 217, 255, .14)"
  luma-taskbar-acrylic: "rgba(13, 26, 59, .72)"
  luma-taskbar-ink: "#f7f8ff"
typography:
  display:
    fontFamily: "Luma Sans, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Luma Sans, sans-serif"
    fontSize: "clamp(25px, 3vw, 34px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Luma Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Luma Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Luma Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  control-compact: "7px"
  control: "9px"
  control-comfortable: "11px"
  surface: "12px"
  window: "15px"
  panel: "18px"
spacing:
  hairline: "3px"
  compact: "4px"
  control: "8px"
  cluster: "10px"
  section: "16px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-violet}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #6d5ee8, white 9%)"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
  search-field:
    backgroundColor: "{colors.luma-surface-muted}"
    textColor: "{colors.luma-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  window:
    backgroundColor: "{colors.luma-surface-acrylic}"
    textColor: "{colors.luma-ink}"
    rounded: "{rounded.window}"
---

# Design System: Luma OS

## Overview

**Creative North Star: "Le bureau sous l’aurore"**

LUMA Fluent transforme le bureau en champ de lumière nocturne : une aurore bleu-violet traverse des couches d’acrylique marine et révèle des plans de travail précis. Le système reste familier dans sa structure, mais son papier lumineux, ses coutures actives et ses icônes linéaires originales lui donnent une présence propre.

La densité est compacte sans être austère. Les fenêtres, commandes et applications partagent une même géométrie dans les thèmes Clair, Sombre et Luma ; la matière et le contraste changent, jamais l’organisation ni le comportement. Cette documentation canonise exclusivement l’expérience desktop LUMA Fluent. Nothing OS n’est pas une référence de ce système et reste réservé à une éventuelle direction mobile future.

**Key Characteristics:**

- Aurore bleu nuit visible comme scène persistante du bureau.
- Surfaces translucides aux teintes chaudes ou marine selon le thème.
- Accent violet rare, consacré au focus, à la sélection et à l’action primaire.
- Typographie Open Sans compacte, nette et légèrement resserrée dans les titres.
- Icônes originales en traits fins, avec états de fenêtre explicites.
- Une même architecture pour la superposition, le focus et le snap.

## Colors

La palette associe une scène nocturne stable, trois familles de surfaces sémantiques et un accent violet commun qui conserve la continuité entre les thèmes.

### Primary

- **Violet d’aurore** (`accent-violet`): signale l’action principale, le focus, la sélection, les indicateurs actifs et la progression.

### Secondary

- **Minuit du bureau** (`desktop-midnight`): forme le fond de secours sous le papier peint auroral et ancre la profondeur du bureau.

### Neutral

- **Nuage clair** (`light-surface-*`): famille de surfaces chaudes du thème Clair, de l’acrylique de fenêtre jusqu’au plan élevé.
- **Nuit feutrée** (`dark-surface-*`): famille marine neutre du thème Sombre, accompagnée de ses encres et coutures dédiées.
- **Profondeur LUMA** (`luma-surface-*`): famille bleu profond signature du thème Luma, avec une progression nette entre plan principal, plan atténué et plan élevé.
- **Encres et coutures** (`*-ink`, `*-ink-muted`, `*-line`): les libellés principaux, secondaires et séparateurs changent avec le thème pour préserver le contraste.
- **Acrylique de tâche** (`*-taskbar-*`): matériau plus translucide réservé à la barre des tâches flottante.

### Named Rules

**The Aurora Signal Rule.** Le violet d’aurore indique une intention ou un état ; il ne remplit pas les grandes surfaces de contenu.

**The Theme Geometry Rule.** Clair, Sombre et Luma changent la matière et les encres, jamais la géométrie, la hiérarchie ou la signification des états.

## Typography

**Display Font:** Luma Sans (Open Sans, puis sans-serif)
**Body Font:** Luma Sans (Open Sans, puis sans-serif)

**Character:** Une seule famille humaniste assure la continuité du bureau aux applications. Les grands titres sont courts, semi-gras et légèrement resserrés ; les données, aides et commandes descendent par petits paliers réguliers plutôt que par contrastes théâtraux.

### Hierarchy

- **Display** (`typography.display`): identité de session et moments d’entrée rares.
- **Headline** (`typography.headline`): titre principal d’une application ou d’un panneau de premier niveau.
- **Title** (`typography.title`): sections, dialogues et états vides.
- **Body** (`typography.body`): descriptions, statuts, données et texte d’interface courant.
- **Label** (`typography.label`): métadonnées, compteurs, dates et commandes compactes ; la casse naturelle française est conservée.

### Named Rules

**The One Sans Rule.** Toute l’interface desktop utilise Luma Sans ; la hiérarchie vient de la taille, du poids et du rythme, pas d’une seconde famille décorative.

**The Compact Data Rule.** Les petites tailles servent aux données secondaires et restent accompagnées d’un contraste, d’un espacement et d’un libellé suffisants.

## Layout

Le bureau occupe tout le viewport et réserve une zone inférieure à la barre des tâches. Une fenêtre normale s’ouvre dans un canevas libre avec une barre de titre de 46 px ; elle peut se superposer, se maximiser avec un retrait de 8 px, ou occuper une moitié par snap avec une couture centrale de 8 px. La barre des tâches mesure 52 px, flotte à 10 px du bord inférieur et reste centrée.

Les applications utilisent un rail latéral fixe et un plan de contenu fluide : Paramètres emploie un rail de 248 px, Documents un rail et un panneau de détails de 210 px. Leur contenu réagit à la largeur de la fenêtre par container queries : les détails disparaissent avant le rail, les barres d’outils se replient, puis la recherche prend une ligne complète. Sous 720 px de viewport, les fenêtres deviennent pratiquement maximisées et la barre des tâches se compacte ; cette adaptation reste LUMA Fluent desktop, pas une direction mobile Nothing OS.

Le rythme repose sur les pas réellement répétés du frontmatter : micro-écarts de 3–4 px, commandes de 8–10 px, sections de 16 px et panneaux de 24 px. Les cibles interactives courantes mesurent 36–46 px de haut, avec 40 px comme cadence fréquente.

### Named Rules

**The Three States Rule.** Superposition, focus et snap sont trois états réversibles d’une même fenêtre, jamais trois compositions indépendantes.

**The Working Plane Rule.** Le plan de contenu s’adapte avant de compresser les commandes essentielles : masquer les détails secondaires, puis le rail, puis empiler la recherche.

## Elevation & Depth

Le système est hybride : la profondeur vient d’abord des couches tonales et de l’acrylique flouté, puis d’ombres ambiantes réservées aux fenêtres, panneaux flottants, dialogues, toasts et icônes d’application. Une fenêtre active reçoit une ombre légèrement plus ample ; les séparateurs restent fins et translucides.

### Shadow Vocabulary

- **Fenêtre ambiante** (`0 22px 70px rgba(13, 18, 46, .24), 0 3px 12px rgba(13, 18, 46, .12)`): élévation normale d’une fenêtre acrylique.
- **Fenêtre active** (`0 26px 76px rgba(4, 8, 30, .32), 0 3px 14px rgba(4, 8, 30, .16)`): renforce exclusivement le plan de travail focalisé.
- **Panneau flottant** (`0 18px 54px rgba(13, 18, 46, .25), 0 2px 8px rgba(13, 18, 46, .12)`): menu principal, dialogue et toast.
- **Barre des tâches** (`0 16px 38px rgba(4, 8, 30, .28), 0 2px 8px rgba(4, 8, 30, .12)`): détache l’acrylique persistant du papier peint.

### Named Rules

**The Acrylic Before Shadow Rule.** La hiérarchie commence par la teinte, la transparence et le flou ; l’ombre confirme seulement un plan réellement flottant.

## Shapes

Les contrôles compacts emploient des courbes de 7–11 px, les cartes et raccourcis 12–13 px, les fenêtres et dialogues 15 px, et les panneaux flottants jusqu’à 18 px. Les avatars et choix de couleur sont circulaires. Les bordures sont des coutures translucides d’un pixel ; les icônes utilisent des traits arrondis de 1,7 px et des silhouettes simples.

Une fenêtre maximisée réduit sa courbe de 15 à 12 px pour mieux épouser le viewport. Les surfaces ne prennent pas de coins durs et les rayons ne changent pas selon le thème.

### Named Rules

**The Nested Curve Rule.** Un enfant interactif garde un rayon inférieur à son conteneur ; les 15–18 px appartiennent aux grands plans, les 7–11 px aux commandes.

**The Original Line Rule.** Les pictogrammes desktop sont des SVG linéaires originaux, compacts et cohérents ; aucun logo propriétaire ni police d’icônes ne remplace ce vocabulaire.

## Components

### Buttons

- **Shape:** commandes compactes à courbe douce (`rounded.control`) et hauteur de 36–43 px selon le contexte.
- **Primary:** fond Violet d’aurore, texte blanc, poids semi-gras et padding horizontal de 14–20 px.
- **Hover / Focus:** éclaircissement léger du violet ; focus visible de 3 px mélangé avec du blanc et décalé de 2 px.
- **Secondary / Ghost:** surface transparente au repos, puis surface atténuée au survol ; les actions destructives utilisent un rouge dédié seulement quand leur conséquence est explicite.

### Chips

- **Style:** les contrôles segmentés reposent sur une surface atténuée à 10 px de rayon ; chaque choix mesure au moins 32 px de haut avec une courbe intérieure de 7 px.
- **State:** le choix sélectionné passe sur la surface élevée, avec texte principal et petite ombre interne au plan.

### Cards / Containers

- **Corner Style:** 12–13 px pour cartes, options de thème et tuiles de document ; 15–18 px pour fenêtres et panneaux majeurs.
- **Background:** surface atténuée pour une option, surface élevée pour un état choisi ou un panneau au-dessus du contenu.
- **Shadow Strategy:** aucune ombre de carte par défaut ; utiliser la hiérarchie tonale et se référer à Elevation & Depth pour les plans flottants.
- **Border:** couture d’un pixel seulement pour séparer des régions ou confirmer une sélection.
- **Internal Padding:** 10–16 px pour les éléments répétitifs, 22–24 px pour les panneaux isolés.

### Inputs / Fields

- **Style:** champ sans bordure sur surface atténuée, rayon de 9–11 px et hauteur de 36–42 px ; les dialogues ajoutent une couture d’un pixel.
- **Focus:** le focus global reste visible sans modifier la géométrie du champ.
- **Error / Disabled:** les contrôles désactivés baissent en opacité et perdent le curseur d’action ; les erreurs restent textuelles et localisées.

### Navigation

Le rail emploie des lignes de 39–40 px, des icônes de 18 px et des rayons de 9–10 px. Le survol ajoute un voile d’encre léger ; l’élément courant mélange l’accent dans la surface élevée. Sur une fenêtre étroite, le rail disparaît au profit du contenu principal plutôt que de devenir une navigation Nothing OS.

### Window Frame

La fenêtre a une barre de titre de 46 px, une courbe de 15 px, une matière acrylique et trois commandes de 46 px. Le focus amplifie l’ombre ; réduire conserve l’application dans la barre des tâches, maximiser et snap préservent les bornes précédentes, et fermer retire fenêtre et tâche.

### Taskbar

La barre des tâches est un dock acrylique centré de 52 px. Les applications actives reçoivent une couture violette de 3 px, les applications réduites restent visibles avec une opacité moindre, et le lanceur garde la signature Luma. Les libellés d’application disparaissent à largeur étroite avant les icônes.

## Do's and Don'ts

### Do:

- **Do** faire porter au Violet d’aurore le focus, la sélection, la progression et l’action primaire.
- **Do** conserver les mêmes rayons, dimensions et états entre Clair, Sombre et Luma.
- **Do** préserver les trois états réversibles des fenêtres et la récupération des fenêtres réduites depuis la barre des tâches.
- **Do** réduire le mouvement à `.01ms` quand la préférence système ou Luma demande un mouvement réduit.
- **Do** adapter d’abord les plans secondaires et les libellés avant de réduire les cibles essentielles.

### Don't:

- **Don't** étendre l’accent violet en grand aplat décoratif sans signification d’état.
- **Don't** ajouter une ombre à chaque carte ; réserver l’élévation aux plans qui flottent réellement.
- **Don't** copier les logos, icônes exactes ou actifs propriétaires des systèmes de bureau de référence.
- **Don't** introduire de motifs Nothing OS dans LUMA Fluent desktop ; cette piste n’est pas canonisée et reste réservée à une future exploration mobile.
- **Don't** casser les libellés français nets avec des kickers, sourcils décoratifs ou capitales systématiques.
