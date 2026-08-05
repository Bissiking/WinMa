# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Luma OS est d'abord un projet personnel expérimental, créé pour le plaisir de concevoir et d'utiliser un environnement de bureau web. Il n'a pas, à ce stade, d'audience métier ou commerciale confirmée.

## Product Purpose

Luma OS centralise l'accès aux applications et services de l'écosystème LUMA dans une interface inspirée d'un système d'exploitation de bureau. Le projet sert aussi de terrain d'expérimentation pour le multi-fenêtrage, la personnalisation et l'intégration des services LUMA.

## Positioning

Luma OS réunit des services LUMA dans un bureau web modulaire possédant sa propre identité, sans chercher à reproduire exactement Windows ni à devenir un système d'exploitation natif.

## Operating Context

Le produit s'utilise principalement dans un navigateur sur ordinateur, avec un fonctionnement utilisable sur tablette et mobile. L'identité et l'accès aux applications sont délégués à Kyros. Les applications peuvent être internes, intégrées par iframe, ouvertes à l'extérieur ou fournies par le système Luma OS.

## Capabilities and Constraints

- Stack conservée : Node.js, Express, HTML, CSS et JavaScript ; jQuery reste autorisé pour le code hérité.
- Fonctions à préserver et consolider : écran de session, bureau, raccourcis, barre des tâches, menu principal, fenêtres multiples, horloge, paramètres et applications intégrées.
- L'authentification cible utilise le SSO Kyros par code d'autorisation.
- Le mot de passe Kyros n'est jamais collecté par Luma OS.
- Les secrets applicatifs et tokens sensibles restent exclusivement côté serveur.
- Les URLs externes et la configuration Kyros viennent de l'environnement ou d'un registre validé.
- La première version des paramètres gère le fond d'écran, le thème et la couleur d'accentuation.
- Paramètres expose Système, Personnalisation, Réseau Luma local et Compte.
- L’identité Kyros reste en lecture seule dans Luma OS ; un profil Luma local conserve le nom préféré, la langue, le fuseau et les consentements de synchronisation.
- Les modules internes peuvent lire un contexte utilisateur partagé limité aux catégories explicitement autorisées.
- Le gestionnaire de fenêtres prend en charge réduction, maximisation, restauration et fermeture ; une fenêtre réduite reste accessible depuis la barre des tâches.
- Documents permet de créer des dossiers, importer, télécharger, renommer, déplacer, rechercher et sélectionner plusieurs éléments.
- Chaque utilisateur Kyros dispose d'un quota Documents de 1 Go.
- Les fichiers sont stockés hors de la base de données ; SQLite conserve les métadonnées en développement et PostgreSQL est la cible de production.
- La Corbeille permet la restauration et la suppression définitive, avec purge automatique après 30 jours.
- Les opérations sensibles sur les futurs services LUMA seront exclusivement réalisées par le backend.
- Le nom technique du dépôt reste provisoirement `WinMa`; le nom public confirmé est `Luma OS`.
- L'identifiant client, le secret client et le callback de l'application Luma OS doivent encore être créés ou confirmés dans l'administration Kyros.

## Brand Commitments

- Nom public : Luma OS.
- Appartenance explicite à l'écosystème LUMA.
- Conserver la métaphore du bureau web tout en évitant une copie exacte de Windows 11.
- Paramètres reprend la familiarité et la structure de Windows 11, traduites dans une interprétation visuelle LUMA originale.
- La direction desktop choisie est `LUMA Fluent` : Paramètres Windows 11 et Explorateur Windows 11 servent de références de structure et de niveau de finition, sans reprendre leurs logos ou actifs propriétaires.
- Nothing OS est conservé comme référence possible pour une future expérience mobile, hors de la refonte desktop actuelle.
- Les actifs LUMA présents dans `sources/images/` restent disponibles pendant la migration, sans obligation confirmée de tous les conserver dans l'identité finale.

## Evidence on Hand

- Prototype fonctionnel dans `index.html`, `app.js` et `sources/`.
- Fonds d'écran, icônes et logo existants dans `sources/images/`.
- Contrat d'authentification et recommandations Kyros dans `API.md`.
- Audit et architecture de migration dans `docs/`.
- Aucune preuve commerciale, tarification, clientèle ou exigence de production à revendiquer.

## Product Principles

1. Préserver le plaisir et l'exploration qui motivent le projet.
2. Rendre le bureau compréhensible et agréable avant d'ajouter de nombreuses fonctions.
3. Centraliser les comportements complexes dans des modules explicites et testables.
4. Déléguer l'identité à Kyros et minimiser les données conservées par Luma OS.
5. Faire évoluer le prototype par incréments fonctionnels et réversibles.

## Accessibility & Inclusion

L'interface doit rester utilisable au clavier, à la souris et au tactile, respecter la réduction des animations et viser un contraste conforme à WCAG 2.2 AA.
