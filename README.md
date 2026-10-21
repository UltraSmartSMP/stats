<p align="center"><img src="assets/favicon.svg" alt="Logo Ultra Smart SMP" width="96"></p>

# Statistiques du code

Site statique qui affiche le nombre de lignes de code des dépôts de l'organisation **UltraSmartSMP** : par dépôt et au global, par langage (langages maison compris) et par type de fichier. Hébergé par Vercel, redéployé à chaque push sur ce dépôt.

## Ce que montre la page

- chiffres clés : lignes de code, fichiers, langages, part des langages maison ;
- répartition par langage (badge « maison » pour RSMP, SMPA, RSMP IR, SMPA ISA, SMPI) et par type de fichier ;
- part de chaque dépôt (anneau) et tableau croisé langage × type ;
- une carte par dépôt : dernier commit compté, totaux, répartition par langage, lien GitHub ;
- historique du total et de chaque dépôt (affiché dès qu'il y a au moins deux relevés) ;
- tableau détaillé triable par dépôt et par langage ;
- un filtre par dépôt qui met à jour toutes les vues (adresse `…/#moteur` pour y revenir).

Aucune dépendance JavaScript : graphiques en SVG faits main, thème clair et sombre, lisible sur téléphone.

## Contenu du dépôt

| chemin | rôle |
|---|---|
| `index.html` | la page |
| `assets/style.css`, `assets/app.js` | style et logique de la page |
| `assets/favicon.svg`, `assets/depots/*.svg` | logo de l'organisation et logos des dépôts |
| `data/stats.json` | statistiques courantes (contrat de données version 1), **écrit par le générateur** |
| `data/historique.json` | un relevé par changement de commit d'un dépôt, 500 au plus, **écrit par le générateur** |
| `data/descriptions.json` | cache des descriptions GitHub des dépôts, **écrit par le générateur** |
| `data/exemple.json`, `data/exemple-historique.json` | chiffres fictifs pour le développement de la page ; publiés avec le site mais jamais chargés sans `?donnees=exemple` (bandeau « Données d'exemple » affiché) |
| `vercel.json` | configuration Vercel : site statique, en-têtes de cache et de sécurité |

Ne modifiez pas les fichiers `data/stats.json` et `data/historique.json` à la main : ils sont réécrits à la prochaine synchronisation.

## D'où viennent les données

Le générateur `moteur-orchestration/stats_org.py` (dépôt de travail du projet, hors de ce dépôt) :

1. liste les fichiers suivis par git de chaque dépôt publié (`git ls-files`, lecture seule) ;
2. écarte les binaires (`.smpb`, `.smpo`, `.bin`, images, archives, tout fichier non UTF-8 qui contient un octet nul ou dont plus de 1 % des octets sont nuls), le code tiers embarqué (dossiers `third_party`, `vendor`), les liens symboliques et les sous-modules ; un fichier UTF-8 qui contient un octet nul isolé (un caractère nul littéral dans une source) reste compté ;
3. compte les lignes avec [cloc 2.06](https://github.com/AlDanial/cloc) et les définitions des langages maison (`stats_org_langs.txt`) ;
4. classe chaque fichier par type (source, tests, bancs, scripts, build et config, documentation, données) d'après son dossier, son nom ou son extension ;
5. écrit `data/stats.json` et ajoute un relevé à `data/historique.json`.

Le champ `maj` est la date du commit le plus récent parmi les dépôts comptés, jamais l'heure d'exécution. Si aucun dépôt n'a changé de commit, le générateur n'écrit rien : pas de commit à vide, pas de redéploiement inutile. Exception : si `stats_org.py` ou `stats_org_langs.txt` est plus récent que `data/stats.json`, il recompte (les règles ont changé).

## Mise à jour automatique

`moteur-orchestration/sync-github.ps1` pousse les dépôts de l'organisation toutes les 10 minutes. Après ces pushes, il lance le générateur, recopie ce dossier (`github-org/stats/`) dans la copie de travail `B:/smp-github/stats` et pousse le dépôt `stats` s'il a changé. Vercel, relié à ce dépôt, redéploie à chaque push.

La copie de travail `B:/smp-github/stats` doit exister pour que cette étape tourne ; sans elle, la synchronisation l'ignore.

Pas de `.gitignore` propre à ce dossier : la synchronisation ne le recopie pas et écrit dans la copie de travail le `.gitignore` commun des dépôts de l'organisation (`*.tmp`, `*.log`, `build/`…), qui couvre déjà le fichier temporaire du générateur. La recopie se fait sans miroir : un fichier supprimé ici doit aussi être supprimé à la main de `B:/smp-github/stats`.

## Déploiement Vercel

1. Sur vercel.com : **Add New → Project**, importer `UltraSmartSMP/stats`.
2. Framework : **Other**. Aucune commande de build ni d'installation, dossier de sortie : la racine.
3. Branche de production : la branche par défaut du dépôt.

`vercel.json` règle le reste :

- `cleanUrls` : la page est servie à la racine, sans `.html` ;
- `Cache-Control: no-cache` sur `/data/*` : chaque visite revalide les statistiques ;
- cache d'un an sur `/assets/*` : quand `style.css`, `app.js` ou un logo change, augmentez le paramètre `?v=` de son lien dans `index.html` (et, pour les logos, dans `logoDepot` de `app.js`) ;
- en-têtes de sécurité : `Content-Security-Policy` stricte (aucun script, style ni ressource externe ; aucun script ni style en ligne), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, et `X-Robots-Tag: noindex` (la page ne doit pas être indexée).

À vérifier avant la première mise en ligne : l'offre gratuite de Vercel n'accepte pas toujours un dépôt privé appartenant à une organisation GitHub. Si l'import est refusé, il faut une équipe Vercel payante ou un dépôt `stats` public (il ne contient que des chiffres agrégés, les descriptions et les derniers messages de commit).

## Relancer le générateur à la main

```powershell
python -X utf8 -I "B:\SMP's\moteur-orchestration\stats_org.py" --worktrees B:\smp-github --sortie "B:\SMP's\github-org\stats\data"
```

Options : `--forcer` réécrit même si aucun commit n'a changé ; `--depots moteur,langage` limite le comptage ; `--verifier` recompte le dépôt `langage` par un cloc direct et compare. Codes de retour : 0 (fait ou inchangé), 2 (erreur), 3 (écart au `--verifier`).

## Travailler sur la page

Servez le dossier en local, puis ouvrez la page avec les chiffres d'exemple :

```powershell
python -X utf8 -I -m http.server 8137 --bind 127.0.0.1 --directory "B:\SMP's\github-org\stats"
```

- vrais chiffres : `http://127.0.0.1:8137/`
- chiffres d'exemple : `http://127.0.0.1:8137/?donnees=exemple` (un bandeau le signale)

La page n'affiche jamais l'exemple par défaut, et refuse un `stats.json` marqué `"exemple": true`.

## Licence

Propriétaire, comme les autres dépôts de l'organisation.
