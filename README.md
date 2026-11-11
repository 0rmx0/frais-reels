# Calculateur Frais Réels — Impôts France 🇫🇷

Simulateur **100 % client-side** pour comparer les **frais réels** et l'**abattement forfaitaire de 10 %** sur ta déclaration de revenus en France (formulaire 2042).

👉 **[Ouvrir le calculateur](https://0rmx0.github.io/frais-reels/)** (GitHub Pages)

> ⚠️ **Avertissement** : c'est un simulateur indicatif, qui ne remplace ni la brochure pratique de la DGFiP, ni un conseil fiscal personnalisé. Vérifie toujours les barèmes en vigueur sur [impots.gouv.fr](https://www.impots.gouv.fr).

## Fonctionnalités

- **Transport** : barème kilométrique officiel à 3 tranches (voiture, moto > 50 cm³, cyclomoteur ≤ 50 cm³), majoration +20 % véhicule 100 % électrique, **règle des 40 km aller** (avec case « circonstances particulières »), péages / stationnement / intérêts d'emprunt ajoutés au barème, transports en commun, vélo.
- **Repas** : forfait repas au foyer, **plafond de dépense de 21,10 €/repas**, tickets restaurant (part employeur exonérée ≤ 7,32 € et entre 50–60 % de la valeur), mode mixte.
- **Télétravail** : forfait 2,70 €/jour plafonné à 626,40 €/an (désactivé si allocation employeur exonérée), formation, documentation, autres frais.
- **Remboursements employeur** soustraits (seul le net est déductible), avec alerte si IK > barème fiscal.
- **Mutuelle** : entreprise (fiche de paie / case 6DD), Madelin (TNS), individuelle (non déductible).
- **Impôt** : barème progressif par part, **plafonnement du quotient familial**, **décote**, **CEHR** → impôt brut *et* impôt net estimé.
- **Années** : barèmes 2026 (officiels) et 2027 (provisoires, publiés au printemps 2027).
- **Avertissements contextuels** (40 km, plafonds dépassés, IK excédentaires…).
- **Vie privée** : aucune donnée ne quitte ton navigateur. Sauvegarde automatique en `localStorage`, **lien partageable** (`?s=…`), export/import JSON, exports **TXT / JSON / CSV**, impression de la fiche récapitulative.
- **PWA** : installable et utilisable hors-ligne. Mode sombre automatique. Accessible clavier (WCAG 2.1 AA visé).

## Utilisation

Ouvre `index.html` dans un navigateur, ou sers le dossier statiquement :

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Aucune dépendance, aucun build : HTML + CSS + JavaScript vanilla.

## Développement

```bash
node --check config.js calculs.js app.js sw.js   # vérification syntaxique
node --test                                       # tests unitaires + smoke test (node:test)
```

### Structure

| Fichier | Rôle |
|---|---|
| `config.js` | Barèmes fiscaux par année (source de vérité), exportable en Node |
| `calculs.js` | Module de calcul **pur** (sans DOM) : `Calculs.compute(state, config)` |
| `app.js` | Couche DOM : état, rendu, exports, partage, service worker |
| `index.html` | Page + styles (clair/sombre/impression) |
| `tests/` | Tests `node:test` (calculs + smoke test DOM stub) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | PWA (hors-ligne) |

## Sources officielles

- [impots.gouv.fr — barème kilométrique](https://www.impots.gouv.fr/simulateur-bareme-kilometrique)
- [impots.gouv.fr — frais de repas](https://www.impots.gouv.fr/particulier/frais-de-repas)
- [impots.gouv.fr — tickets restaurant et frais réels](https://www.impots.gouv.fr/particulier/questions/je-beneficie-de-tickets-restaurants-comment-calculer-mes-frais-reels-de)
- [service-public.fr — barèmes kilométriques 2026](https://www.service-public.gouv.fr/particuliers/actualites/A14686)
- [BOFiP](https://bofip.impots.gouv.fr) — BOI-RSA-BASE-30-50-30, art. 197 et 223 sexies du CGI
- Loi de finances n° 2026-103 du 19 février 2026 (barème IR 2026)

## Feuille de route

- Comparaison côte à côte (déclarant 1 vs 2, ou année 2026 vs 2027)
- Import CSV d'un relevé de tickets restaurant
- Graphiques SVG (répartition des frais, courbe impôt/revenu)
- Historique des barèmes 2024–2025

## Licence

[MIT](LICENSE) — © 0rmx0
