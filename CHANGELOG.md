# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage sémantique.

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
