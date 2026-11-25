// Tests du module "foyer" à deux déclarants (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');

const cfg = require('../config.js');
const Calculs = require('../calculs.js');

const CONFIG = cfg.getConfig(2026);

const declarant = (over = {}) => ({
  transport: 'voiture',
  repasType: 'classique',
  mutuelle: 'entreprise_fiche',
  f: {},
  ...over
});

// --- Équivalence avec l'API historique (un seul déclarant) ---

test('computeFoyer solo = compute legacy (mêmes résultats)', () => {
  const f = {
    salaire: '45000', nombre_parts: '1',
    jours_ouvres: '220', jours_teletravail: '20',
    dist_aller: '22', cv: '5', energie: 'thermique',
    nb_repas_classique: '200', cout_repas_classique: '12'
  };
  const legacy = Calculs.compute({
    year: 2026, transport: 'voiture', repasType: 'classique',
    mutuelle: 'entreprise_fiche', situation: 'celibataire', f
  }, CONFIG);
  const foyer = Calculs.computeFoyer({
    situation: 'celibataire', nombreParts: '1', active: 'd1',
    d1: { transport: 'voiture', repasType: 'classique', mutuelle: 'entreprise_fiche', f }
  }, CONFIG);
  assert.equal(foyer.couple, false);
  assert.equal(foyer.salaireFoyer, legacy.salaire);
  assert.equal(foyer.abattementFoyer, legacy.abattement10Pct);
  assert.equal(foyer.declarants.d1.totalFraisBruts, legacy.totalFraisBruts);
  assert.equal(foyer.declarants.d1.totalFraisNets, legacy.totalFraisNets);
  assert.equal(foyer.revenuNetImposable, legacy.revenuNetImposable);
  assert.equal(foyer.impot.impotBrut, legacy.impot.impotBrut);
  assert.equal(foyer.impot.impotNet, legacy.impot.impotNet);
  assert.equal(foyer.declaration.case1AK, legacy.declaration.case1AK);
  assert.equal(foyer.declaration.case2AJ, null);
});

// --- Abattement 10 % par déclarant ---

test('couple : abattement 10 % calculé PAR DÉCLARANT (40 000 + 30 000 => 4 000 + 3 000)', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2', active: 'd1',
    d1: declarant({ f: { salaire: '40000' } }),
    d2: declarant({ f: { salaire: '30000' } })
  }, CONFIG);
  assert.equal(res.couple, true);
  assert.equal(res.declarants.d1.abattement10Pct, 4000);
  assert.equal(res.declarants.d2.abattement10Pct, 3000);
  assert.equal(res.abattementFoyer, 7000);
  assert.equal(res.salaireFoyer, 70000);
  assert.equal(res.nombreParts, 2);
  assert.equal(res.declaration.case1AJ, 40000);
  assert.equal(res.declaration.case2AJ, 30000);
});

test('couple : plafond de l\'abattement par déclarant (2 x 200 000 => 2 x 14 555)', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2',
    d1: declarant({ f: { salaire: '200000' } }),
    d2: declarant({ f: { salaire: '200000' } })
  }, CONFIG);
  assert.equal(res.declarants.d1.abattement10Pct, 14555);
  assert.equal(res.declarants.d2.abattement10Pct, 14555);
  assert.equal(res.abattementFoyer, 29110);
});

test('couple : conjoint sans revenu => aucun abattement forfaitaire pour lui', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2',
    d1: declarant({ f: { salaire: '40000' } }),
    d2: declarant()
  }, CONFIG);
  assert.equal(res.declarants.d2.abattement10Pct, 0);
  assert.equal(res.declarants.d2.deductionRetenue, 0);
  assert.equal(res.abattementFoyer, 4000);
  assert.equal(res.revenuNetImposable, 40000 - 4000);
});

// --- Choix forfait / frais réels fait déclarant par déclarant ---

test('couple : d1 en frais réels, d2 au forfait 10 % => déduction mixte', () => {
  const f1 = {
    salaire: '45000', jours_ouvres: '220', dist_aller: '22', cv: '5', energie: 'thermique',
    nb_repas_classique: '200', cout_repas_classique: '12'
  };
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2',
    d1: declarant({ f: f1 }),
    d2: declarant({ f: { salaire: '30000' } })
  }, CONFIG);
  const d1 = res.declarants.d1, d2 = res.declarants.d2;
  assert.ok(d1.totalFraisNets > 4500);
  assert.equal(d1.deductionRetenue, d1.totalFraisNets);
  assert.equal(d2.deductionRetenue, 3000);
  assert.equal(res.deductionFraisFoyer, d1.totalFraisNets + 3000);
  assert.equal(res.revenuNetImposable, 75000 - (d1.totalFraisNets + 3000));
  assert.ok(res.gainFoyer > 0);
  assert.equal(res.impot.baseParts, 2);
  assert.equal(d1.verdict.kind, 'good');
  assert.equal(d2.verdict.kind, 'bad');
});

