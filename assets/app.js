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
  /* étendue courte (moins de 7 jours) : l'heure s'ajoute, sinon plusieurs repères donneraient le même jour */
  var dfAxeHeure = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  var DEPOTS_CONNUS = ['moteur', 'langage', 'bibliotheques', 'symbiose', 'natives', 'rsmp-gpu', 'auto-hebergement', 'serveur', 'bundles', 'kcauldron', 'orchestration', 'docs'];

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
    function tuile(lib, val, sous, cls, badge) {
      return el('div', { class: 'chiffre' + (cls ? ' ' + cls : '') },
        el('span', { class: 'chiffre-lib', text: lib }),
        el('span', { class: 'chiffre-ligne' }, el('span', { class: 'chiffre-val', text: val }), badge), sous);
    }
    var gCode = dernierEcart('code', null, S.depot), gDonnees = dernierEcart('type', 'donnees', S.depot);
    zone.appendChild(tuile('Lignes de code', nf.format(code), [
      el('span', { class: 'chiffre-sous', text: nf.format(num(L.total)) + ' lignes au total, commentaires et vides compris' }),
      donnees && num(donnees.code) > 0 ? el('span', { class: 'chiffre-sous' },
        'dont ' + nf.format(horsDonnees) + ' hors données (' + pct(horsDonnees, code) + ')',
        gCode == null ? null : badgeGain(gCode - num(gDonnees))) : null], null, badgeGain(gCode)));
    zone.appendChild(tuile('Fichiers', nf.format(num(b.fichiers)),
      el('span', { class: 'chiffre-sous', text: nf.format(num(L.commentaires)) + ' lignes de commentaires' })));
    zone.appendChild(tuile('Langages', nf.format(langs.length),
      el('span', { class: 'chiffre-sous', text: maison.length ? 'dont ' + maison.length + ' maison' : 'aucun langage maison' })));
    var noms = maison.map(function (l) { return l.nom; }).join(', ');
    var nomsMaison = S.stats.langages_maison || maison.map(function (l) { return l.nom; });
    var rm = decouper(codeMaison, serieDeltas('langage', nomsMaison));
    zone.appendChild(tuile('Langages maison', code > 0 ? pct(codeMaison, code) : '–', [
      el('span', { class: 'chiffre-sous' },
        codeMaison ? nf.format(codeMaison) + ' lignes en ' + noms : 'Pas de code maison dans cette vue',
        codeMaison ? badgeGain(dernierEcart('langage', nomsMaison, S.depot)) : null),
      el('div', { class: 'jauge', role: 'img', 'aria-label': 'Part des langages maison : ' + pct(codeMaison, code) },
        barreSegmentee(rm, 'var(--accent)', code > 0 ? 100 * codeMaison / code : 0))
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

  /* ---------- découpage des barres par commit ---------- */
  /* Une barre de lignes de code se découpe en une base (« avant le suivi par commit ») puis un segment par
     relevé (un relevé = un passage de synchronisation, au plus un commit par dépôt). Les valeurs passées sont
     reconstruites depuis la valeur courante avec les « delta » de historique.json : v(k−1) = v(k) − delta(k). */
  var SEG_MAX = 40, SEG_MIN_PART = 0.0025;

  /* DEBUT decouper (fonction pure, extraite telle quelle par les tests sous node) */
  function fusionnerSeg(a, b) {
    a.taille += b.taille; a.ecart += b.ecart; a.n += b.n; a.items = a.items.concat(b.items); a.fusion = true;
    a.recent = !!(a.recent || b.recent);
  }
  /* courant : valeur actuelle de la série ; deltas : du relevé le plus récent au plus ancien, chacun { ecart, n?, ... }.
     Un élément absent ou sans « ecart » numérique (relevé sans delta) arrête la remontée.
     Rend { base, segments: [{ taille, ecart, n, items, fusion, recent }], dernier, connus, total }.
     Bornes b_k = min(v_k … v_n) : croissantes, base + somme des segments = courant. */
  function decouper(courant, deltas) {
    var vn = typeof courant === 'number' && isFinite(courant) && courant > 0 ? courant : 0;
    var lst = [], i, j;
    for (i = 0; i < deltas.length; i++) {
      var d = deltas[i];
      if (!d || typeof d.ecart !== 'number' || !isFinite(d.ecart)) break;
      lst.push(d);
    }
    var m = lst.length;
    var res = { base: vn, segments: [], dernier: m ? lst[0].ecart : null, connus: m, total: vn };
    if (!m || vn <= 0) return res;
    var v = new Array(m + 1), b = new Array(m + 1);
    v[m] = vn;
    for (j = m; j >= 1; j--) v[j - 1] = v[j] - lst[m - j].ecart;
    b[m] = vn;
    for (j = m - 1; j >= 0; j--) b[j] = Math.max(0, Math.min(v[j], b[j + 1]));
    res.base = b[0];
    var segs = [];
    for (j = 1; j <= m; j++) {
      var t = b[j] - b[j - 1], it = lst[m - j];
      if (t > 0) segs.push({ taille: t, ecart: it.ecart, n: typeof it.n === 'number' && it.n > 0 ? it.n : 1, items: [it], fusion: false, recent: j === m });
    }
    var seuil = vn * SEG_MIN_PART, out = [];
    segs.forEach(function (s) {
      var dernier = out[out.length - 1];
      if (s.taille < seuil && dernier) fusionnerSeg(dernier, s); else out.push(s);
    });
    while (out.length > 1 && out[0].taille < seuil) { fusionnerSeg(out[0], out[1]); out.splice(1, 1); }
    if (out.length > SEG_MAX) {
      var k = out.length - SEG_MAX + 1, groupe = out[0]; /* le groupe compte pour 1 : SEG_MAX segments au total */
      for (i = 1; i < k; i++) fusionnerSeg(groupe, out[i]);
      out = [groupe].concat(out.slice(k));
    }
    res.segments = out;
    return res;
  }
  /* FIN decouper */

  function propre(o, k) { return o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
  /* écart d'une série dans le delta d'un relevé ; depot '' = global ; cle : nom, id, ou liste de noms (somme) */
  function ecartDe(d, depot, sorte, cle) {
    var b = depot ? propre(d.depots, depot) : d;
    if (!b || typeof b !== 'object') return 0;
    if (sorte === 'code') return num(b.code);
    var t = b[sorte];
    if (Array.isArray(cle)) return cle.reduce(function (s, c) { return s + num(propre(t, c)); }, 0);
    return num(propre(t, cle));
  }
  /* les delta ne valent que si le dernier relevé est celui des statistiques affichées */
  function deltasUtilisables() {
    var h = S.hist, e = h.length ? h[h.length - 1] : null;
    if (!e || !e.delta || typeof e.delta !== 'object') return false;
    return !(S.stats.empreinte && e.empreinte && e.empreinte !== S.stats.empreinte);
  }
  function itemReleve(e, depot, sorte, cle) {
    var d = e.delta, dd = d.depots && typeof d.depots === 'object' ? d.depots : {}, concernes = [], tous = [];
    Object.keys(dd).sort().forEach(function (nom) {
      if (depot && nom !== depot) return;
      var x = { nom: nom, court: dd[nom] && dd[nom].court, commits: dd[nom] && dd[nom].commits };
      tous.push(x);
      if (ecartDe(d, nom, sorte, cle) !== 0) concernes.push(x);
    });
    var liste = concernes.length ? concernes : tous, n = 0;
    liste.forEach(function (x) { n += typeof x.commits === 'number' && x.commits > 0 ? x.commits : 1; });
    return { ecart: ecartDe(d, depot, sorte, cle), date: e.maj, depots: liste, n: Math.max(1, n) };
  }
  /* relevés du plus récent au plus ancien, arrêt au premier sans delta */
  function serieDeltas(sorte, cle) {
    var out = [];
    if (!deltasUtilisables()) return out;
    for (var i = S.hist.length - 1; i >= 0; i--) {
      var e = S.hist[i];
      if (!e.delta || typeof e.delta !== 'object') break;
      out.push(itemReleve(e, S.depot, sorte, cle));
    }
    return out;
  }
  /* écart de la série au dernier relevé ; null si le dernier relevé n'a pas de delta (rien d'inventé) */
  function dernierEcart(sorte, cle, depot) {
    if (!deltasUtilisables()) return null;
    return ecartDe(S.hist[S.hist.length - 1].delta, depot || '', sorte, cle);
  }

  function libLignes(e) {
    var a = Math.abs(e);
    return (e < 0 ? '−' : e > 0 ? '+' : '') + nf.format(a) + (a > 1 ? ' lignes' : ' ligne');
  }
  /* badge « +1 234 » / « −56 » / « +0 » ; portee : 'dernier' (défaut) ou 'releve' (tableau de l'historique) */
  function badgeGain(ecart, portee) {
    if (typeof ecart !== 'number' || !isFinite(ecart)) return null;
    var quand = portee === 'releve' ? ' à ce relevé' : ' au dernier commit', a = Math.abs(ecart), cls, txt, lab;
    if (ecart > 0) { cls = 'gain'; txt = '+' + nf.format(a); lab = nf.format(a) + (a > 1 ? ' lignes ajoutées' : ' ligne ajoutée') + quand; }
    else if (ecart < 0) { cls = 'perte'; txt = '−' + nf.format(a); lab = nf.format(a) + (a > 1 ? ' lignes retirées' : ' ligne retirée') + quand; }
    else { cls = 'nul'; txt = '+0'; lab = 'Aucune ligne modifiée' + quand; }
    return el('span', { class: 'delta ' + cls, role: 'img', 'aria-label': lab, title: lab, text: txt });
  }

  function bulleSegment(s) {
    var lignes;
    if (s.fusion) {
      lignes = [{ lib: 'Période', val: dateCourte(s.items[0].date) + ' → ' + dateCourte(s.items[s.items.length - 1].date) },
        { lib: 'Lignes', val: libLignes(s.ecart) }];
      var rc = s.items[s.items.length - 1];
      if (s.recent && rc && rc.ecart > 0) lignes.push({ lib: 'Dont au dernier commit', val: libLignes(rc.ecart) });
      if (s.taille < s.ecart) lignes.push({ lib: 'Restant dans la barre', val: nf.format(s.taille) });
      return lignesBulle(libCommits(s.n), lignes);
    }
    var it = s.items[0];
    lignes = it.depots.map(function (d) { return { lib: d.nom, val: d.court || '–' }; });
    lignes.push({ lib: 'Lignes', val: libLignes(it.ecart) });
    if (s.taille < it.ecart) lignes.push({ lib: 'Restant dans la barre', val: nf.format(s.taille) });
    return lignesBulle(dateLongue(it.date), lignes);
  }
  /* barre segmentée réutilisable : r = decouper(...), couleur = fond de la base, largeurPct = largeur de la barre (%) */
  function barreSegmentee(r, couleur, largeurPct) {
    var cont = el('div', { class: 'segmentee', 'aria-hidden': 'true', css: { width: largeurPct.toFixed(2) + '%', '--seg-c': couleur } });
    if (!(r.total > 0)) return cont;
    function seg(taille, cls, fabrique) {
      var s = el('span', { class: cls, css: { flex: taille + ' 1 0px' } });
      cont.appendChild(fabrique ? avecBulle(s, fabrique) : s);
    }
    if (r.base > 0) {
      seg(r.base, 'seg-base', r.connus > 0 ? function () {
        return lignesBulle('Avant le suivi par commit', [{ lib: 'Lignes', val: nf.format(r.base) }]);
      } : null);
    }
    r.segments.forEach(function (s, i) {
      seg(s.taille, 'seg ' + (i % 2 ? 'seg-a' : 'seg-b') + (s.recent && !s.fusion && r.dernier > 0 ? ' seg-dernier' : ''), function () { return bulleSegment(s); });
    });
    return cont;
  }
  var NOTE_SEG = ' Chaque barre se découpe par commit (survol d’un segment) ; la partie hachurée est le dernier commit.';

  /* ---------- langages ---------- */
  function rendreLangages() {
    var b = bloc(), langs = (b.langages || []).slice().sort(function (x, y) { return num(y.code) - num(x.code); });
    var total = num((b.lignes || {}).code);
    vider($('empile-langages')).appendChild(barreEmpilee(langs, total, 'Répartition des lignes de code par langage ; valeurs dans le tableau ci-dessous'));
    var max = langs.reduce(function (m, l) { return Math.max(m, num(l.code)); }, 0);
    var seg = false;
    var t = vider($('table-langages'));
    t.appendChild(el('caption', { class: 'vh' }, 'Lignes de code par langage'));
    t.appendChild(el('thead', null, el('tr', null,
      el('th', { scope: 'col', text: 'Langage' }), el('th', { scope: 'col' }, el('span', { class: 'vh' }, 'Barre')),
      el('th', { scope: 'col', class: 'num', text: 'Code' }), el('th', { scope: 'col', class: 'num col-part', text: 'Part' }),
      el('th', { scope: 'col', class: 'num col-fichiers', text: 'Fichiers' }))));
    var corps = el('tbody');
    langs.forEach(function (l) {
      var r = decouper(num(l.code), serieDeltas('langage', l.nom));
      if (r.segments.length) seg = true;
      corps.appendChild(el('tr', null,
        el('th', { scope: 'row' }, el('span', { class: 'nom-l' },
          el('i', { class: 'carre', css: { background: couleurLangage(l.nom) } }), l.nom,
          l.maison ? el('span', { class: 'badge', text: 'maison' }) : null)),
        el('td', { class: 'piste', 'aria-hidden': 'true' }, el('div', { class: 'piste-fond' },
          barreSegmentee(r, couleurLangage(l.nom), max > 0 ? 100 * num(l.code) / max : 0))),
        el('td', { class: 'num' }, nf.format(num(l.code)), badgeGain(dernierEcart('langage', l.nom, S.depot))),
        el('td', { class: 'num part col-part', text: pct(num(l.code), total) }),
        el('td', { class: 'num col-fichiers', text: nf.format(num(l.fichiers)) })));
    });
    if (!langs.length) corps.appendChild(el('tr', null, el('td', { colspan: '5', class: 'vide-note', text: 'Aucun fichier compté dans cette vue.' })));
    t.appendChild(corps);
    $('note-langages').textContent = (S.depot ? 'Dépôt ' + S.depot + ' : l' : 'L') + 'ignes de code par langage, hors commentaires et lignes vides.' + (seg ? NOTE_SEG : '');
  }

  /* ---------- types ---------- */
  function rendreTypes() {
    var b = bloc(), total = num((b.lignes || {}).code);
    var ordre = (S.stats.types || []).map(function (t) { return t.id; });
    var types = (b.types || []).slice().sort(function (x, y) { return num(y.code) - num(x.code) || ordre.indexOf(x.id) - ordre.indexOf(y.id); });
    var max = types.reduce(function (m, t) { return Math.max(m, num(t.code)); }, 0);
    var seg = false;
    var t = vider($('table-types'));
    t.appendChild(el('caption', { class: 'vh' }, 'Lignes de code par type de fichier'));
    t.appendChild(el('thead', null, el('tr', null,
      el('th', { scope: 'col', text: 'Type' }), el('th', { scope: 'col' }, el('span', { class: 'vh' }, 'Barre')),
      el('th', { scope: 'col', class: 'num', text: 'Code' }), el('th', { scope: 'col', class: 'num col-part', text: 'Part' }),
      el('th', { scope: 'col', class: 'num col-fichiers', text: 'Fichiers' }))));
    var corps = el('tbody');
    types.forEach(function (ty) {
      var info = S.typesLib[ty.id] || { libelle: ty.id, description: '' };
      var r = decouper(num(ty.code), serieDeltas('type', ty.id));
      if (r.segments.length) seg = true;
      corps.appendChild(el('tr', null,
        el('th', { scope: 'row' }, info.libelle, info.description ? el('span', { class: 'sous-type', text: info.description }) : null),
        el('td', { class: 'piste', 'aria-hidden': 'true' }, el('div', { class: 'piste-fond' },
          barreSegmentee(r, 'var(--chaleur)', max > 0 ? 100 * num(ty.code) / max : 0))),
        el('td', { class: 'num' }, nf.format(num(ty.code)), badgeGain(dernierEcart('type', ty.id, S.depot))),
        el('td', { class: 'num part col-part', text: pct(num(ty.code), total) }),
        el('td', { class: 'num col-fichiers', text: nf.format(num(ty.fichiers)) })));
    });
    if (!types.length) corps.appendChild(el('tr', null, el('td', { colspan: '5', class: 'vide-note', text: 'Aucun fichier compté dans cette vue.' })));
    t.appendChild(corps);
    $('note-types').textContent = 'Rôle du fichier, déduit de son dossier, de son nom ou de son extension.' + (seg ? NOTE_SEG : '');
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
    var gTotal = choisi ? null : dernierEcart('code', null, '');
    if (gTotal != null) {
      var gt = svg.appendChild(sv('text', { x: 90, y: 129, 'text-anchor': 'middle', class: 'anneau-centre-gain ' + (gTotal > 0 ? 'gain' : gTotal < 0 ? 'perte' : 'nul') }));
      gt.textContent = (gTotal > 0 ? '+' : gTotal < 0 ? '−' : '+') + nf.format(Math.abs(gTotal));
      gt.appendChild(sv('title')).textContent = (badgeGain(gTotal).getAttribute('aria-label'));
    }
    zone.appendChild(svg);
    var liste = el('ul', { class: 'liste-anneau' + (deltasUtilisables() ? ' avec-gain' : '') });
    deps.forEach(function (d) {
      var c = num((d.lignes || {}).code);
      liste.appendChild(el('li', { class: choisi && choisi.nom !== d.nom ? 'eteint' : null },
        el('i', { class: 'pastille', css: { background: couleurDepot(d.nom) } }),
        el('span', { class: 'nom-depot', text: d.nom }), el('span', { class: 'num', text: nf.format(c) }),
        badgeGain(dernierEcart('code', null, d.nom)), el('span', { class: 'num part', text: pct(c, total) })));
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
          el('div', null, el('dt', { text: 'Code' }), el('dd', null, nf.format(code), badgeGain(dernierEcart('code', null, d.nom)))),
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
            el('span', { text: cm.date ? dateCourte(cm.date) : 'date inconnue' }),
            typeof d.commits === 'number' ? el('span', { class: 'commit-nb', text: libCommits(d.commits) }) : null),
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
      var dl = e.delta && typeof e.delta === 'object' ? e.delta : null;
      corps.appendChild(el('tr', null, el('td', { text: dateCourte(e.maj) }),
        el('td', { class: 'num' }, nf.format(num(e.code)), dl ? badgeGain(num(dl.code), 'releve') : null),
        noms.map(function (n) { return el('td', { class: 'num' }, nf.format(num((e.par_depot || {})[n])), dl ? badgeGain(ecartDe(dl, n, 'code'), 'releve') : null); })));
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
      svg.appendChild(sv('text', { x: X(tt), y: H - 8, 'text-anchor': anc, class: 'axe' })).textContent = (t1 - t0 < 7 * 864e5 ? dfAxeHeure : dfAxe).format(new Date(tt));
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
        lignes.push({ depot: d.nom, langage: l.nom, maison: !!l.maison, fichiers: num(l.fichiers), code: c, commentaires: cm, vides: vi, total: c + cm + vi,
          gain: dernierEcart('langage', l.nom, d.nom) });
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
    var gainTot = 0, gainConnu = lignes.length > 0;
    var LIMITE = 25;
    lignes.forEach(function (l, i) {
      for (var k in tot) tot[k] += l[k];
      if (l.gain == null) gainConnu = false; else gainTot += l.gain;
      if (!S.toutDetail && i >= LIMITE) return;
      corps.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'depot-cell' }, el('i', { class: 'pastille', css: { background: couleurDepot(l.depot) } }), l.depot)),
        el('td', null, el('span', { class: 'nom-l' }, el('i', { class: 'carre', css: { background: couleurLangage(l.langage) } }), l.langage,
          l.maison ? el('span', { class: 'badge', text: 'maison' }) : null)),
        ['fichiers', 'code', 'commentaires', 'vides', 'total'].map(function (k) {
          return el('td', { class: 'num col-' + k }, nf.format(l[k]), k === 'code' ? badgeGain(l.gain) : null);
        })));
    });
    if (!lignes.length) corps.appendChild(el('tr', null, el('td', { colspan: '7', class: 'vide-note', text: 'Aucun fichier compté dans cette vue.' })));
    t.appendChild(corps);
    t.appendChild(el('tfoot', null, el('tr', null, el('th', { scope: 'row', colspan: '2', text: 'Total (' + lignes.length + ' couples dépôt × langage)' }),
      ['fichiers', 'code', 'commentaires', 'vides', 'total'].map(function (k) {
        return el('td', { class: 'num col-' + k }, nf.format(tot[k]), k === 'code' && gainConnu ? badgeGain(gainTot) : null);
      }))));
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

  /* ---------- commits : flottant, sondage, notifications ---------- */
  /* Le flottant affiche global.commits (contrat v2). Toutes les 60 s (paramètre de test ?sondage=<s>),
     data/stats.json est relu ; si son empreinte change, les vues sont redessinées sur place et chaque
     dépôt dont le nombre de commits ou le sha a changé reçoit une notification, avec un « plop »
     synthétisé par Web Audio (aucun fichier audio). ?demo-commit=1 montre une notification de
     démonstration 3 s après le chargement, sur le dernier vrai commit du dépôt le plus récent. */
  var CLE_SON = 'stats-son';
  var DUREE_TOAST = 8000, DELAI_REQUETE = 20000, SHA_GARDES = 64;
  /* vus : shas déjà affichés par dépôt ; un sha déjà vu n'est jamais réannoncé (réponse périmée d'un nœud
     de cache, retour arrière d'un déploiement, puis retour au fichier neuf) */
  var C = { intervalle: 60000, minuterie: 0, enCours: false, dernier: 0, uStats: '', uHist: '', anim: 0, audio: null, son: true, fermeSurvol: 0, pouls: 0, vus: {}, sig: '' };
  /* téléphone ou écran bas : deux notifications au plus, pour ne pas couvrir la page */
  function maxToasts() { return window.innerHeight <= 480 ? 1 : window.innerWidth <= 680 || window.innerHeight <= 640 ? 2 : 4; }
  function signature(st) {
    var g = st.global || {}, L = g.lignes || {};
    return [st.empreinte, st.version, num(g.commits), num(L.code), num(L.total), num(g.fichiers)].join('|');
  }
  function memoriserVus(st) {
    (st.depots || []).forEach(function (d) {
      var sha = (d.commit || {}).sha;
      if (!sha) return;
      var l = C.vus[d.nom] || (C.vus[d.nom] = []);
      if (l.indexOf(sha) < 0) { l.push(sha); if (l.length > SHA_GARDES) l.shift(); }
    });
    C.sig = signature(st);
  }
  function dejaVu(d) { var sha = (d.commit || {}).sha; return !!sha && (C.vus[d.nom] || []).indexOf(sha) >= 0; }
  var mouvementReduit = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }) : null;

  function lireSon() { try { return localStorage.getItem(CLE_SON) !== '0'; } catch (e) { return true; } }
  function ecrireSon(v) { try { if (v) localStorage.removeItem(CLE_SON); else localStorage.setItem(CLE_SON, '0'); } catch (e) { /* stockage indisponible */ } }
  function aCommits(st) { return !!(st && st.global && typeof st.global.commits === 'number' && isFinite(st.global.commits)); }
  function libCommits(n) { return nf.format(n) + (n > 1 ? ' commits' : ' commit'); }
  function tronquer(t, n) { var c = Array.from(String(t || '')); return c.length > n ? c.slice(0, n - 1).join('').replace(/\s+$/, '') + '…' : c.join(''); }
  function anciennete(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var s = (Date.now() - t) / 1000;
    if (s < 45) return 'à l’instant';
    if (!rtf) return dateCourte(iso);
    var u = s < 3600 ? ['minute', 60] : s < 86400 ? ['hour', 3600] : s < 2592000 ? ['day', 86400] : s < 31536000 ? ['month', 2592000] : ['year', 31536000];
    return rtf.format(-Math.max(1, Math.round(s / u[1])), u[0]);
  }

  /* son : l'AudioContext ne naît que dans un geste de l'utilisateur (règle d'autoplay des navigateurs) */
  function deverrouillerSon() {
    if (!C.audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return Promise.resolve();
      try { C.audio = new AC(); } catch (e) { C.audio = null; return Promise.resolve(); }
    }
    if (C.audio.state === 'suspended' && C.audio.resume) return C.audio.resume().catch(function () { /* refusé */ });
    return Promise.resolve();
  }
  var GESTES = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'];
  /* un événement synthétique (element.click() d'un script) n'est pas un geste : pas d'AudioContext, pas d'avertissement */
  function gesteActif() { return !navigator.userActivation || navigator.userActivation.isActive; }
  function surGeste(e) {
    /* son coupé : aucun contexte audio ; l'interrupteur le créera lui-même s'il est rallumé */
    if (!C.son || !e.isTrusted || !gesteActif()) return;
    deverrouillerSon().then(function () {
      if (C.audio && C.audio.state === 'running') GESTES.forEach(function (g) { document.removeEventListener(g, surGeste, true); });
    });
  }
  function plop() {
    var c = C.audio;
    if (!C.son || !c || c.state !== 'running') return;
    try {
      var t = c.currentTime + 0.01, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.11);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(c.destination);
      o.onended = function () { o.disconnect(); g.disconnect(); };
      o.start(t); o.stop(t + 0.13);
    } catch (e) { /* son indisponible */ }
  }
  function iconeSon(actif) {
    var s = sv('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(sv('path', { d: 'M4 9.5v5h3.5l4.5 4v-13l-4.5 4z', fill: 'currentColor' }));
    s.appendChild(sv('path', { d: actif ? 'M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a7.8 7.8 0 0 1 0 11.2' : 'M15.5 9.5l5 5M20.5 9.5l-5 5',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    return s;
  }
  function rendreSon() {
    var b = $('flottant-son');
    vider(b).appendChild(iconeSon(C.son));
    b.setAttribute('aria-pressed', String(C.son));
    b.title = C.son ? 'Son des notifications : activé' : 'Son des notifications : coupé';
  }

  /* flottant */
  function compteur(de, a) {
    var v = $('flottant-val');
    cancelAnimationFrame(C.anim);
    $('flottant-total').setAttribute('aria-label', libCommits(a) + ' au total, détail par dépôt');
    if (typeof de !== 'number' || de === a || mouvementReduit.matches) { v.textContent = libCommits(a); return; }
    var t0 = 0, duree = 900;
    function pas(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 3);
      v.textContent = libCommits(Math.round(de + (a - de) * e));
      if (k < 1) C.anim = requestAnimationFrame(pas);
    }
    C.anim = requestAnimationFrame(pas);
  }
  function rendreFlottant(de) {
    var st = S.stats, f = $('flottant'), bt = $('flottant-total');
    f.hidden = false;
    document.body.classList.add('avec-flottant');
    /* données v1 : pas de total, mais l'interrupteur du son reste, car les notifications (sur le sha) sonnent aussi */
    if (!aCommits(st)) {
      bt.hidden = true;
      f.classList.remove('ouvert', 'survol');
      bt.setAttribute('aria-expanded', 'false');
      vider($('flottant-detail'));
      return;
    }
    bt.hidden = false;
    var deps = st.depots.filter(function (d) { return typeof d.commits === 'number'; })
      .sort(function (a, b) { return b.commits - a.commits || a.nom.localeCompare(b.nom, 'fr'); });
    var max = deps.reduce(function (m, d) { return Math.max(m, d.commits); }, 0);
    var z = vider($('flottant-detail'));
    z.appendChild(el('p', { class: 'fd-titre', text: 'Commits par dépôt' }));
    z.appendChild(el('ul', { class: 'fd-liste' }, deps.map(function (d) {
      return el('li', null, el('i', { class: 'pastille', css: { background: couleurDepot(d.nom) } }), el('span', { class: 'fd-nom', text: d.nom }),
        el('span', { class: 'fd-barre', 'aria-hidden': 'true' }, el('span', { css: { width: (max > 0 ? 100 * d.commits / max : 0).toFixed(1) + '%', background: couleurDepot(d.nom) } })),
        el('span', { class: 'num', text: nf.format(d.commits) }));
    })));
    z.appendChild(el('p', { class: 'fd-total' }, el('span', { text: 'Total' }), el('span', { class: 'num', text: nf.format(st.global.commits) })));
    z.appendChild(el('p', { class: 'fd-note', text: 'Branche publiée de chaque dépôt, relevé du ' + dateCourte(st.maj) + '.' }));
    compteur(de, st.global.commits);
  }
  function poulser() {
    var f = $('flottant');
    clearTimeout(C.pouls);
    f.classList.remove('neuf');
    void f.offsetWidth; // relance l'animation
    f.classList.add('neuf');
    C.pouls = setTimeout(function () { f.classList.remove('neuf'); }, 2600);
  }
  function installerFlottant() {
    var f = $('flottant'), bt = $('flottant-total');
    C.son = lireSon();
    rendreSon();
    function ouvrir(v) { f.classList.toggle('ouvert', v); bt.setAttribute('aria-expanded', String(v)); if (!v) f.classList.remove('survol'); }
    bt.addEventListener('click', function () { ouvrir(!f.classList.contains('ouvert')); });
    bt.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { clearTimeout(C.fermeSurvol); f.classList.add('survol'); } });
    f.addEventListener('pointerenter', function () { clearTimeout(C.fermeSurvol); });
    f.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') C.fermeSurvol = setTimeout(function () { f.classList.remove('survol'); }, 220);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && f.classList.contains('ouvert')) { ouvrir(false); bt.focus(); } });
    document.addEventListener('pointerdown', function (e) { if (f.classList.contains('ouvert') && !f.contains(e.target)) ouvrir(false); });
    $('flottant-son').addEventListener('click', function () {
      C.son = !C.son;
      ecrireSon(C.son);
      rendreSon();
      if (C.son && gesteActif()) deverrouillerSon().then(plop);
    });
    GESTES.forEach(function (g) { document.addEventListener(g, surGeste, { capture: true, passive: true }); });
  }

  /* notifications */
  function boutonFermer() {
    return el('button', { type: 'button', class: 'toast-fermer', 'aria-label': 'Fermer la notification', title: 'Fermer' }, el('span', { 'aria-hidden': 'true', text: '×' }));
  }
  function lienSha(d) {
    var cm = d.commit || {};
    return cm.sha && d.url ? el('a', { class: 'commit-sha', href: d.url + '/commit/' + cm.sha, rel: 'noopener', title: 'Voir le commit sur GitHub' }, cm.court || String(cm.sha).slice(0, 7))
      : el('span', { class: 'commit-sha', text: cm.court || '–' });
  }
  function ecartCommits(d, avant) {
    return avant && typeof avant.commits === 'number' && typeof d.commits === 'number' ? d.commits - avant.commits : null;
  }
  /* plus de dépôts changés que de places : une seule notification les regroupe, aucun n'est perdu */
  function notifierGroupe(liste, avant) {
    var fermer = boutonFermer();
    var t = el('div', { class: 'toast', css: { '--toast-c': 'var(--accent)' } },
      el('img', { class: 'toast-logo', src: 'assets/favicon.svg?v=3', alt: '', width: '28', height: '28' }),
      el('div', { class: 'toast-corps' },
        el('p', { class: 'toast-titre', text: 'Nouveaux commits sur ' + liste.length + ' dépôts' }),
        el('ul', { class: 'toast-liste' }, liste.map(function (d) {
          var e = ecartCommits(d, avant[d.nom]);
          return el('li', null, el('i', { class: 'pastille', css: { background: couleurDepot(d.nom) } }), el('span', { class: 'toast-depot', text: d.nom }),
            lienSha(d), e > 0 ? el('span', { class: 'toast-quand', text: '+' + nf.format(e) }) : null);
        }))),
      fermer);
    afficherToast(t, fermer);
  }
  function notifier(d, avant, demo) {
    var cm = d.commit || {};
    var delta = ecartCommits(d, avant);
    var titre = demo ? 'Démonstration : nouveau commit sur ' + d.nom
      : !avant ? 'Nouveau dépôt compté : ' + d.nom
      : delta > 1 ? nf.format(delta) + ' nouveaux commits sur ' + d.nom
      : delta !== null && delta <= 0 ? 'Dernier commit changé sur ' + d.nom
      : 'Nouveau commit sur ' + d.nom;
    var fermer = boutonFermer();
    var quand = [anciennete(cm.date), typeof d.commits === 'number' ? libCommits(d.commits) + ' au total' : ''].filter(Boolean).join(' · ');
    var t = el('div', { class: 'toast', css: { '--toast-c': couleurDepot(d.nom) } },
      el('img', { class: 'toast-logo', src: logoDepot(d.nom), alt: '', width: '28', height: '28' }),
      el('div', { class: 'toast-corps' },
        el('p', { class: 'toast-titre', text: titre }),
        el('p', { class: 'toast-commit' }, lienSha(d),
          el('span', { class: 'toast-msg', title: cm.message || '', text: tronquer(cm.message, 90) || 'Sans message' })),
        quand ? el('p', { class: 'toast-quand', text: quand }) : null),
      fermer);
    afficherToast(t, fermer);
  }
  function afficherToast(t, fermer) {
    var zone = $('toasts'), minut = 0, reste = DUREE_TOAST, debut = 0;
    function lancer() { if (minut || !t.parentNode) return; debut = Date.now(); minut = setTimeout(retirer, reste); }
    function pause() { if (!minut) return; clearTimeout(minut); minut = 0; reste = Math.max(1500, reste - (Date.now() - debut)); }
    function retirer() {
      clearTimeout(minut); minut = 0;
      if (!t.parentNode || t.classList.contains('sortie')) return;
      if (t.contains(document.activeElement)) {
        /* le focus passe à la notification voisine, sinon au compteur, sinon à l'interrupteur du son */
        var voisins = Array.prototype.filter.call(zone.querySelectorAll('.toast:not(.sortie) .toast-fermer'), function (b) { return !t.contains(b); });
        var cible = voisins[voisins.length - 1] || (!$('flottant-total').hidden ? $('flottant-total') : $('flottant-son'));
        if (cible) cible.focus();
      }
      if (mouvementReduit.matches) { t.remove(); return; }
      t.classList.add('sortie');
      setTimeout(function () { t.remove(); }, 220);
    }
    fermer.addEventListener('click', retirer);
    t.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); retirer(); } });
    t.addEventListener('pointerenter', pause);
    t.addEventListener('pointerleave', lancer);
    t.addEventListener('focusin', pause);
    t.addEventListener('focusout', function (e) { if (!t.contains(e.relatedTarget)) lancer(); });
    var max = maxToasts();
    while (zone.children.length >= max) {
      /* la plus ancienne part, sauf celle qui a le focus clavier */
      var vieux = Array.prototype.filter.call(zone.children, function (x) { return !x.contains(document.activeElement); })[0];
      if (!vieux) break;
      zone.removeChild(vieux);
    }
    zone.appendChild(t);
    lancer();
  }
  function signaler() { plop(); if (!$('flottant').hidden) poulser(); }

  /* sondage de data/stats.json */
  function planifier(delai) {
    clearTimeout(C.minuterie); C.minuterie = 0;
    if (document.hidden) return;
    C.minuterie = setTimeout(sonder, delai == null ? C.intervalle : delai);
  }
  /* délai borné : une requête pendue ne doit pas laisser enCours à vrai et arrêter le sondage pour de bon */
  function lireFrais(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var garde = ctl ? setTimeout(function () { ctl.abort(); }, DELAI_REQUETE) : 0;
    return fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { clearTimeout(garde); return j; }, function (e) { clearTimeout(garde); throw e; });
  }
  function sonder() {
    C.minuterie = 0;
    if (C.enCours || document.hidden) return;
    C.enCours = true;
    C.dernier = Date.now();
    lireFrais(C.uStats).then(function (st) {
      /* signature : empreinte, version et totaux ; un recomptage à HEAD égaux (règles changées) redessine aussi, sans notifier */
      if (!valide(st) || (st.exemple && !S.exemple) || signature(st) === C.sig) return null;
      return lireFrais(C.uHist).catch(function () { return null; }).then(function (h) { appliquerNouvelles(st, h); });
    }).catch(function () { /* réseau ou fichier en cours de déploiement : nouvel essai au prochain tour */ })
      .then(function () { C.enCours = false; planifier(); });
  }
  function appliquerNouvelles(st, h) {
    var ancien = S.stats, avant = {};
    ancien.depots.forEach(function (d) { avant[d.nom] = d; });
    /* un dépôt n'est annoncé que pour un sha jamais affiché par cette page : pas de double annonce
       si un nœud de cache rend un instant l'ancien fichier, pas d'annonce d'un simple recomptage */
    var changes = st.depots.filter(function (d) {
      var a = avant[d.nom];
      if (!a) return !dejaVu(d);
      /* moins de commits qu'avant : réponse périmée (ou historique réécrit) ; vues redessinées, pas d'annonce */
      if (typeof d.commits === 'number' && typeof a.commits === 'number' && d.commits < a.commits) return false;
      return (d.commit || {}).sha !== (a.commit || {}).sha && !dejaVu(d);
    });
    var de = aCommits(ancien) ? ancien.global.commits : null;
    var focus = memoFocus();
    installerDonnees(st, h);
    memoriserVus(st);
    if (S.depot && !st.depots.some(function (d) { return d.nom === S.depot; })) {
      S.depot = '';
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* adresse inchangée */ }
    }
    rendreEntete(); rendreFiltre(); rendreVues(); rendreFlottant(de);
    rendreFocus(focus);
    chargerSuppl();
    if (changes.length > maxToasts()) notifierGroupe(changes, avant);
    else changes.forEach(function (d) { notifier(d, avant[d.nom] || null, false); });
    if (changes.length) signaler();
  }
  /* le redessin remplace les boutons (puces, tri, cartes) : le focus clavier revient au même rang du même conteneur */
  var FOCUSABLES = 'a[href], button, summary, [tabindex]:not([tabindex="-1"])';
  function memoFocus() {
    var a = document.activeElement;
    if (!a || a === document.body || !a.closest) return null;
    var hote = a.parentElement && a.parentElement.closest('[id]');
    if (!hote) return null;
    return { el: a, hote: hote.id, rang: Array.prototype.indexOf.call(hote.querySelectorAll(FOCUSABLES), a) };
  }
  function rendreFocus(m) {
    if (!m || m.el.isConnected || m.rang < 0) return;
    var hote = $(m.hote), liste = hote ? hote.querySelectorAll(FOCUSABLES) : [];
    var cible = liste[Math.min(m.rang, liste.length - 1)];
    if (cible) cible.focus({ preventScroll: true });
  }
  function demarrerSondage(params) {
    var s = parseFloat(params.get('sondage'));
    if (isFinite(s) && s > 0) C.intervalle = Math.round(Math.min(3600, Math.max(2, s)) * 1000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearTimeout(C.minuterie); C.minuterie = 0; return; }
      if (C.enCours) return;
      if (Date.now() - C.dernier > 5000) sonder(); else planifier();
    });
    planifier();
    if (params.get('demo-commit') === '1') {
      setTimeout(function () {
        var d = S.stats.depots.slice().sort(function (a, b) { return (Date.parse((b.commit || {}).date) || 0) - (Date.parse((a.commit || {}).date) || 0); })[0];
        if (d) { notifier(d, null, true); signaler(); }
      }, 3000);
    }
  }

  /* ---------- avancement des tasks et tokens (data/tasks.json, tasks-historique.json, tokens.json) ---------- */
  /* Fichiers facultatifs : s'ils manquent ou sont illisibles, la section ou le badge reste caché. */
  var T = { tasks: null, hist: [], tokens: null, spec: '' };
  var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function abregeFr(n) {
    if (n >= 1e9) return nf2.format(n / 1e9) + ' Md';
    if (n >= 1e6) return nf2.format(n / 1e6) + ' M';
    if (n >= 1e3) return nf2.format(n / 1e3) + ' k';
    return nf.format(n);
  }
  function jetonsValide(t) {
    return t && typeof t === 'object' && typeof t.total === 'number' && t.total >= 0 && t.categories && typeof t.categories === 'object';
  }
  var CATS_JETONS = [['entree', 'Entrée'], ['sortie', 'Sortie'], ['cache_ecriture', 'Écriture du cache'], ['cache_lecture', 'Lecture du cache']];
  function rendreJetons() {
    var t = T.tokens, zone = $('jetons');
    if (!jetonsValide(t)) { zone.hidden = true; document.body.classList.remove('avec-jetons'); return; }
    zone.hidden = false;
    document.body.classList.add('avec-jetons');
    var releve = typeof t.commits_au_releve === 'number' ? 'relevé au commit ' + nf.format(t.commits_au_releve) : 'relevé';
    var quand = t.mesure && !isNaN(Date.parse(t.mesure)) ? ', ' + dateCourte(t.mesure) : '';
    $('jetons-val').textContent = abregeFr(t.total);
    $('jetons-bouton').title = nf.format(t.total) + ' tokens : détail par catégorie';
    $('jetons-sous').textContent = releve + quand;
    var d = vider($('jetons-detail'));
    d.appendChild(el('div', { class: 'jetons-ligne jetons-ligne-total' }, el('span', { text: 'Total' }), el('span', { text: nf.format(t.total) })));
    CATS_JETONS.forEach(function (c) {
      d.appendChild(el('div', { class: 'jetons-ligne' }, el('span', { text: c[1] }), el('span', { text: nf.format(num(t.categories[c[0]])) })));
    });
    d.appendChild(el('p', { class: 'jetons-note', text: 'Somme des quatre catégories pour le projet depuis le début, ' + releve + quand + '. Actualisé tous les 50 commits.'
      + (typeof t.messages === 'number' ? ' ' + nf.format(t.messages) + ' réponses, ' + nf.format(num(t.sessions)) + ' sessions, ' + nf.format(num(t.sous_agents)) + ' sous-agents.' : '') }));
  }
  function installerJetons() {
    var b = $('jetons-bouton'), d = $('jetons-detail');
    function ouvrir(o) { d.hidden = !o; b.setAttribute('aria-expanded', String(o)); }
    b.addEventListener('click', function () { ouvrir(d.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !d.hidden) { ouvrir(false); b.focus(); } });
    document.addEventListener('pointerdown', function (e) { if (!d.hidden && !$('jetons').contains(e.target)) ouvrir(false); });
  }

  function tasksValide(t) { return t && typeof t === 'object' && t.specs && typeof t.specs === 'object' && typeof t.total === 'number' && t.total > 0; }
  /* [faites, total] d'un relevé pour la spec choisie ('' = total) ; null si la spec n'y figure pas */
  function paire(spec, e) {
    if (!spec) return [num(e.faites), num(e.total)];
    var p = propre(e.specs, spec);
    return Array.isArray(p) ? [num(p[0]), num(p[1])] : null;
  }
  function barreAvance(f, t, cls) {
    return el('div', { class: 'avance' + (cls ? ' ' + cls : ''), role: 'img', 'aria-label': nf.format(f) + ' tasks faites sur ' + nf.format(t) },
      el('span', { css: { width: (t > 0 ? 100 * f / t : 0).toFixed(2) + '%' }, class: f >= t && t > 0 ? 'fini' : null }));
  }
  function rendreTasks() {
    var sec = $('bloc-tasks'), t = T.tasks;
    if (!tasksValide(t)) { sec.hidden = true; return; }
    sec.hidden = false;
    var noms = Object.keys(t.specs).sort();
    if (T.spec && noms.indexOf(T.spec) < 0) T.spec = '';
    $('note-tasks').textContent = 'Cases cochées sur le total des tasks de chaque spec, d’après la branche docs (commit ' + (t.sha || '–') + ', ' + dateCourte(t.maj) + ').';
    var f = num(t.faites), tot = num(t.total);
    vider($('tasks-total')).appendChild(el('div', null,
      el('div', { class: 'chiffre-ligne' }, el('span', { class: 'chiffre-val', text: nf.format(f) + ' / ' + nf.format(tot) }),
        el('span', { class: 'chiffre-sous', text: pct(f, tot) + ' des tasks faites' })),
      barreAvance(f, tot, 'grande')));
    var tb = vider($('table-tasks'));
    tb.appendChild(el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Spec' }), el('th', { scope: 'col', text: 'Avancement' }),
      el('th', { scope: 'col', class: 'num', text: 'Faites / total' }), el('th', { scope: 'col', class: 'num col-part', text: 'Part' }))));
    var corps = el('tbody');
    function ligne(nom, lib, fa, to) {
      var b = el('button', { type: 'button', class: 'spec-choix', 'aria-pressed': String(T.spec === nom), text: lib,
        title: nom ? 'Afficher l’évolution de cette spec' : 'Afficher l’évolution du total' });
      b.addEventListener('click', function () { T.spec = T.spec === nom ? '' : nom; rendreTasks(); });
      return el('tr', { class: T.spec === nom ? 'choisie' : null },
        el('th', { scope: 'row', class: 'tasks-spec' }, b),
        el('td', { class: 'piste' }, barreAvance(fa, to)),
        el('td', { class: 'num', text: nf.format(fa) + ' / ' + nf.format(to) }),
        el('td', { class: 'num col-part', text: pct(fa, to) }));
    }
    corps.appendChild(ligne('', 'Total', f, tot));
    noms.forEach(function (n) { var s = t.specs[n]; corps.appendChild(ligne(n, n, num(s.faites), num(s.total))); });
    tb.appendChild(corps);
    rendreCourbeTasks();
  }
  function releves() {
    return T.hist.filter(function (e) { return paire(T.spec, e); });
  }
  function rendreCourbeTasks() {
    var h = releves(), lib = T.spec || 'toutes les specs';
    $('note-tasks-courbe').textContent = 'Faites et total pour ' + lib + ' : un point par commit de la branche docs qui change un fichier de tasks, ' + h.length + ' relevés.';
    var leg = vider($('legende-tasks'));
    leg.appendChild(el('span', null, el('i', { css: { background: 'var(--accent)' } }), 'Faites'));
    leg.appendChild(el('span', null, el('i', { class: 'tirets' }), 'Total'));
    var t = vider($('table-tasks-hist'));
    t.appendChild(el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Date' }), el('th', { scope: 'col', text: 'Commit' }),
      el('th', { scope: 'col', class: 'num', text: 'Faites' }), el('th', { scope: 'col', class: 'num', text: 'Total' }), el('th', { scope: 'col', class: 'num', text: 'Part' }))));
    var corps = el('tbody');
    h.slice().reverse().forEach(function (e) {
      var p = paire(T.spec, e);
      corps.appendChild(el('tr', null, el('td', { text: dateCourte(e.maj) }), el('td', null, el('code', { text: e.sha || '–' })),
        el('td', { class: 'num', text: nf.format(p[0]) }), el('td', { class: 'num', text: nf.format(p[1]) }), el('td', { class: 'num', text: pct(p[0], p[1]) })));
    });
    t.appendChild(corps);
    dessinerCourbeTasks();
  }
  function dessinerCourbeTasks() {
    var zone = $('courbe-tasks');
    if ($('bloc-tasks').hidden) return;
    vider(zone);
    var h = releves();
    if (h.length < 2) { zone.appendChild(el('p', { class: 'vide-note', text: 'Pas encore assez de relevés pour tracer une courbe.' })); return; }
    var W = Math.max(280, zone.clientWidth), H = 260, mg = { g: 48, d: 14, h: 12, b: 28 };
    var fa = h.map(function (e) { return paire(T.spec, e)[0]; }), to = h.map(function (e) { return paire(T.spec, e)[1]; });
    var vmax = Math.max.apply(null, to.concat(fa)), ech = echelleNette(vmax), n = h.length;
    function X(i) { return mg.g + (W - mg.g - mg.d) * i / (n - 1); }
    function Y(v) { return mg.h + (H - mg.h - mg.b) * (1 - v / ech.max); }
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': 'Courbe des tasks faites et du total, ' + n + ' relevés du ' + dateCourte(h[0].maj) + ' au ' + dateCourte(h[n - 1].maj) + ' ; valeurs dans le tableau « Voir les valeurs de l’évolution »' });
    for (var v = 0; v <= ech.max + 1e-9; v += ech.pas) {
      svg.appendChild(sv('line', { x1: mg.g, x2: W - mg.d, y1: Y(v), y2: Y(v), class: v === 0 ? 'base' : 'grille' }));
      svg.appendChild(sv('text', { x: mg.g - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'axe' })).textContent = abrege(v);
    }
    var nTicks = Math.max(2, Math.min(6, Math.floor((W - mg.g - mg.d) / 90)));
    for (var k = 0; k < nTicks; k++) {
      var i = Math.round((n - 1) * k / (nTicks - 1));
      svg.appendChild(sv('text', { x: X(i), y: H - 8, 'text-anchor': k === 0 ? 'start' : k === nTicks - 1 ? 'end' : 'middle', class: 'axe' })).textContent = dfAxe.format(new Date(h[i].maj));
    }
    function chemin(val) { return val.map(function (y, j) { return (j ? 'L' : 'M') + X(j).toFixed(1) + ' ' + Y(y).toFixed(1); }).join(' '); }
    var dF = chemin(fa);
    svg.appendChild(sv('path', { d: chemin(to), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': '5 4' }, { fill: 'none', stroke: 'var(--texte-2)' }));
    svg.appendChild(sv('path', { d: dF + ' L' + X(n - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0).toFixed(1) + ' ' + Y(0) + ' Z' }, { fill: 'color-mix(in srgb, var(--accent) 14%, transparent)' }));
    svg.appendChild(sv('path', { d: dF, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, { fill: 'none', stroke: 'var(--accent)' }));
    if (n <= 80) h.forEach(function (e, j) { svg.appendChild(sv('circle', { cx: X(j), cy: Y(fa[j]), r: 2.5 }, { fill: 'var(--accent)' })); });
    svg.appendChild(sv('circle', { cx: X(n - 1), cy: Y(fa[n - 1]), r: 4, 'stroke-width': 2 }, { fill: 'var(--accent)', stroke: 'var(--surface)' }));
    var repere = sv('line', { y1: mg.h, y2: H - mg.b, class: 'repere', visibility: 'hidden' });
    svg.appendChild(repere);
    var pF = sv('circle', { r: 4.5, 'stroke-width': 2, visibility: 'hidden' }, { fill: 'var(--accent)', stroke: 'var(--surface)' });
    var pT = sv('circle', { r: 4.5, 'stroke-width': 2, visibility: 'hidden' }, { fill: 'var(--texte-2)', stroke: 'var(--surface)' });
    svg.appendChild(pT); svg.appendChild(pF);
    var cible = sv('rect', { x: mg.g, y: 0, width: W - mg.g - mg.d, height: H, fill: 'transparent' });
    svg.appendChild(cible);
    function survol(e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
      var j = Math.max(0, Math.min(n - 1, Math.round((x - mg.g) / (W - mg.g - mg.d) * (n - 1))));
      repere.setAttribute('x1', X(j)); repere.setAttribute('x2', X(j)); repere.setAttribute('visibility', 'visible');
      pF.setAttribute('cx', X(j)); pF.setAttribute('cy', Y(fa[j])); pF.setAttribute('visibility', 'visible');
      pT.setAttribute('cx', X(j)); pT.setAttribute('cy', Y(to[j])); pT.setAttribute('visibility', 'visible');
      montrerBulle(lignesBulle(dateCourte(h[j].maj) + ' · ' + (h[j].sha || ''), [
        { lib: 'Faites', val: nf.format(fa[j]) + ' (' + pct(fa[j], to[j]) + ')', couleur: 'var(--accent)' },
        { lib: 'Total', val: nf.format(to[j]), couleur: 'var(--texte-2)' }]), e.clientX, e.clientY);
    }
    cible.addEventListener('pointermove', survol);
    cible.addEventListener('pointerdown', survol);
    cible.addEventListener('pointerleave', function () {
      repere.setAttribute('visibility', 'hidden'); pF.setAttribute('visibility', 'hidden'); pT.setAttribute('visibility', 'hidden'); cacherBulle();
    });
    zone.appendChild(svg);
  }
  /* lecture facultative, rechargée avec les statistiques (nouvelle empreinte) */
  function chargerSuppl() {
    if (S.exemple) { T.tasks = null; T.hist = []; T.tokens = null; rendreTasks(); rendreJetons(); return Promise.resolve(); }
    return Promise.all([charger('data/tasks.json', false), charger('data/tasks-historique.json', false), charger('data/tokens.json', false)]).then(function (r) {
      T.tasks = tasksValide(r[0]) ? r[0] : null;
      T.hist = (Array.isArray(r[1]) ? r[1] : []).filter(function (e) { return e && !isNaN(Date.parse(e.maj)) && typeof e.faites === 'number' && typeof e.total === 'number'; })
        .sort(function (a, b) { return Date.parse(a.maj) - Date.parse(b.maj); });
      T.tokens = jetonsValide(r[2]) ? r[2] : null;
      rendreTasks(); rendreJetons();
    }).catch(function () { /* sections facultatives : elles restent cachées */ });
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
  /* contrat v1 ou v2 : la v2 ajoute global.commits et depots[].commits, lus seulement s'ils sont là */
  function installerDonnees(st, hist) {
    S.stats = st;
    S.typesLib = {};
    (st.types || []).forEach(function (t) { S.typesLib[t.id] = t; });
    if (Array.isArray(hist) || !S.hist.length) {
      S.hist = (Array.isArray(hist) ? hist : []).filter(function (e) { return e && !isNaN(Date.parse(e.maj)); })
        .sort(function (a, b) { return Date.parse(a.maj) - Date.parse(b.maj); });
    }
    S.couleurs = {};
    attribuerCouleurs();
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
    installerFlottant();
    installerJetons();

    var params = new URLSearchParams(location.search);
    S.exemple = params.get('donnees') === 'exemple';
    var uStats = S.exemple ? 'data/exemple.json' : 'data/stats.json';
    var uHist = S.exemple ? 'data/exemple-historique.json' : 'data/historique.json';
    $('bandeau-exemple').hidden = !S.exemple;

    Promise.all([charger(uStats, true), charger(uHist, false)]).then(function (res) {
      var st = res[0];
      if (!valide(st)) { erreur('Statistiques illisibles', 'Le fichier ' + uStats + ' ne suit pas le format attendu (version 1 ou 2). Relancez le générateur puis poussez ce dépôt.'); return; }
      if (st.exemple && !S.exemple) { erreur('Données d’exemple refusées', 'Le fichier ' + uStats + ' contient des chiffres d’exemple. Relancez le générateur pour produire les vrais chiffres.'); return; }
      installerDonnees(st, res[1]);
      memoriserVus(st);
      var ancre = decodeURIComponent(location.hash.slice(1));
      if (st.depots.some(function (d) { return d.nom === ancre; })) S.depot = ancre;
      Array.prototype.forEach.call($('contenu').children, function (n) {
        if (n.id !== 'erreur' && n.id !== 'bloc-historique' && n.id !== 'bloc-tasks') n.hidden = n.id === 'chargement';
      });
      rendreEntete(); rendreFiltre(); rendreVues(); rendreFlottant(null);
      chargerSuppl();
      window.addEventListener('hashchange', function () {
        var h = decodeURIComponent(location.hash.slice(1));
        var nom = S.stats.depots.some(function (d) { return d.nom === h; }) ? h : '';
        if (nom !== S.depot) choisirDepot(nom);
      });
      if (window.ResizeObserver) {
        var attente = 0, largeur = $('courbe').clientWidth;
        new ResizeObserver(function () {
          var w = $('courbe').clientWidth;
          if (w === largeur) return;
          largeur = w; cancelAnimationFrame(attente); attente = requestAnimationFrame(dessinerCourbe);
        }).observe($('courbe'));
        var attenteT = 0, largeurT = $('courbe-tasks').clientWidth;
        new ResizeObserver(function () {
          var w = $('courbe-tasks').clientWidth;
          if (w === largeurT) return;
          largeurT = w; cancelAnimationFrame(attenteT); attenteT = requestAnimationFrame(dessinerCourbeTasks);
        }).observe($('courbe-tasks'));
      }
      C.uStats = uStats; C.uHist = uHist;
      demarrerSondage(params);
    }).catch(function (e) {
      if (e && e.statut === 404) erreur('Statistiques pas encore générées', 'Le fichier ' + uStats + ' est introuvable. Lancez le générateur décrit dans le README, puis poussez ce dépôt : Vercel publiera la page à jour.');
      else erreur('Chargement impossible', 'Les statistiques n’ont pas pu être lues (' + (e && e.message ? e.message : 'erreur inconnue') + '). Rechargez la page dans un instant.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
