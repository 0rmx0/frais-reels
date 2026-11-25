# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage sémantique.

## [2.3.0] — 2026-11-25

### Ajouté
- **Mode couple à deux déclarants** (imposition commune) : onglets « Déclarant 1 / Déclarant 2 » dans la section Situation fiscale, visibles quand « Marié·e / pacsé·e » est sélectionné. Chaque déclarant a son propre salaire (cases **1AJ / 2AJ**), ses propres frais réels (totaux en **1AK / 1BK**), ses remboursements (**1GB-1JB / 2GB-2JB**) et sa mutuelle (**6DD / 6DE**).
- **Abattement de 10 % calculé par déclarant** (min 509 € / max 14 555 € chacun, aucun abattement sans revenu) : le choix frais réels vs forfait se fait individuellement, déclarant par déclarant. Corrige le biais où saisir le salaire cumulé du couple comparait les frais à un seul plafond de 14 555 €.
- **Impôt au niveau du foyer** : calcul sur le revenu global (1AJ + 2AJ − déductions retenues − 6DD/6DE) avec quotient familial, décote couple et seuils CEHR couple.
- **Tableau comparatif Déclarant 1 / Déclarant 2** dans le panneau Résultat (salaire, frais bruts/nets, abattement 10 %, déduction retenue, option retenue) + ligne de synthèse foyer ; avertissements préfixés « Déclarant 1/2 » ; étiquette de case salaire dynamique (1AJ / 2AJ).
- **Exports TXT / CSV / JSON** : section « FOYER (imposition commune) » en couple avec toutes les cases par déclarant, le RNI et l'impôt net estimé du foyer.
- **Migration transparente** des états enregistrés (localStorage) et des liens de partage `?s=` de l'ancien format à un seul déclarant vers le nouveau format à deux déclarants.

### Corrigé
- Abattement de 10 % affiché à 509 € même sans salaire saisi : désormais 0 € sans revenu (sans effet sur le RNI, déjà borné à 0).
- Nombre de parts par défaut en situation « couple » avec champ vide : 2 parts (base du couple) au lieu de 1.

## [2.2.0] — 2026-11-25

### Refonte graphique
- **Nouvelle direction visuelle** « blueprint de déclaration » : fond ardoise nuit `#0D1520` avec grille millimétrée, formulaire en cartes papier `#F7F3EA`, panneau résultat en écran de contrôle `#111C2B`, accent ambre `#FFB000` (cases à remplir, CTA unique), tampon « SIMULATION » incliné.
- **Typographie** : Fraunces (titres, éditorial) + Space Grotesk (UI) + IBM Plex Mono (montants, cases, statut) via fonts.bunny.net (CSP mise à jour).
- **Icônes** : tous les emoji remplacés par des icônes vectorielles Lucide inline (sections, actions, exports, avertissements, verdict).
- **Détails** : étiquettes « CASE 1AJ / 6DD » en mono ambre, segmented controls à pilule active, chevrons animés, ligne de statut fixe en bas de page.
- **Dialogues natifs supprimés** : `alert`/`confirm`/`prompt` remplacés par la ligne de statut ; réinitialisation en double clic avec état « Confirmer ? ».
- Nouveau logo `icon.svg` (ardoise + € ambre), `theme-color`/`background_color` du manifest mises à jour, cache service worker `v2.2.0`.
- **Double thème automatique** : sombre ou clair choisi via `prefers-color-scheme` selon les paramètres système — toutes les couleurs passent par des tokens sémantiques, `theme-color` adaptatif (meta `media`), transition douce de 0,25 s au changement de thème.
- **Thème sombre 100 % sombre** : plus aucune surface claire en dark — cartes `#182433`, champs creusés `#0F1826`, texte `#E9EEF5`, pilule de toggle active claire `#F5F1E8`, icônes de section ambre sur `#0A101A`, encadrés NOTE et étiquettes CASE en ambre lisible.
- **Section « 05 · Autres frais professionnels » enrichie selon les textes officiels** (vérifiés en ligne : BOFiP BOI-RSA-BASE-30-50-30-30/-40 et impots.gouv.fr) : **14 champs dédiés** aux frais admissibles avec règle de calcul propre — cotisations syndicales (100 % déductibles en frais réels, exclusif du crédit d'impôt 66 %), ordre professionnel, assurance RC pro, vêtements spécifiques, matériel < 500 € HT (totalité l'année d'achat) vs > 500 € HT (annuité d'amortissement), quote-part tél./internet, double résidence, déménagement pour nouvel emploi, séjour pro à l'étranger, local professionnel, intérêts titres société, représentation, frais de procès (prud'hommes). Une **note liste l'ensemble des frais admissibles** et ceux qui n'en sont pas (garde d'enfants, dons, frais de santé, amendes, vêtements courants → crédits/réductions d'impôt séparés). Postes sommés dans le total, le résumé du panneau Résultat, la persistance localStorage et l'export TXT.

