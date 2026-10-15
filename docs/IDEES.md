# LUMA OS Web — Idées de fonctionnalités priorisées

> Backlog R&D vivant · Révision : 15 octobre 2026  
> **Ordre : du plus utile au moins utile** pour transformer WinMa en bureau web hybride (productivité + administration + applications LUMA).  
> Les estimations d'effort sont indicatives. Les numéros ci-dessous sont **nouveaux** ; les références `ancien #` renvoient à la liste d'origine.

## P0 — Fondations et fiabilité (à traiter avant les nouveautés)

- [ ] **01. Sauvegarde, export et restauration des données personnelles** · *Moyen* · **Fusion anciens #22 et #23**  
  Exporter paramètres, événements, notes et disposition du bureau ; import contrôlé, réinitialisation ciblée et documentation de restauration. Les sauvegardes serveur PostgreSQL sont un sujet distinct (infra, cf. `docs/DATABASE.md`).

## P1 — Fonctionnalités qui rendent LUMA OS utile au quotidien

- [ ] **02. Espaces de travail persistants et nommés** · *Moyen à élevé* · **Nouveau**  
  Bureaux « Personnel », « Développement », « Administration » ; sauvegarde de la disposition, fenêtres, applications et espace actif par utilisateur. Reprise sur un autre appareil avec adaptation à sa résolution.
- [ ] **03. Recherche globale unifiée** · *Moyen à élevé* · **Ancien #28**  
  Rechercher applications, fichiers Documents, notes, événements et paramètres depuis une interface commune. Résultats filtrés par droits d'accès.
- [ ] **04. Centre de notifications et contrôle rapide** · *Moyen à élevé* · **Fusion anciens #18, #26 et #31**  
  Historique, notifications par application, actions, ne pas déranger, durée/sons des alertes et panneau de réglages rapides. Distinguer notification persistante et toast éphémère.
- [ ] **05. Aperçus Documents : PDF, Markdown et HTML** · *Moyen* · **Fusion anciens #1 et #13**  
  Lire les PDF (zoom, pages, impression), prévisualiser Markdown et HTML sans téléchargement. Isoler/sanitiser le HTML non fiable ; réutiliser le rendu Markdown existant.
- [ ] **06. Associations de fichiers et « Ouvrir avec »** · *Moyen* · **Nouveau**  
  Définir les applications compatibles par type MIME/extension : image → visionneuse, `.md` → Notes, `.pdf` → PDF, musique → lecteur. S'appuyer sur le registre d'applications.
- [ ] **07. Glisser-déposer et ouverture entre applications internes** · *Moyen* · **Ancien #36, cadré**  
  Documents → Notes / Images / Lecteur / Paramètres. Réutiliser les capacités déjà présentes sans modifier les backends d'applications externes.
