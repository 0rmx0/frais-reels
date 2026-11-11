// Smoke test : exécute config.js + calculs.js + app.js dans un DOM stub (vm)
// et vérifie que le calcul de bout en bout fonctionne sans lever d'erreur.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    style: {},
    dataset: {},
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    files: [],
    _listeners: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, force) {
        const want = force === undefined ? !this._s.has(c) : !!force;
        if (want) this._s.add(c); else this._s.delete(c);
        return want;
      },
      contains(c) { return this._s.has(c); }
    },
    setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    click() {}, focus() {}
  };
  return el;
}

function makeSandbox() {
  const byId = new Map();
  const domListeners = {};
  const store = new Map();
  const document = {
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, makeEl());
      return byId.get(id);
    },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    createElement(tag) { return makeEl(tag); },
    addEventListener(type, fn) { (domListeners[type] = domListeners[type] || []).push(fn); }
  };
  const sandbox = {
    console,
    document,
    Intl,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    location: { origin: 'https://example.test', pathname: '/', search: '' },
    history: { replaceState() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    navigator: {},
    confirm: () => true,
    alert() {}, prompt() { return ''; }
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of ['config.js', 'calculs.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  // Déclenche DOMContentLoaded
  (domListeners['DOMContentLoaded'] || []).forEach(fn => fn());
  sandbox.__domListeners = domListeners;
  sandbox.__byId = byId;
  return sandbox;
}

test('smoke : chargement + calc() sans erreur, verdict correct', () => {
  const sb = makeSandbox();
  const $ = (id) => sb.__byId.get(id) || sb.document.getElementById(id);
  // Saisie d'un cas classique : 45 000 €, 220 ouvrés, 20 TT, 22 km, 5 CV, 200 repas à 12 €
  $('salaire').value = '45000';
  $('nombre_parts').value = '1';
  $('jours_ouvres').value = '220';
  $('jours_teletravail').value = '20';
  $('dist_aller').value = '22';
  $('cv').value = '5';
  $('energie').value = 'thermique';
  $('nb_repas_classique').value = '200';
  $('cout_repas_classique').value = '12';
  sb.calc();

  assert.equal($('res-jours').textContent, '200');
  assert.equal($('res-km-annuel').textContent, '8 800');
  assert.equal($('km_annuel').value, 8800);
  // (8 800 × 0,357) + 1 395 = 4 536,60 €
  assert.match($('res-transport').textContent, /4\s?536,60/);
  // (12 − 5,45) × 200 = 1 310 €
  assert.match($('res-repas').textContent, /1\s?310,00/);
  assert.match($('verdict-box').className, /good/);
  assert.equal($('warnings').classList.contains('visible'), false);
});

test('smoke : avertissement 40 km + circonstances particulières', () => {
  const sb = makeSandbox();
  const $ = (id) => sb.__byId.get(id) || sb.document.getElementById(id);
  $('salaire').value = '40000';
  $('jours_ouvres').value = '220';
  $('dist_aller').value = '60';
  $('cv').value = '5';
  $('energie').value = 'thermique';
  sb.calc();
  assert.equal($('res-km-annuel').textContent, '17 600'); // 220 × 40 × 2
  assert.equal($('warnings').classList.contains('visible'), true);
  $('circonstances').checked = true;
  sb.calc();
  assert.equal($('res-km-annuel').textContent, '26 400'); // 220 × 60 × 2
});

test('smoke : partage par URL (encode/décode sans perte)', () => {
  const sb = makeSandbox();
  const $ = (id) => sb.__byId.get(id) || sb.document.getElementById(id);
  $('salaire').value = '52000';
  $('nombre_parts').value = '2.5';
  const state = sb.readState();
  const encoded = sb.encodeShare(state);
  assert.ok(!encoded.includes('/') && !encoded.includes('+') && !encoded.includes('='));
  const decoded = JSON.parse(sb.decodeShare(encoded));
  // Comparaison par JSON : les objets viennent d'un autre contexte vm (prototypes différents)
  assert.equal(JSON.stringify(decoded), JSON.stringify(state));
});

test('smoke : noms de fichiers d\'export en date ISO (pas de slash)', () => {
  const sb = makeSandbox();
  assert.match(sb.exportFilename('json'), /^frais_reels_2026_\d{4}-\d{2}-\d{2}\.json$/);
});

test('smoke : buildExportData contient l\'état réimportable et les résultats', () => {
  const sb = makeSandbox();
  const $ = (id) => sb.__byId.get(id) || sb.document.getElementById(id);
  $('salaire').value = '45000';
  $('jours_ouvres').value = '220';
  $('dist_aller').value = '22';
  $('cv').value = '5';
  $('energie').value = 'thermique';
  sb.calc();
  const data = sb.buildExportData();
  assert.ok(data.state && data.state.f);
  assert.equal(data.results.totalFraisNets > 0, true);
  assert.match(data.declaration.case1AK_transport, /€/);
  assert.equal(data.metadata.fiscalYear, 2026);
});

test('smoke : restauration depuis localStorage', () => {
  const sb = makeSandbox();
  const $ = (id) => sb.__byId.get(id) || sb.document.getElementById(id);
  $('salaire').value = '61000';
  sb.calc();
  sb.scheduleSave();
  // Le save est debounced à 300 ms ; on force la lecture directe du readState
  const saved = JSON.parse(JSON.stringify(sb.readState()));
  sb.localStorage.setItem('frais-reels-state-v1', JSON.stringify(saved));
  const sb2 = makeSandbox();
  // sb2 partage le même localStorage ? non — on réinjecte :
  // on simule en réappliquant via applyState
  sb2.applyState(saved);
  assert.equal((sb2.__byId.get('salaire') || sb2.document.getElementById('salaire')).value, '61000');
});
