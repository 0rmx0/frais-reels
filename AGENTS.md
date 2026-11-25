# AGENTS.md — règles du projet

Calculateur **100 % client-side** de frais réels (formulaire 2042, France). HTML + CSS + JavaScript vanilla : aucune dépendance, aucun build, aucune donnée envoyée sur le réseau.

## Règle cardinale : intransigeant sur la justesse des calculs et la conformité aux textes de loi

Un simulateur fiscal inexact est pire qu'aucun simulateur. Cette exigence prime sur la vélocité, la taille du diff ou l'élégance du code.

- **Tout barème, seuil, plafond, taux, case de déclaration ou règle métier doit être traçable à un texte officiel** : impots.gouv.fr, BOFiP (BOI-RSA-BASE-30-50-30…, BOI-IR-LIQ…), service-public.fr, loi de finances, arrêtés. Cite la source dans le commentaire de section du code, dans le CHANGELOG et dans la PR.
- **Ne jamais inventer, extrapoler ni « arrondir » une valeur fiscale.** En cas de doute, consulter le texte officiel avant d'écrire la moindre ligne ; si la source n'est pas certaine, marquer la valeur `provisoire: true` (ex : barème 2027) et le signaler dans l'UI, les exports et le CHANGELOG.
- **Au moins un test par barème avec un exemple publié par l'administration** (ex : barème km voiture 5 CV, 4 000 km = 2 544 € ; décote, CEHR…). Un calcul sans test n'est pas terminé.
- **Cases de la 2042 exactes** : salaires 1AJ/2AJ, totaux des frais réels **par déclarant** 1AK/1BK, remboursements à réintégrer 1GB-1JB / 2GB-2JB, mutuelle 6DD/6DE (2042 C). Le détail des frais relève de l'état détaillé des frais réels, pas de ces cases. Une erreur de case est un **bug bloquant** (cf. CHANGELOG 2.1.1).
- **Avertissement visible plutôt que calcul muet** : règle des 40 km, IK supérieures au barème fiscal, plafond de dépense par repas, titres-restaurant (part employeur 50–60 % et ≤ 7,32 €), forfait télétravail plafonné, CEHR/CDHR… Tout dépassement ou incohérence de saisie doit produire un avertissement affiché.
- **Conformité légale de l'interface** : mention « simulation indicative — ne remplace pas un conseil fiscal » conservée partout (UI, exports, footer) ; sources officielles listées ; confidentialité maintenue (100 % local, `localStorage` uniquement, et avertissement conservé sur le lien de partage `?s=` qui embarque les saisies en clair dans l'URL).

## Architecture

| Fichier | Rôle |
|---|---|
| `config.js` | Barèmes fiscaux par année (source de vérité) + `VERSION`. UMD : utilisable navigateur et Node |
| `calculs.js` | Module de calcul **pur, sans DOM** : `Calculs.computeFoyer(state, config)` (foyer à 1 ou 2 déclarants) et `Calculs.compute(state, config)` (API historique, un seul déclarant) |
| `app.js` | Couche DOM uniquement : état, rendu, exports, partage, service worker. **Aucun calcul fiscal ici** |
| `index.html` | Page + styles (clair/sombre/impression). CSP `script-src 'self'` : **aucun gestionnaire inline** (`onclick="…"`), tout passe par `addEventListener` dans `app.js` |
| `tests/` | `node:test` : tests purs (`calculs.test.js`, `foyer.test.js`) + smoke test DOM stub via `vm` (`app.smoke.test.js`) |
| `sw.js` | PWA hors-ligne ; **bump le nom du cache à chaque changement d'assets** |

État persisté : `{ year, situation, nombreParts, active, d1, d2 }` (un bloc par déclarant). La migration des états v1 (lien `?s=`, localStorage) est gérée par `migrateState()` dans `app.js` — ne pas la casser.

## Commandes

```bash
node --check config.js calculs.js app.js sw.js   # vérification syntaxique
node --test                                       # tests unitaires + smoke test (identique à la CI)
python3 -m http.server 8000                       # test manuel local → http://localhost:8000
```

## Conventions de travail

- **Tests d'abord** (RED → GREEN) pour tout changement de comportement ou correction ; aucun test sauté, aucune assertion affaiblie.
- **Commits conventionnels** (`feat:` / `fix:` / `docs:` / `chore:` / `test:`) avec le « pourquoi » dans le corps ; un commit = une unité logique.
- **CHANGELOG à jour dans le même changement** (Keep a Changelog, en français, par impact utilisateur) ; bump `VERSION` (semver) et le cache `sw.js` dès que l'UI change.
- **Accessibilité WCAG 2.1 AA** : labels explicites, navigation clavier complète, `aria-*`, contrastes suffisants, l'information ne repose jamais sur la seule couleur.
- **PR** : remplir intégralement `.github/PULL_REQUEST_TEMPLATE.md` (checks cochés, test manuel décrit, sources officielles citées si un barème est touché). Branche `vibe/<sujet>-01a6e1`, PR en draft.
- Rester vanilla et hors-ligne : **aucune dépendance ajoutée**.

## Interdictions

- Aucune donnée ne quitte le navigateur (hors polices) ; pas de tracking, pas de télémétrie.
- Pas de `alert` / `confirm` / `prompt` (ligne de statut à la place).
- Pas de secrets dans le dépôt : `git diff --staged -i -G'password|secret|api_key|token' --name-only` avant chaque commit.
- Pas de code commenté laissé en place, pas de TODO longue durée.
