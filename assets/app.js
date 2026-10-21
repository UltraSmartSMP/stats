/* Statistiques de code de l'organisation Ultra Smart SMP.
   Aucune dépendance : graphiques en SVG faits main, DOM construit sans innerHTML
   (compatible avec la Content-Security-Policy stricte de vercel.json). */
(function () {
  'use strict';

  /* ---------- thème : appliqué avant le premier rendu ---------- */
  var CLE_THEME = 'stats-theme';
  var MODES = ['auto', 'light', 'dark'];
  var LIB_MODE = { auto: 'auto', light: 'clair', dark: 'sombre' };
  function lireTheme() { try { var v = localStorage.getItem(CLE_THEME); return MODES.indexOf(v) >= 0 ? v : 'auto'; } catch (e) { return 'auto'; } }
  function ecrireTheme(v) { try { if (v === 'auto') localStorage.removeItem(CLE_THEME); else localStorage.setItem(CLE_THEME, v); } catch (e) { /* stockage indisponible */ } }
  function appliquerTheme(v) {
    if (v === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', v);
  }
  var themeCourant = lireTheme();
  appliquerTheme(themeCourant);

  /* ---------- outils ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var nf = new Intl.NumberFormat('fr-FR');
  var nfPct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var dfLong = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });
  var dfCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  var dfAxe = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
  var DEPOTS_CONNUS = ['moteur', 'langage', 'bibliotheques', 'symbiose', 'serveur', 'docs'];

  function $(id) { return document.getElementById(id); }
  function el(tag, props) {
    var n = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k) || props[k] == null) continue;
        var v = props[k];
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'css') { for (var c in v) n.style.setProperty(c, v[c]); }
        else n.setAttribute(k, v);
      }
    }
    for (var i = 2; i < arguments.length; i++) ajouter(n, arguments[i]);
    return n;
  }
  function ajouter(n, enfant) {
    if (enfant == null || enfant === false) return;
    if (Array.isArray(enfant)) { enfant.forEach(function (e) { ajouter(n, e); }); return; }
    n.appendChild(typeof enfant === 'string' || typeof enfant === 'number' ? document.createTextNode(String(enfant)) : enfant);
  }
  function sv(tag, attrs, css) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (css) for (var c in css) n.style.setProperty(c, css[c]);
    return n;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }
  function pct(a, b) {
    if (!(b > 0)) return '–';
    return a > 0 && a / b < 0.0005 ? '< ' + nfPct.format(0.001) : nfPct.format(a / b);
  }
  function dateLongue(iso) { var d = new Date(iso); return isNaN(d) ? '–' : dfLong.format(d); }
  function dateCourte(iso) { var d = new Date(iso); return isNaN(d) ? '–' : dfCourt.format(d); }
  function couleurDepot(nom) { return DEPOTS_CONNUS.indexOf(nom) >= 0 ? 'var(--d-' + nom + ')' : 'var(--l-autres)'; }
  function logoDepot(nom) { return DEPOTS_CONNUS.indexOf(nom) >= 0 ? 'assets/depots/' + nom + '.svg?v=3' : 'assets/favicon.svg?v=3'; }

  /* ---------- infobulle ---------- */
  var bulle;
  function lignesBulle(titre, lignes) {
    var f = document.createDocumentFragment();
    f.appendChild(el('b', { text: titre }));
    lignes.forEach(function (l) {
      f.appendChild(el('div', { class: 'ib-ligne' },
        el('span', null, l.couleur ? el('i', { class: 'carre', css: { background: l.couleur } }) : null, l.lib),
        el('span', { text: l.val })));
    });
    return f;
  }
  function montrerBulle(contenu, x, y) {
    vider(bulle).appendChild(contenu);
    bulle.hidden = false;
    var r = bulle.getBoundingClientRect();
    var px = x + 14, py = y + 14;
    if (px + r.width > window.innerWidth - 8) px = x - r.width - 14;
    if (py + r.height > window.innerHeight - 8) py = y - r.height - 14;
    bulle.style.left = Math.max(8, px) + 'px';
    bulle.style.top = Math.max(8, py) + 'px';
  }
  function cacherBulle() { if (bulle) bulle.hidden = true; }
  function avecBulle(n, fabrique) {
    n.addEventListener('pointermove', function (e) { montrerBulle(fabrique(), e.clientX, e.clientY); });
    n.addEventListener('pointerleave', cacherBulle);
    return n;
  }

  /* ---------- état ---------- */
  var S = { toutDetail: false, stats: null, hist: [], depot: '', tri: { cle: 'code', sens: -1 }, modeHist: 'total', couleurs: {}, typesLib: {}, exemple: false };

  function bloc() {
    if (!S.depot) return S.stats.global;
    for (var i = 0; i < S.stats.depots.length; i++) if (S.stats.depots[i].nom === S.depot) return S.stats.depots[i];
    return S.stats.global;
  }

  /* couleur liée au langage, jamais à son rang dans la vue filtrée */
  function attribuerCouleurs() {
    var langs = (S.stats.global.langages || []).slice().sort(function (a, b) { return num(b.code) - num(a.code); });
    /* un langage non maison a une couleur propre s'il est dans les 7 premiers au global
       ou dans les 3 premiers non maison d'un dépôt (PowerShell domine symbiose, YAML pèse dans serveur) */
    var marques = {}, n7 = 0;
    langs.forEach(function (l) { if (!l.maison && n7 < 7) { marques[l.nom] = true; n7++; } });
    (S.stats.depots || []).forEach(function (d) {
      (d.langages || []).filter(function (l) { return !l.maison && num(l.code) > 0; }).slice(0, 3)
        .forEach(function (l) { marques[l.nom] = true; });
    });
    var im = 0, il = 0;
    langs.forEach(function (l) {
      if (l.maison) { S.couleurs[l.nom] = 'var(--m-' + (im++ % 5 + 1) + ')'; }
      else if (marques[l.nom] && il < 10) { S.couleurs[l.nom] = 'var(--l-' + (++il) + ')'; }
      else S.couleurs[l.nom] = 'var(--l-autres)';
    });
  }
  function couleurLangage(nom) { return S.couleurs[nom] || 'var(--l-autres)'; }
  function estAutre(nom) { return couleurLangage(nom) === 'var(--l-autres)'; }

  /* ---------- en-tête, filtre ---------- */
  function rendreEntete() {
    var st = S.stats;
    $('nom-affiche').textContent = st.nom_affiche || st.organisation || 'Ultra Smart SMP';
    var maj = $('maj');
    vider(maj);
    ajouter(maj, ['Mis à jour le ', el('strong', { text: dateLongue(st.maj) }), ' (heure de Paris)']);
    var MAISON = {
      'RSMP': 'le langage du projet (.rsmp)',
      'SMPA': 'l’assembleur de l’ISA SMPA (.smpa)',
      'RSMP IR': 'les sorties intermédiaires textuelles du compilateur (.hir, .mir, .lir, .ast)',
      'SMPA ISA': 'la description de l’ISA (.isa)',
      'SMPI': 'les interfaces de bundles (.smpi)'
    };
    var lm = vider($('liste-maison'));
    (st.langages_maison || []).forEach(function (n) {
      lm.appendChild(el('li', null, el('strong', { text: n }), MAISON[n] ? ' : ' + MAISON[n] : ''));
    });
    var e = $('empreinte');
    e.textContent = 'Empreinte des commits comptés : ' + (st.empreinte || '–');
    if (st.organisation) {
      document.querySelectorAll('.marque, .lien-org').forEach(function (a) { a.href = 'https://github.com/' + encodeURIComponent(st.organisation); });
    }
  }

  function rendreFiltre() {
    var puces = vider($('puces'));
    var choix = [{ nom: '', lib: 'Tous les dépôts' }].concat(S.stats.depots.map(function (d) { return { nom: d.nom, lib: d.nom }; }));
    choix.forEach(function (c) {
      var b = el('button', { type: 'button', class: 'puce', 'aria-pressed': String(S.depot === c.nom), 'data-depot': c.nom },
        c.nom ? el('span', { class: 'pastille', css: { background: couleurDepot(c.nom) } }) : null, c.lib);
      b.addEventListener('click', function () { choisirDepot(c.nom); });
      puces.appendChild(b);
    });
  }

  function choisirDepot(nom) {
    S.depot = nom;
    try { history.replaceState(null, '', location.pathname + location.search + (nom ? '#' + nom : '')); } catch (e) { /* adresse inchangée */ }
    document.querySelectorAll('.puce').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-depot') === nom)); });
    rendreVues();
  }

  /* ---------- chiffres clés ---------- */
  function rendreChiffres() {
    var b = bloc(), L = b.lignes || {};
    var langs = b.langages || [];
    var maison = langs.filter(function (l) { return l.maison; });
    var codeMaison = maison.reduce(function (s, l) { return s + num(l.code); }, 0);
    var code = num(L.code);
    var donnees = (b.types || []).filter(function (t) { return t.id === 'donnees'; })[0];
    var horsDonnees = code - num(donnees && donnees.code);
    var zone = vider($('chiffres'));
    function tuile(lib, val, sous, cls) {
      return el('div', { class: 'chiffre' + (cls ? ' ' + cls : '') },
        el('span', { class: 'chiffre-lib', text: lib }), el('span', { class: 'chiffre-val', text: val }), sous);
    }
    zone.appendChild(tuile('Lignes de code', nf.format(code), [
      el('span', { class: 'chiffre-sous', text: nf.format(num(L.total)) + ' lignes au total, commentaires et vides compris' }),
      donnees && num(donnees.code) > 0 ? el('span', { class: 'chiffre-sous', text: 'dont ' + nf.format(horsDonnees) + ' hors données (' + pct(horsDonnees, code) + ')' }) : null]));
    zone.appendChild(tuile('Fichiers', nf.format(num(b.fichiers)),
      el('span', { class: 'chiffre-sous', text: nf.format(num(L.commentaires)) + ' lignes de commentaires' })));
    zone.appendChild(tuile('Langages', nf.format(langs.length),
      el('span', { class: 'chiffre-sous', text: maison.length ? 'dont ' + maison.length + ' maison' : 'aucun langage maison' })));
    var noms = maison.map(function (l) { return l.nom; }).join(', ');
    zone.appendChild(tuile('Langages maison', code > 0 ? pct(codeMaison, code) : '–', [
      el('span', { class: 'chiffre-sous', text: codeMaison ? nf.format(codeMaison) + ' lignes en ' + noms : 'Pas de code maison dans cette vue' }),
      el('div', { class: 'jauge', role: 'img', 'aria-label': 'Part des langages maison : ' + pct(codeMaison, code) },
        el('span', { css: { width: (code > 0 ? (100 * codeMaison / code) : 0).toFixed(2) + '%' } }))
    ], 'maison'));
  }

  /* ---------- barre empilée ---------- */
  function barreEmpilee(langs, total, libelle) {
    var bar = el('div', { class: 'empile', role: 'img', 'aria-label': libelle });
    if (total <= 0) return bar;
    var autres = { code: 0, n: 0 };
    langs.forEach(function (l) {
      if (num(l.code) <= 0) return;
      if (estAutre(l.nom)) { autres.code += num(l.code); autres.n++; return; }
      bar.appendChild(avecBulle(el('span', { css: { width: (100 * l.code / total) + '%', background: couleurLangage(l.nom) } }), function () {
        return lignesBulle(l.nom + (l.maison ? ' · maison' : ''), [{ lib: 'Code', val: nf.format(l.code) }, { lib: 'Part', val: pct(l.code, total) }]);
      }));
    });
    if (autres.code > 0) {
      bar.appendChild(avecBulle(el('span', { css: { width: (100 * autres.code / total) + '%', background: 'var(--l-autres)' } }), function () {
        return lignesBulle('Autres (' + autres.n + ' langages)', [{ lib: 'Code', val: nf.format(autres.code) }, { lib: 'Part', val: pct(autres.code, total) }]);
      }));
    }
    return bar;
  }

  /* ---------- langages ---------- */
  function rendreLangages() {
    var b = bloc(), langs = (b.langages || []).slice().sort(function (x, y) { return num(y.code) - num(x.code); });
    var total = num((b.lignes || {}).code);
    vider($('empile-langages')).appendChild(barreEmpilee(langs, total, 'Répartition des lignes de code par langage ; valeurs dans le tableau ci-dessous'));
    var max = langs.reduce(function (m, l) { return Math.max(m, num(l.code)); }, 0);
    var t = vider($('table-langages'));
    t.appendChild(el('caption', { class: 'vh' }, 'Lignes de code par langage'));
    t.appendChild(el('thead', null, el('tr', null,
      el('th', { scope: 'col', text: 'Langage' }), el('th', { scope: 'col' }, el('span', { class: 'vh' }, 'Barre')),
      el('th', { scope: 'col', class: 'num', text: 'Code' }), el('th', { scope: 'col', class: 'num', text: 'Part' }),
      el('th', { scope: 'col', class: 'num col-fichiers', text: 'Fichiers' }))));
    var corps = el('tbody');
    langs.forEach(function (l) {
      corps.appendChild(el('tr', null,
        el('th', { scope: 'row' }, el('span', { class: 'nom-l' },
          el('i', { class: 'carre', css: { background: couleurLangage(l.nom) } }), l.nom,
          l.maison ? el('span', { class: 'badge', text: 'maison' }) : null)),
        el('td', { class: 'piste', 'aria-hidden': 'true' }, el('div', { class: 'piste-fond' },
          el('span', { css: { width: (max > 0 ? 100 * num(l.code) / max : 0) + '%', background: couleurLangage(l.nom) } }))),
        el('td', { class: 'num', text: nf.format(num(l.code)) }),
        el('td', { class: 'num part', text: pct(num(l.code), total) }),
        el('td', { class: 'num col-fichiers', text: nf.format(num(l.fichiers)) })));
    });
    if (!langs.length) corps.appendChild(el('tr', null, el('td', { colspan: '5', class: 'vide-note', text: 'Aucun fichier compté dans cette vue.' })));
    t.appendChild(corps);
    $('note-langages').textContent = (S.depot ? 'Dépôt ' + S.depot + ' : l' : 'L') + 'ignes de code par langage, hors commentaires et lignes vides.';
  }

  /* ---------- types ---------- */
  function rendreTypes() {
    var b = bloc(), total = num((b.lignes || {}).code);
    var ordre = (S.stats.types || []).map(function (t) { return t.id; });
    var types = (b.types || []).slice().sort(function (x, y) { return num(y.code) - num(x.code) || ordre.indexOf(x.id) - ordre.indexOf(y.id); });
    var max = types.reduce(function (m, t) { return Math.max(m, num(t.code)); }, 0);
    var t = vider($('table-types'));
    t.appendChild(el('caption', { class: 'vh' }, 'Lignes de code par type de fichier'));
    t.appendChild(el('thead', null, el('tr', null,
      el('th', { scope: 'col', text: 'Type' }), el('th', { scope: 'col' }, el('span', { class: 'vh' }, 'Barre')),
      el('th', { scope: 'col', class: 'num', text: 'Code' }), el('th', { scope: 'col', class: 'num', text: 'Part' }),
      el('th', { scope: 'col', class: 'num col-fichiers', text: 'Fichiers' }))));
    var corps = el('tbody');
    types.forEach(function (ty) {
      var info = S.typesLib[ty.id] || { libelle: ty.id, description: '' };
      corps.appendChild(el('tr', null,
        el('th', { scope: 'row' }, info.libelle, info.description ? el('span', { class: 'sous-type', text: info.description }) : null),
        el('td', { class: 'piste', 'aria-hidden': 'true' }, el('div', { class: 'piste-fond' },
          el('span', { css: { width: (max > 0 ? 100 * num(ty.code) / max : 0) + '%', background: 'var(--chaleur)' } }))),
        el('td', { class: 'num', text: nf.format(num(ty.code)) }),
        el('td', { class: 'num part', text: pct(num(ty.code), total) }),
        el('td', { class: 'num col-fichiers', text: nf.format(num(ty.fichiers)) })));
    });
    if (!types.length) corps.appendChild(el('tr', null, el('td', { colspan: '5', class: 'vide-note', text: 'Aucun fichier compté dans cette vue.' })));
    t.appendChild(corps);
  }

  /* ---------- anneau des dépôts ---------- */
  function arc(cx, cy, r0, r1, a0, a1) {
    var g = 1.2 / r1; // écart de 2 px environ entre segments
    if (a1 - a0 > 2 * g) { a0 += g; a1 -= g; }
    var big = a1 - a0 > Math.PI ? 1 : 0;
    function p(r, a) { return (cx + r * Math.sin(a)).toFixed(2) + ' ' + (cy - r * Math.cos(a)).toFixed(2); }
    return 'M' + p(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 ' + big + ' 1 ' + p(r1, a1) +
      ' L' + p(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + p(r0, a0) + ' Z';
  }
  function rendreAnneau() {
    var zone = vider($('anneau'));
    var deps = S.stats.depots.slice().sort(function (a, b) { return num((b.lignes || {}).code) - num((a.lignes || {}).code); });
    var total = deps.reduce(function (s, d) { return s + num((d.lignes || {}).code); }, 0);
    var choisi = S.depot ? deps.filter(function (d) { return d.nom === S.depot; })[0] : null;
    var svg = sv('svg', { viewBox: '0 0 180 180', role: 'img', 'aria-label': 'Part de chaque dépôt dans les lignes de code ; valeurs dans la liste à côté' });
    svg.appendChild(sv('circle', { cx: 90, cy: 90, r: 71, fill: 'none', 'stroke-width': 26 }, { stroke: 'var(--surface-2)' }));
    var a = 0;
    deps.forEach(function (d) {
      var c = num((d.lignes || {}).code);
      if (c <= 0 || total <= 0) return;
      var a1 = a + 2 * Math.PI * c / total;
      var seg;
      if (c === total) {
        seg = sv('circle', { cx: 90, cy: 90, r: 71, fill: 'none', 'stroke-width': 26 }, { stroke: couleurDepot(d.nom) });
      } else {
        seg = sv('path', { d: arc(90, 90, 58, 84, a, a1) }, { fill: couleurDepot(d.nom) });
      }
      if (choisi && choisi.nom !== d.nom) seg.style.setProperty('opacity', '.22');
      avecBulle(seg, function () { return lignesBulle(d.nom, [{ lib: 'Code', val: nf.format(c) }, { lib: 'Part', val: pct(c, total) }]); });
      svg.appendChild(seg);
      a = a1;
    });
    var cVal = choisi ? pct(num((choisi.lignes || {}).code), total) : nf.format(total);
    svg.appendChild(sv('text', { x: 90, y: 92, 'text-anchor': 'middle', class: 'anneau-centre-val' })).textContent = cVal;
    svg.appendChild(sv('text', { x: 90, y: 111, 'text-anchor': 'middle', class: 'anneau-centre-lib' })).textContent = choisi ? 'du total' : 'lignes de code';
    zone.appendChild(svg);
    var liste = el('ul', { class: 'liste-anneau' });
    deps.forEach(function (d) {
      var c = num((d.lignes || {}).code);
      liste.appendChild(el('li', { class: choisi && choisi.nom !== d.nom ? 'eteint' : null },
        el('i', { class: 'pastille', css: { background: couleurDepot(d.nom) } }),
        el('span', { text: d.nom }), el('span', { class: 'num', text: nf.format(c) }), el('span', { class: 'num part', text: pct(c, total) })));
    });
    zone.appendChild(liste);
  }

  /* ---------- tableau croisé ---------- */
  function rendreCroise() {
    var b = bloc();
    var langs = (b.langages || []).slice().sort(function (x, y) { return num(y.code) - num(x.code); });
    var typesBloc = {};
    (b.types || []).forEach(function (t) { typesBloc[t.id] = t; });
    var cols = (S.stats.types || []).filter(function (t) { return typesBloc[t.id] && num(typesBloc[t.id].code) > 0; });
    var cell = {}, max = 0;
    (b.croise || []).forEach(function (c) { var v = num(c.code); cell[c.langage + '\u0000' + c.type] = v; if (v > max) max = v; });
    var t = vider($('table-croise'));
    t.appendChild(el('caption', { class: 'vh' }, 'Lignes de code par langage et par type de fichier'));
    t.appendChild(el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Langage' }),
      cols.map(function (c) { return el('th', { scope: 'col', text: c.libelle }); }), el('th', { scope: 'col', class: 'tot', text: 'Total' }))));
    var corps = el('tbody');
    langs.forEach(function (l) {
      var somme = 0;
      var tds = cols.map(function (c) {
        var v = cell[l.nom + '\u0000' + c.id] || 0;
        somme += v;
        if (!v) return el('td', { class: 'vide', text: '–' });
        var r = max > 0 ? v / max : 0;
        return avecBulle(el('td', { text: nf.format(v), css: { 'background-color': 'color-mix(in srgb, var(--chaud) ' + (6 + 40 * Math.pow(r, 0.55)).toFixed(1) + '%, transparent)' } }), function () {
          return lignesBulle(l.nom + ' · ' + c.libelle, [{ lib: 'Code', val: nf.format(v) }, { lib: 'Part du langage', val: pct(v, num(l.code)) }]);
        });
      });
      corps.appendChild(el('tr', null, el('th', { scope: 'row' }, el('span', { class: 'nom-l' },
        el('i', { class: 'carre', css: { background: couleurLangage(l.nom) } }), l.nom,
        l.maison ? el('span', { class: 'badge', text: 'maison' }) : null)), tds, el('td', { class: 'tot', text: nf.format(somme) })));
    });
    t.appendChild(corps);
    t.appendChild(el('tfoot', null, el('tr', null, el('th', { scope: 'row', text: 'Total' }),
      cols.map(function (c) { return el('td', { text: nf.format(num(typesBloc[c.id].code)) }); }),
      el('td', { text: nf.format(num((b.lignes || {}).code)) }))));
  }

  /* ---------- cartes des dépôts ---------- */
  function rendreCartes() {
    var zone = vider($('cartes'));
    S.stats.depots.forEach(function (d) {
      var L = d.lignes || {}, code = num(L.code);
      var langs = (d.langages || []).slice().sort(function (x, y) { return num(y.code) - num(x.code); });
      var cm = d.commit || {};
      var cls = 'carte' + (S.depot === d.nom ? ' choisie' : '') + (S.depot && S.depot !== d.nom ? ' eteinte' : '');
      var filtrer = el('button', { type: 'button', class: 'bouton-mini', text: S.depot === d.nom ? 'Voir tous les dépôts' : 'Filtrer sur ce dépôt' });
      filtrer.addEventListener('click', function () { choisirDepot(S.depot === d.nom ? '' : d.nom); });
      zone.appendChild(el('article', { class: cls, 'aria-label': 'Dépôt ' + d.nom },
        el('div', { class: 'carte-tete' }, el('img', { src: logoDepot(d.nom), alt: '', width: '36', height: '36' }), el('h3', { text: d.nom })),
        el('p', { class: 'carte-desc', text: d.description || 'Sans description.' }),
        el('dl', { class: 'carte-nums' },
          el('div', null, el('dt', { text: 'Code' }), el('dd', { text: nf.format(code) })),
          el('div', null, el('dt', { text: 'Fichiers' }), el('dd', { text: nf.format(num(d.fichiers)) })),
          el('div', null, el('dt', { text: 'Langages' }), el('dd', { text: nf.format(langs.length) }))),
        code > 0 ? barreEmpilee(langs, code, 'Répartition par langage du dépôt ' + d.nom) : el('p', { class: 'vide-note', text: 'Aucune ligne de code comptée.' }),
        langs.length ? el('p', { class: 'carte-langs' }, langs.slice(0, 3).map(function (l) {
          return el('span', null, el('i', { class: 'carre', css: { background: couleurLangage(l.nom) } }), l.nom + ' ' + pct(num(l.code), code));
        })) : null,
        el('div', { class: 'commit' },
          el('div', { class: 'commit-ligne' },
            cm.sha && d.url ? el('a', { class: 'commit-sha', href: d.url + '/commit/' + cm.sha, rel: 'noopener', title: 'Dernier commit compté' }, cm.court || String(cm.sha).slice(0, 7))
              : el('span', { class: 'commit-sha', text: cm.court || '–' }),
            el('span', { text: cm.date ? dateCourte(cm.date) : 'date inconnue' })),
          el('span', { class: 'commit-msg', title: cm.message || '', text: cm.message || '' })),
        el('div', { class: 'carte-pied' },
          d.url ? el('a', { class: 'lien-mini', href: d.url, rel: 'noopener' }, 'Voir sur GitHub ', el('span', { 'aria-hidden': 'true', text: '↗' })) : el('span'),
          filtrer)));
    });
  }

  /* ---------- historique ---------- */
  function echelleNette(max) {
    if (max <= 0) return { max: 1, pas: 1 };
    var brut = max / 4, p = Math.pow(10, Math.floor(Math.log10(brut))), r = brut / p;
    var pas = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
    return { max: Math.ceil(max / pas) * pas, pas: pas };
  }
  function abrege(n) {
    if (n >= 1e6) return nf.format(+(n / 1e6).toFixed(2)) + ' M';
    if (n >= 1e3) return nf.format(+(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)) + ' k';
    return nf.format(n);
  }
  function seriesHistorique() {
    var h = S.hist;
    if (S.depot) return [{ nom: S.depot, couleur: couleurDepot(S.depot), val: h.map(function (e) { return num((e.par_depot || {})[S.depot]); }), aire: true }];
    if (S.modeHist === 'depots') {
      return S.stats.depots.map(function (d) {
        return { nom: d.nom, couleur: couleurDepot(d.nom), val: h.map(function (e) { return num((e.par_depot || {})[d.nom]); }) };
      });
    }
    return [{ nom: 'Total', couleur: 'var(--accent)', val: h.map(function (e) { return num(e.code); }), aire: true }];
  }
  function rendreHistorique() {
    var section = $('bloc-historique');
    if (S.hist.length < 2) { section.hidden = true; return; }
    section.hidden = false;
    $('bascule-historique').hidden = !!S.depot;
    document.querySelectorAll('#bascule-historique button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === S.modeHist)); });
    $('note-historique').textContent = (S.depot ? 'Dépôt ' + S.depot + ' : l' : 'L') + 'ignes de code à chaque changement de commit, ' + S.hist.length + ' relevés.';
    dessinerCourbe();
    var series = seriesHistorique();
    var leg = vider($('legende-historique'));
    if (series.length > 1) series.forEach(function (s) { leg.appendChild(el('span', null, el('i', { css: { background: s.couleur } }), s.nom)); });
    var t = vider($('table-historique'));
    var noms = S.stats.depots.map(function (d) { return d.nom; });
    t.appendChild(el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Date' }), el('th', { scope: 'col', class: 'num', text: 'Total' }),
      noms.map(function (n) { return el('th', { scope: 'col', class: 'num', text: n }); }))));
    var corps = el('tbody');
    S.hist.slice().reverse().forEach(function (e) {
      corps.appendChild(el('tr', null, el('td', { text: dateCourte(e.maj) }), el('td', { class: 'num', text: nf.format(num(e.code)) }),
        noms.map(function (n) { return el('td', { class: 'num', text: nf.format(num((e.par_depot || {})[n])) }); })));
    });
    t.appendChild(corps);
  }
  function dessinerCourbe() {
    var zone = $('courbe');
    if ($('bloc-historique').hidden) return;
    vider(zone);
    var W = Math.max(280, zone.clientWidth), H = 260, mg = { g: 52, d: 14, h: 12, b: 28 };
    var h = S.hist, series = seriesHistorique();
    var t0 = Date.parse(h[0].maj), t1 = Date.parse(h[h.length - 1].maj);
    if (!(t1 > t0)) t1 = t0 + 1;
    var vmax = 0;
    series.forEach(function (s) { s.val.forEach(function (v) { if (v > vmax) vmax = v; }); });
    var ech = echelleNette(vmax);
    function X(t) { return mg.g + (W - mg.g - mg.d) * (t - t0) / (t1 - t0); }
    function Y(v) { return mg.h + (H - mg.h - mg.b) * (1 - v / ech.max); }
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': 'Courbe des lignes de code du ' + dateCourte(h[0].maj) + ' au ' + dateCourte(h[h.length - 1].maj) + ' ; valeurs dans le tableau « Voir les valeurs de l’historique »' });
    for (var v = 0; v <= ech.max + 1e-9; v += ech.pas) {
      svg.appendChild(sv('line', { x1: mg.g, x2: W - mg.d, y1: Y(v), y2: Y(v), class: v === 0 ? 'base' : 'grille' }));
      svg.appendChild(sv('text', { x: mg.g - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'axe' })).textContent = abrege(v);
    }
    var nTicks = Math.max(2, Math.min(7, Math.floor((W - mg.g - mg.d) / 110)));
    for (var i = 0; i < nTicks; i++) {
      var tt = t0 + (t1 - t0) * i / (nTicks - 1);
      var anc = i === 0 ? 'start' : i === nTicks - 1 ? 'end' : 'middle';
      svg.appendChild(sv('text', { x: X(tt), y: H - 8, 'text-anchor': anc, class: 'axe' })).textContent = dfAxe.format(new Date(tt));
    }
    var xs = h.map(function (e) { return X(Date.parse(e.maj)); });
    series.forEach(function (s) {
      var d = s.val.map(function (val, k) { return (k ? 'L' : 'M') + xs[k].toFixed(1) + ' ' + Y(val).toFixed(1); }).join(' ');
      if (s.aire) svg.appendChild(sv('path', { d: d + ' L' + xs[xs.length - 1].toFixed(1) + ' ' + Y(0) + ' L' + xs[0].toFixed(1) + ' ' + Y(0) + ' Z' },
        { fill: 'color-mix(in srgb, ' + s.couleur + ' 13%, transparent)' }));
      svg.appendChild(sv('path', { d: d, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, { fill: 'none', stroke: s.couleur }));
      var dern = s.val.length - 1;
      svg.appendChild(sv('circle', { cx: xs[dern], cy: Y(s.val[dern]), r: 4, 'stroke-width': 2 }, { fill: s.couleur, stroke: 'var(--surface)' }));
    });
    var repere = sv('line', { y1: mg.h, y2: H - mg.b, class: 'repere', visibility: 'hidden' });
    svg.appendChild(repere);
    var points = series.map(function (s) {
      var c = sv('circle', { r: 4.5, 'stroke-width': 2, visibility: 'hidden' }, { fill: s.couleur, stroke: 'var(--surface)' });
      svg.appendChild(c); return c;
    });
    var cible = sv('rect', { x: mg.g, y: 0, width: W - mg.g - mg.d, height: H, fill: 'transparent' });
    svg.appendChild(cible);
    function survol(e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, k = 0, best = Infinity;
      xs.forEach(function (xx, j) { var dd = Math.abs(xx - x); if (dd < best) { best = dd; k = j; } });
      repere.setAttribute('x1', xs[k]); repere.setAttribute('x2', xs[k]); repere.setAttribute('visibility', 'visible');
      points.forEach(function (c, j) { c.setAttribute('cx', xs[k]); c.setAttribute('cy', Y(series[j].val[k])); c.setAttribute('visibility', 'visible'); });
      var lignes = series.map(function (s) { return { lib: s.nom, val: nf.format(s.val[k]), couleur: s.couleur, v: s.val[k] }; })
        .sort(function (a, b) { return b.v - a.v; });
      montrerBulle(lignesBulle(dateCourte(h[k].maj), lignes), e.clientX, e.clientY);
    }
    cible.addEventListener('pointermove', survol);
    cible.addEventListener('pointerdown', survol);
    cible.addEventListener('pointerleave', function () {
      repere.setAttribute('visibility', 'hidden'); points.forEach(function (c) { c.setAttribute('visibility', 'hidden'); }); cacherBulle();
    });
    zone.appendChild(svg);
  }

  /* ---------- tableau détaillé triable ---------- */
  var COLS = [
    { cle: 'depot', lib: 'Dépôt', texte: true }, { cle: 'langage', lib: 'Langage', texte: true },
    { cle: 'fichiers', lib: 'Fichiers' }, { cle: 'code', lib: 'Code' }, { cle: 'commentaires', lib: 'Commentaires' },
    { cle: 'vides', lib: 'Vides' }, { cle: 'total', lib: 'Total' }
  ];
  function rendreDetail() {
    var lignes = [];
    S.stats.depots.forEach(function (d) {
      if (S.depot && d.nom !== S.depot) return;
      (d.langages || []).forEach(function (l) {
        var c = num(l.code), cm = num(l.commentaires), vi = num(l.vides);
        lignes.push({ depot: d.nom, langage: l.nom, maison: !!l.maison, fichiers: num(l.fichiers), code: c, commentaires: cm, vides: vi, total: c + cm + vi });
      });
    });
    var tri = S.tri, col = COLS.filter(function (c) { return c.cle === tri.cle; })[0] || COLS[3];
    lignes.sort(function (a, b) {
      var r = col.texte ? String(a[col.cle]).localeCompare(String(b[col.cle]), 'fr') : a[col.cle] - b[col.cle];
      return r * tri.sens || b.code - a.code;
    });
    var t = vider($('table-detail'));
    t.appendChild(el('caption', { class: 'vh' }, 'Lignes par dépôt et par langage, triées par ' + col.lib.toLowerCase()));
    t.appendChild(el('thead', null, el('tr', null, COLS.map(function (c) {
      var actif = c.cle === tri.cle;
      var b = el('button', { type: 'button', class: 'tri' }, c.lib, el('span', { class: 'fleche', 'aria-hidden': 'true', text: actif ? (tri.sens > 0 ? '▲' : '▼') : '' }));
      b.addEventListener('click', function () {
        if (S.tri.cle === c.cle) S.tri.sens = -S.tri.sens; else { S.tri.cle = c.cle; S.tri.sens = c.texte ? 1 : -1; }
        rendreDetail();
        var nb = document.querySelector('#table-detail th[aria-sort] .tri');
        if (nb) nb.focus();
      });
      return el('th', { scope: 'col', class: c.texte ? null : 'num col-' + c.cle, 'aria-sort': actif ? (tri.sens > 0 ? 'ascending' : 'descending') : null }, b);
    }))));
    var corps = el('tbody');
    var tot = { fichiers: 0, code: 0, commentaires: 0, vides: 0, total: 0 };
    var LIMITE = 25;
    lignes.forEach(function (l, i) {
      for (var k in tot) tot[k] += l[k];
      if (!S.toutDetail && i >= LIMITE) return;
      corps.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'depot-cell' }, el('i', { class: 'pastille', css: { background: couleurDepot(l.depot) } }), l.depot)),
        el('td', null, el('span', { class: 'nom-l' }, el('i', { class: 'carre', css: { background: couleurLangage(l.langage) } }), l.langage,
          l.maison ? el('span', { class: 'badge', text: 'maison' }) : null)),
        ['fichiers', 'code', 'commentaires', 'vides', 'total'].map(function (k) { return el('td', { class: 'num col-' + k, text: nf.format(l[k]) }); })));
    });
    if (!lignes.length) corps.appendChild(el('tr', null, el('td', { colspan: '7', class: 'vide-note', text: 'Aucun fichier compté dans cette vue.' })));
    t.appendChild(corps);
    t.appendChild(el('tfoot', null, el('tr', null, el('th', { scope: 'row', colspan: '2', text: 'Total (' + lignes.length + ' couples dépôt × langage)' }),
      ['fichiers', 'code', 'commentaires', 'vides', 'total'].map(function (k) { return el('td', { class: 'num col-' + k, text: nf.format(tot[k]) }); }))));
    var suite = vider($('detail-suite'));
    if (lignes.length > LIMITE) {
      var b = el('button', { type: 'button', class: 'bouton-mini', 'aria-controls': 'table-detail',
        text: S.toutDetail ? 'Afficher les ' + LIMITE + ' premières lignes' : 'Afficher les ' + lignes.length + ' lignes' });
      b.addEventListener('click', function () { S.toutDetail = !S.toutDetail; rendreDetail(); $('detail-suite').firstChild.focus(); });
      suite.appendChild(b);
    }
  }

  function rendreVues() {
    cacherBulle();
    rendreChiffres(); rendreLangages(); rendreTypes(); rendreAnneau(); rendreCroise(); rendreCartes(); rendreHistorique(); rendreDetail();
  }

  /* ---------- erreurs ---------- */
  function erreur(titre, detail) {
    var z = $('erreur');
    vider(z);
    z.appendChild(el('h2', { text: titre }));
    z.appendChild(el('p', { text: detail }));
    z.hidden = false;
    Array.prototype.forEach.call($('contenu').children, function (n) { if (n.id !== 'erreur') n.hidden = true; });
    document.querySelector('.filtre').hidden = true;
    $('maj').textContent = 'Statistiques indisponibles';
  }

  /* ---------- chargement ---------- */
  function charger(url, obligatoire) {
    return fetch(url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.statut = r.status; throw e; }
      return r.json();
    }).catch(function (e) { if (obligatoire) throw e; return null; });
  }
  function valide(st) {
    return st && typeof st === 'object' && st.global && Array.isArray(st.depots) && st.global.lignes;
  }
  function demarrer() {
    bulle = $('infobulle');
    var bt = $('bouton-theme');
    function libTheme() { bt.textContent = 'Thème : ' + LIB_MODE[themeCourant]; bt.title = 'Changer de thème (auto, clair, sombre)'; }
    libTheme();
    bt.addEventListener('click', function () {
      themeCourant = MODES[(MODES.indexOf(themeCourant) + 1) % MODES.length];
      appliquerTheme(themeCourant); ecrireTheme(themeCourant); libTheme();
    });
    document.querySelectorAll('#bascule-historique button').forEach(function (b) {
      b.addEventListener('click', function () { S.modeHist = b.getAttribute('data-mode'); rendreHistorique(); });
    });
    window.addEventListener('scroll', cacherBulle, { passive: true });

    var params = new URLSearchParams(location.search);
    S.exemple = params.get('donnees') === 'exemple';
    var uStats = S.exemple ? 'data/exemple.json' : 'data/stats.json';
    var uHist = S.exemple ? 'data/exemple-historique.json' : 'data/historique.json';
    $('bandeau-exemple').hidden = !S.exemple;

    Promise.all([charger(uStats, true), charger(uHist, false)]).then(function (res) {
      var st = res[0];
      if (!valide(st)) { erreur('Statistiques illisibles', 'Le fichier ' + uStats + ' ne suit pas le format attendu (version 1). Relancez le générateur puis poussez ce dépôt.'); return; }
      if (st.exemple && !S.exemple) { erreur('Données d’exemple refusées', 'Le fichier ' + uStats + ' contient des chiffres d’exemple. Relancez le générateur pour produire les vrais chiffres.'); return; }
      S.stats = st;
      (st.types || []).forEach(function (t) { S.typesLib[t.id] = t; });
      S.hist = (Array.isArray(res[1]) ? res[1] : []).filter(function (e) { return e && !isNaN(Date.parse(e.maj)); })
        .sort(function (a, b) { return Date.parse(a.maj) - Date.parse(b.maj); });
      attribuerCouleurs();
      var ancre = decodeURIComponent(location.hash.slice(1));
      if (st.depots.some(function (d) { return d.nom === ancre; })) S.depot = ancre;
      Array.prototype.forEach.call($('contenu').children, function (n) {
        if (n.id !== 'erreur' && n.id !== 'bloc-historique') n.hidden = n.id === 'chargement';
      });
      rendreEntete(); rendreFiltre(); rendreVues();
      window.addEventListener('hashchange', function () {
        var h = decodeURIComponent(location.hash.slice(1));
        var nom = st.depots.some(function (d) { return d.nom === h; }) ? h : '';
        if (nom !== S.depot) choisirDepot(nom);
      });
      if (window.ResizeObserver) {
        var attente = 0, largeur = $('courbe').clientWidth;
        new ResizeObserver(function () {
          var w = $('courbe').clientWidth;
          if (w === largeur) return;
          largeur = w; cancelAnimationFrame(attente); attente = requestAnimationFrame(dessinerCourbe);
        }).observe($('courbe'));
      }
    }).catch(function (e) {
      if (e && e.statut === 404) erreur('Statistiques pas encore générées', 'Le fichier ' + uStats + ' est introuvable. Lancez le générateur décrit dans le README, puis poussez ce dépôt : Vercel publiera la page à jour.');
      else erreur('Chargement impossible', 'Les statistiques n’ont pas pu être lues (' + (e && e.message ? e.message : 'erreur inconnue') + '). Rechargez la page dans un instant.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