## [2.1.2] — 2026-11-25

### Corrigé (bug bloquant)
- **Aucun bouton ne répondait** : la CSP `script-src 'self'` (ajoutée en 2.1.0) bloquait tous les gestionnaires `onclick` inline du HTML. Tous les boutons (cartes pliantes, toggles transport/repas/mutuelle, menu d'export, imprimer, copier le lien, importer, réinitialiser) sont désormais branchés via `addEventListener` dans `app.js` — la CSP stricte est conservée. Cache service worker incrémenté pour forcer le rechargement des assets corrigés.

## [2.1.1] — 2026-11-25

### Corrigé (justesse fiscale et conformité légale)
- **Cases de la 2042** : les exports indiquaient « 1AK = transport, 1BK = repas, 1CK = autres » — faux. Les cases 1AK/1BK/1CK/1DK servent à reporter le **total des frais réels** par membre du foyer (1AK = déclarant 1) ; le détail relève de l'état détaillé des frais réels. Correction des exports TXT/JSON/CSV.
- **Remboursements employeur** : en cas d'option pour les frais réels, les remboursements exonérés (IK, part titres-restaurant, allocation télétravail) perdent leur exonération et doivent être **réintégrés au revenu (cases 1GB-1JB)** — note ajoutée aux exports.
- **Mutuelle entreprise (case 6DD, 2042 C)** : le montant était affiché mais **non déduit du revenu net imposable** ; c'est une charge déductible, il est désormais retranché du revenu imposable (et du RFR approximé pour la CEHR).
- **Salaire saisi** : l'étiquette « brut annuel, case 1AJ » était trompeuse — la case 1AJ correspond au **salaire net imposable** (fiche de paie, après cotisations), base de l'abattement de 10 %. Libellé corrigé dans l'UI et les exports.
- **Barème kilométrique** : une puissance hors liste (ex. 8 CV) retombait sur la ligne « 3 CV » au lieu de « 7 CV et plus » (dernière ligne du tableau officiel) ; si aucune puissance n'est sélectionnée, le barème n'est plus appliqué silencieusement (montant 0 + avertissement).
- **Avertissements** : alerte si le nombre de repas dépasse les jours ouvrés (1 repas/jour travaillé), et information **CDHR** (art. 224 CGI, taux minimal 20 %, reconduit par la LF 2026) au-delà des seuils de la CEHR.
- **Lien de partage** : padding base64 restauré (robustesse) et avertissement de confidentialité ajouté — les saisies sont embarquées en clair (base64) dans l'URL.

### Vérifié (barèmes 2026 = revenus 2025, sans changement)
- Barème kilométrique gelé depuis l'arrêté du 27/03/2023 (voitures 3-7 CV et plus, motos, cyclomoteurs, majoration +20 % électrique) : conforme au jeu data.gouv.fr « Barème kilométrique fiscal France 2022-2026 » et à service-public.fr.
- Tranches IR 11 600 / 29 579 / 84 577 / 181 917 € (LF 2026, loi n° 2026-103 du 19/02/2026) ; abattement 10 % borné 509-14 555 € ; décote 897/1 483 € − 45,25 % ; plafond du quotient familial 1 807 €/demi-part ; CEHR 3 %/4 % (seuils 250 000/500 000 € et doublés, inchangés).
- Repas : forfait 5,45 €, plafond 21,10 € ; titres-restaurant : part employeur exonérée ≤ 7,32 € (50-60 % de la valeur) ; télétravail : 2,70 €/jour, plafond 626,40 €/an.

## [2.1.0] — 2026-11-04

### Corrigé (justesse fiscale)
- **Barème kilométrique** : passage au barème officiel 2026 à 3 tranches de distance (voiture, moto > 50 cm³, cyclomoteur ≤ 50 cm³) avec part fixe sur la tranche intermédiaire ; les taux précédents (0,681–0,893 €/km) ne correspondaient à aucun barème officiel.
- Suppression du **plafond fictif de 200 €** à ≤ 5 000 km (aucune règle de ce type ; ex. officiel : 4 000 km × 5 CV = 2 544 €).
- **Règle des 40 km aller** implémentée (80 km/jour retenus), avec case « circonstances particulières » ; péages, stationnement et intérêts d'emprunt ajoutables au barème.
- **Repas** : plafond de dépense de 21,10 €/repas appliqué (déduction max 15,65 €/repas).
- **Tickets restaurant** : plafonds corrigés (part employeur exonérée ≤ 7,32 €/titre, entre 50 % et 60 % de la valeur).
- **Abattement 10 % borné** : minimum 509 €, maximum 14 555 € par déclarant.
- **Impôt** : correction du calcul par tranches (la tranche en cours n'était pas prise en compte — ex. 20 000 €/part donnait 0 € au lieu de 924 €) ; ajout du plafonnement du quotient familial (1 807 €/demi-part), de la **décote** (897/1 483 € − 45,25 %) et de la **CEHR** → « impôt net estimé ».
- Tranches IR : l'année 2026 reprend le barème officiel LF 2026 (11 600 / 29 579 / 84 577 / 181 917 €) ; l'année 2027 est marquée **provisoire**.
- Bug mode « mixte » : les tickets seuls ne renvoyaient plus 0 €.
- Noms de fichiers d'export en date ISO (les dates `fr-FR` contenaient des `/`).
- Double calcul à chaque frappe (handlers inline + `addEventListener`) supprimé.
- Revenu net imposable borné à 0 ; logique de calcul dédupliquée entre affichage et export.

### Ajouté
- Module de calcul pur `calculs.js` + **32 tests** (`node --test`) et CI GitHub Actions.
- Sauvegarde auto `localStorage`, **lien partageable** (`?s=…`), import/export JSON de l'état, bouton « Réinitialiser ».
- Forfait télétravail 2,70 €/jour (plafond 626,40 €/an) avec option « allocation employeur ».
- Avertissements contextuels (40 km, plafonds repas/tickets/TT, IK > barème…).
- Situation familiale (décote célibataire vs couple) ; cyclomoteur ; impression de la fiche récapitulative (`@media print`).
- Accessibilité : en-têtes de cartes en boutons avec `aria-expanded`, labels `for`/`id`, focus visible, contrastes renforcés, `prefers-reduced-motion`.
- PWA (manifest + service worker, utilisable hors-ligne), mode sombre, CSP, favicon, meta OG/description.
- `README.md` (avec avertissement légal et sources officielles), `CHANGELOG.md`, templates d'issues/PR, `.gitignore` ; suppression de `index.html.backup`.

## [2.0.0] — version antérieure

Calculateur initial : sections pliantes, tickets restaurant, mutuelle (6DD/Madelin), exports TXT/JSON/CSV.