- [ ] **08. Barre de commandes (« palette d'actions »)** · *Moyen* · **Ancien #38, clarifié**  
  `Ctrl/Cmd+Shift+P` pour ouvrir une application, naviguer, changer de thème ou déclencher une action confirmée. Pas de commande vocale dans la première version.
- [ ] **09. Agenda enrichi avec données serveur** · *Moyen à élevé* · **Ancien #6**  
  Événements persistants multi-appareils, vues semaine/liste, rappels et récurrence. Conserver et migrer prudemment les événements actuels du navigateur.
- [ ] **10. Notes LUMA enrichies** · *Moyen* · **Ancien #7**  
  Recherche, dossiers, épingles, tâches à cocher et conservation côté serveur. Éviter le chevauchement fonctionnel avec BrainDump.
- [ ] **11. Permissions par application** · *Élevé* · **Nouveau**  
  Autoriser/révoquer l'accès aux fichiers, notifications et informations de profil. Permissions côté backend pour toute action sensible, en complément de Kyros. Compléter l'état « autorisée » du registre.
- [ ] **12. Communication interapplications générique** · *Élevé* · **Nouveau, infrastructure uniquement**  
  Définir un contrat « ouvrir / envoyer / recevoir » avec détection des capacités, consentement et contrôle de permissions. Aucune intégration Narra dans ce lot.
- [ ] **13. Accessibilité renforcée** · *Moyen, continu* · **Ancien #24**  
  Navigation clavier, contraste élevé, réduction des mouvements, tailles de police/curseur et prise en charge des technologies d'assistance. Critère transversal pour chaque livraison.

## P2 — Bureau avancé et intégrations LUMA

- [ ] **14. Terminal SSH distant sécurisé** · *Élevé* · **Nouveau**  
  Ajouter des connexions SSH via backend contrôlé sans transformer le terminal simulé en shell serveur ouvert ; hôtes autorisés, permissions, audit et fermeture automatique des sessions.
- [ ] **15. Emplacements Documents distants** · *Élevé* · **Nouveau**  
  Connecteurs SFTP, WebDAV ou stockage objet selon les besoins. Interface unique pour les fichiers locaux/distants, secrets exclusivement côté serveur.
- [ ] **16. Console de supervision LUMA / Argos** · *Élevé* · **Nouveau**  
  Vue consolidée des machines, services et alertes. Commencer en lecture seule ; confirmer explicitement toute action d'administration.
- [ ] **17. LUMA Orbit : installation et gestion réelles des apps** · *Élevé* · **Nouveau, prolongement du registre d'applications**  
  Applications disponibles/activées/installées, permissions, désactivation et informations de compatibilité — synchroniser le catalogue Orbit avec `data/apps.json` au lieu du catalogue codé en dur. Distinguer intégrations externes et applications natives.
- [ ] **18. Historique d'activités et diagnostics** · *Moyen* · **Nouveau**  
  Événements utiles : échecs d'intégration, connexions d'applications, synchronisations et erreurs système, avec politique de rétention et confidentialité.
- [ ] **19. Raccourcis clavier personnalisables** · *Moyen* · **Ancien #37**  
  Centraliser les raccourcis existants, gérer les conflits et permettre leur modification.
- [ ] **20. Barre des tâches personnalisable** · *Moyen* · **Ancien #17**  
  Position, taille, masquage, centrage, regroupement et comportement des fenêtres. Unifier l'épinglage (`luma.taskbar.pinned`) avec le champ `pinned` du registre.
- [ ] **21. Personnalisation visuelle avancée** · *Moyen* · **Ancien #16, partiel**  
  Fond de verrouillage indépendant, opacité des fenêtres, arrondi, taille de texte, contraste élevé et ajout de `luma-aurora.webp` à la galerie si encore absent.
- [ ] **22. Interface multilingue et régionale** · *Élevé* · **Ancien #19**  
  Internationaliser shell et applications, exploiter la langue et le fuseau déjà stockés côté serveur.
- [ ] **23. Mode hors ligne contrôlé (PWA)** · *Moyen à élevé* · **Ancien #35, enrichi**  
  Définir explicitement les fonctions disponibles sans réseau, cache chiffrable si nécessaire, synchronisation et gestion des conflits ; ne pas contourner Kyros.
- [ ] **24. Synchronisation multi-onglets** · *Élevé* · **Ancien #25, priorité réduite**  
  Synchroniser les changements pertinents de session/bureau entre onglets, sans nécessairement dupliquer en temps réel toutes les fenêtres. Le verrouillage et la déconnexion sont déjà propagés (`BroadcastChannel` « luma.session »).
- [ ] **25. Presse-papiers interapplications** · *Moyen* · **Ancien #27, recadré**  
  Historique interne LUMA et transfert de contenus entre apps ; accès au presse-papiers système seulement sur geste explicite et selon permissions navigateur.
- [ ] **26. Widgets du bureau** · *Moyen* · **Ancien #29**  
  Horloge, prochain événement, note épinglée et indicateur de service ; placement libre et rafraîchissement mesuré.
- [ ] **27. Photo de profil personnalisée** · *Faible à moyen* · **Ancien #21**  
  Avatar local ou hébergé par LUMA, sans écraser les données d'identité Kyros.
- [ ] **28. Contacts / Annuaire LUMA** · *Faible à moyen* · **Ancien #15**  
  Carnet simple, idéalement synchronisé côté serveur, avec futur partage maîtrisé aux apps autorisées.
- [ ] **29. Photos LUMA : galerie** · *Moyen* · **Ancien #2**  
  Albums, diaporama, EXIF, favoris et outils légers au-delà de la visionneuse actuelle.
- [ ] **30. Audio/vidéo : volume indépendant** · *Faible à moyen* · **Ancien #47**  
  Séparer les préférences `music-player` et `video-player` sans régression des valeurs existantes.

## P3 — Options agréables, mais non structurantes

- [ ] **31. Météo et fond dynamique** · *Moyen* · **Ancien #5**  
  Widget météo et ambiance visuelle ; données externes transitant par un service autorisé.
- [ ] **32. Actualités / RSS** · *Moyen* · **Ancien #11**  
  Agrégateur RSS, favoris et « à lire plus tard » ; aucun impact sur le socle du bureau.
- [ ] **33. Dictionnaire / traduction** · *Faible à moyen* · **Ancien #12**  
  Petit utilitaire indépendant ou intégration à un service existant.
- [ ] **34. Thèmes complets et packs d'icônes** · *Moyen* · **Ancien #34**  
  Variations du shell, packs d'icônes et réglages avancés de surfaces.
- [ ] **35. Bibliothèque musicale autonome** · *Moyen à élevé* · **Ancien #3, à réévaluer**  
  À envisager seulement si elle apporte quelque chose que l'intégration Harmonix ne couvre pas ; éviter le doublon.
- [ ] **36. Expérimentation multi-écrans** · *Élevé* · **Ancien #30**  
  Recherche autour des API d'écrans navigateur et des fenêtres détachées ; compatibilité variable selon navigateur.
- [ ] **37. Easter eggs LUMA** · *Faible* · **Ancien #49**  
  Commandes cachées du Terminal, fonds secrets et surprises discrètes. Jamais bloquant pour la roadmap.

## P4 — En attente de dépendances externes (ne pas lancer maintenant)

- [ ] **38. Documents → « Envoyer vers Narra »** · *Élevé, interprojets* · **Nouvelle idée, reportée**  
  Concept : clic droit → Envoyer vers → Narra → liste de projets → destination/import. **Bloqué volontairement** : nécessite de nouvelles API de découverte des projets, droits et import côté Narra, plus un sélecteur de projets côté LUMA. Ne pas développer de « clone fantôme » de Narra simplement pour ce transfert. À réexaminer seulement lorsqu'une API de réception naturelle existera côté Narra.
- [ ] **39. Autres envois vers apps externes à contexte** · *Variable* · **Nouveau, reporté**  
  Même logique que Narra : ne pas fabriquer de mini-clients d'autres produits dans LUMA OS sans bénéfice concret et API stable.

---

## Règles de gestion de cette liste

1. **Dès qu'une idée est entièrement implémentée, testée et validée, la supprimer de cette liste.** Cette liste ne contient que les travaux restant à faire.
2. Si une idée est **partiellement réalisée**, la conserver en reformulant uniquement les éléments manquants. Ne pas la cocher comme terminée.
3. Si une idée est **abandonnée**, la supprimer ; si elle dépend d'un autre projet ou d'une décision future, la déplacer dans **P4 — En attente**.
4. Lorsqu'une fonctionnalité est terminée, inscrire sa réalisation dans `docs/CHANGELOG.md` ou dans le suivi des versions avant de la retirer du backlog, afin de ne pas perdre l'historique.
5. **Ne pas dupliquer une fonctionnalité existant déjà dans Harmonix, Narra, Kyros, Argos ou un autre service LUMA**, sauf si LUMA OS apporte un usage distinct clairement identifié.
6. **Ne pas modifier le backend d'un autre projet uniquement pour ajouter un confort mineur à LUMA OS.**
7. Réévaluer le classement après chaque livraison majeure : l'utilité réelle prime sur l'effet visuel et la facilité de développement.

> **NOTE IMPORTANTE : QUAND UNE IDÉE EST IMPLÉMENTÉE ET VALIDÉE, LA SUPPRIMER DE CE DOCUMENT.** Ne pas laisser d'éléments cochés `[x]` dans ce backlog : l'historique des fonctionnalités livrées appartient au changelog, pas à cette liste.

> Versionné le package.json à chaque modification faite