// --- Cases de la 2042 par déclarant ---

test('couple : cases 1AJ/2AJ, 1AK/1BK, remboursements 1GB-1JB / 2GB-2JB, mutuelle 6DD/6DE', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2',
    d1: declarant({ mutuelle: 'entreprise_6dd', f: { salaire: '40000', mutuelle_6dd: '600', jours_ouvres: '220', dist_aller: '22', cv: '5', energie: 'thermique', remb_ik: '500' } }),
    d2: declarant({ mutuelle: 'entreprise_6dd', f: { salaire: '30000', mutuelle_6dd: '400', remb_autres: '100' } })
  }, CONFIG);
  assert.equal(res.declaration.case1AK, res.declarants.d1.totalFraisBruts);
  assert.equal(res.declaration.case1BK, res.declarants.d2.totalFraisBruts);
  assert.equal(res.declaration.remboursements1GB1JB, 500);
  assert.equal(res.declaration.remboursements2GB2JB, 100);
  assert.equal(res.declaration.mutuelle6DD, 600);
  assert.equal(res.declaration.mutuelle6DE, 400);
  assert.equal(res.declarants.d1.cases.salaire, '1AJ');
  assert.equal(res.declarants.d1.cases.fraisReels, '1AK');
  assert.equal(res.declarants.d1.cases.remboursements, '1GB-1JB');
  assert.equal(res.declarants.d1.cases.mutuelle, '6DD');
  assert.equal(res.declarants.d2.cases.salaire, '2AJ');
  assert.equal(res.declarants.d2.cases.fraisReels, '1BK');
  assert.equal(res.declarants.d2.cases.remboursements, '2GB-2JB');
  assert.equal(res.declarants.d2.cases.mutuelle, '6DE');
  // RNI du foyer = salaires - déduction frais (max par déclarant) - 6DD/6DE
  assert.equal(res.deduction6DDFoyer, 1000);
  const dedFrais = Math.max(res.declarants.d1.totalFraisNets, 4000) + 3000;
  assert.equal(res.deductionFraisFoyer, dedFrais);
  assert.equal(res.revenuNetImposable, 70000 - dedFrais - 1000);
});

// --- Divers ---

test('couple : avertissements préfixés par déclarant', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2',
    d1: declarant({ f: { salaire: '40000' } }),
    d2: declarant({ f: { salaire: '30000', jours_ouvres: '220', dist_aller: '60', cv: '5', energie: 'thermique' } })
  }, CONFIG);
  assert.ok(res.warnings.some(w => w.text.startsWith('Déclarant 2') && w.text.includes('40 km')));
  assert.ok(!res.warnings.some(w => w.text.startsWith('Déclarant 1')));
});

test('couple : nombre de parts par défaut = 2 si le champ est vide', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple',
    d1: declarant({ f: { salaire: '40000' } }),
    d2: declarant({ f: { salaire: '30000' } })
  }, CONFIG);
  assert.equal(res.nombreParts, 2);
});

test('célibataire : le déclarant 2 est ignoré même s\'il est rempli', () => {
  const res = Calculs.computeFoyer({
    situation: 'celibataire', nombreParts: '1',
    d1: declarant({ f: { salaire: '40000' } }),
    d2: declarant({ f: { salaire: '99999' } })
  }, CONFIG);
  assert.equal(res.couple, false);
  assert.equal(res.salaireFoyer, 40000);
  assert.equal(res.declaration.case2AJ, null);
  assert.equal(res.declaration.case1BK, null);
});

test('foyer : impôt calculé sur le revenu global avec décote couple', () => {
  const res = Calculs.computeFoyer({
    situation: 'couple', nombreParts: '2',
    d1: declarant({ f: { salaire: '40000' } }),
    d2: declarant({ f: { salaire: '30000' } })
  }, CONFIG);
  // RNI = 70 000 - 7 000 = 63 000, 2 parts => 31 500/part
  const attendu = Calculs.calculImpot(63000, 2, 'couple', CONFIG);
  assert.ok(Math.abs(res.impot.impotBrut - attendu.impotBrut) < 0.01);
  assert.ok(Math.abs(res.impot.decote - attendu.decote) < 0.01);
});
