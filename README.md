<p align="center"><img src="assets/favicon.svg" alt="Logo Ultra Smart SMP" width="96"></p>

# Statistiques du code

<p align="center">
  <a href="http://stats.smp.ecartdescartes.org"><img src="https://img.shields.io/badge/Voir%20les%20statistiques-stats.smp.ecartdescartes.org-22D3EE?style=for-the-badge&labelColor=0B1220" alt="Voir les statistiques : stats.smp.ecartdescartes.org"></a>
</p>

Site statique qui affiche le nombre de lignes de code des dépôts de l'organisation **UltraSmartSMP** : par dépôt et au global, par langage (langages maison compris) et par type de fichier. Hébergé par Vercel, redéployé à chaque push sur ce dépôt.

## Ce que montre la page

- chiffres clés : lignes de code, fichiers, langages, part des langages maison ;
- répartition par langage (badge « maison » pour RSMP, SMPA, RSMP IR, SMPA ISA, SMPI) et par type de fichier ;
- part de chaque dépôt (anneau) et tableau croisé langage × type ;
- une carte par dépôt : dernier commit compté, totaux, répartition par langage, lien GitHub ;
- historique du total et de chaque dépôt (affiché dès qu'il y a au moins deux relevés) ;
- avancement des tasks spec-kit (cases cochées sur total, par spec et au total) avec la courbe de son évolution commit par commit, générés par `moteur-orchestration/stats_tasks.py` (`data/tasks.json`, `data/tasks-historique.json`) ;
- une barre fixe en haut à gauche : tokens utilisés pour le projet depuis le début (somme entrée, sortie, écriture et lecture de cache), relevée tous les 50 commits par `stats_tokens.py` (`data/tokens.json`, aucun contenu de transcription) ;
- tableau détaillé triable par dépôt et par langage ;
- un filtre par dépôt qui met à jour toutes les vues (adresse `…/#moteur` pour y revenir) ;
- un compteur flottant en bas de l'écran : le nombre total de commits des dépôts comptés, et au survol ou au clic le détail par dépôt ;
- une notification flottante, avec un petit son « plop », quand un dépôt reçoit un nouveau commit pendant que la page est ouverte.

### Compteur de commits et notifications

La page relit `data/stats.json` toutes les 60 secondes (`fetch` sans cache), et seulement quand l'onglet est visible : le sondage s'arrête quand l'onglet passe en arrière-plan et reprend aussitôt au retour. Si l'empreinte, la version ou les totaux ont changé, toutes les vues se redessinent sur place (le filtre, le tri, l'historique ouvert et le focus clavier restent), le compteur glisse vers la nouvelle valeur, et chaque dépôt dont le dernier commit a changé reçoit une notification : couleur et logo du dépôt, sha court, message tronqué, ancienneté. Elle disparaît après 8 secondes (le temps s'arrête tant que le pointeur ou le focus est dessus) ; le bouton × ou la touche Échap la ferme.

Un sha déjà affiché par la page n'est jamais réannoncé, et un dépôt dont le nombre de commits baisse (réponse périmée d'un nœud de cache, retour arrière d'un déploiement) est redessiné sans notification. Quatre notifications au plus s'empilent (deux sur téléphone ou écran bas, une sous 480 px de haut) ; s'il y a plus de dépôts changés que de places, une seule notification les regroupe. Une requête sans réponse est abandonnée après 20 secondes.

Une notification ne peut arriver qu'après un redéploiement de Vercel, donc au rythme de la synchronisation (10 minutes au plus, plus la durée du déploiement).

Le son est synthétisé dans la page par Web Audio (oscillateur sinus d'environ 120 ms, fréquence descendante, volume modéré) : aucun fichier audio. Les navigateurs interdisent le son avant un geste de l'utilisateur ; la page attend donc le premier clic, toucher ou appui de touche pour ouvrir son contexte audio, et reste muette jusque-là. L'interrupteur à droite du compteur coupe ou rétablit le son ; le choix est gardé dans le navigateur (`localStorage`, clé `stats-son`). Les animations respectent `prefers-reduced-motion`.

Avec des données de version 1 (sans nombres de commits), le compteur est masqué, mais l'interrupteur du son reste affiché ; les notifications se fondent sur le seul changement de sha.

Aucune dépendance JavaScript : graphiques en SVG faits main, thème clair et sombre, lisible sur téléphone.

## Contenu du dépôt

| chemin | rôle |
|---|---|
| `index.html` | la page |
| `assets/style.css`, `assets/app.js` | style et logique de la page |
| `assets/favicon.svg`, `assets/depots/*.svg` | logo de l'organisation et logos des dépôts |
| `data/stats.json` | statistiques courantes (contrat de données version 2, voir plus bas), **écrit par le générateur** |
| `data/historique.json` | un relevé par changement de commit d'un dépôt, 500 au plus, **écrit par le générateur** |
| `data/descriptions.json` | cache des descriptions GitHub des dépôts, **écrit par le générateur** |
| `data/exemple.json`, `data/exemple-historique.json` | chiffres fictifs pour le développement de la page, en contrat version 1 ; jamais chargés sans `?donnees=exemple` (bandeau « Données d'exemple » affiché) et non publiés : la synchronisation les exclut du dépôt `stats` |
| `vercel.json` | configuration Vercel : site statique, en-têtes de cache et de sécurité |

Ne modifiez pas les fichiers `data/stats.json` et `data/historique.json` à la main : ils sont réécrits à la prochaine synchronisation.

## D'où viennent les données

Le générateur `moteur-orchestration/stats_org.py` (dépôt de travail du projet, hors de ce dépôt) :

1. liste les fichiers suivis par git de chaque dépôt publié (`git ls-files`, lecture seule) ;
2. écarte les binaires (`.smpb`, `.smpo`, `.bin`, images, archives, tout fichier non UTF-8 qui contient un octet nul ou dont plus de 1 % des octets sont nuls), le code tiers embarqué (dossiers `third_party`, `vendor`), les liens symboliques et les sous-modules ; un fichier UTF-8 qui contient un octet nul isolé (un caractère nul littéral dans une source) reste compté ;
3. compte les lignes avec [cloc 2.06](https://github.com/AlDanial/cloc) et les définitions des langages maison (`stats_org_langs.txt`) ;
4. classe chaque fichier par type (source, tests, bancs, scripts, build et config, documentation, données) d'après son dossier, son nom ou son extension ;
5. compte les commits de la branche publiée de chaque dépôt (`git rev-list --count HEAD`, lecture seule ; une copie superficielle est refusée, car son nombre serait tronqué) ;
6. écrit `data/stats.json` et ajoute un relevé à `data/historique.json`.

### Contrat de données

Version 2 (le champ `version` vaut 2). Elle ajoute à la version 1, que la page sait toujours lire :

| champ | contenu |
|---|---|
| `depots[].commits` | nombre de commits de la branche publiée du dépôt |
| `global.commits` | somme des `depots[].commits` |
| relevés de `historique.json` : `commits` | total des commits au moment du relevé (absent des relevés antérieurs à la version 2) |

Champs déjà présents en version 1 et utilisés par les notifications : `empreinte` (empreinte des HEAD comptés) et `depots[].commit` (`sha`, `court`, `date` en UTC, `message` : première ligne, adresses e-mail masquées). Le générateur n'écrit ni auteur ni adresse e-mail, et refuse d'écrire un fichier qui en contiendrait une.

Le champ `maj` est la date du commit le plus récent parmi les dépôts comptés, jamais l'heure d'exécution. Si aucun dépôt n'a changé de commit, le générateur n'écrit rien : pas de commit à vide, pas de redéploiement inutile. Exceptions : si `stats_org.py` ou `stats_org_langs.txt` est plus récent que `data/stats.json` (les règles ont changé), ou si `data/stats.json` suit une autre version du contrat, il recompte.

## Mise à jour automatique

`moteur-orchestration/sync-github.ps1` pousse les dépôts de l'organisation toutes les 10 minutes. Après ces pushes, il lance le générateur, recopie ce dossier (`github-org/stats/`) dans la copie de travail `B:/smp-github/stats` et pousse le dépôt `stats` s'il a changé. Vercel, relié à ce dépôt, redéploie à chaque push.

La copie de travail `B:/smp-github/stats` doit exister pour que cette étape tourne ; sans elle, la synchronisation l'ignore.

Pas de `.gitignore` propre à ce dossier : la synchronisation ne le recopie pas et écrit dans la copie de travail le `.gitignore` commun des dépôts de l'organisation (`*.tmp`, `*.log`, `build/`…), qui couvre déjà le fichier temporaire du générateur. La recopie se fait en miroir (`robocopy /MIR`) : un fichier supprimé ici disparaît aussi du dépôt `stats` ; les fichiers `exemple*.json` ne sont jamais recopiés.

## Déploiement Vercel

1. Sur vercel.com : **Add New → Project**, importer `UltraSmartSMP/stats`.
2. Framework : **Other**. Aucune commande de build ni d'installation, dossier de sortie : la racine.
3. Branche de production : la branche par défaut du dépôt.

`vercel.json` règle le reste :

- `cleanUrls` : la page est servie à la racine, sans `.html` ;
- `Cache-Control: no-cache` sur `/data/*` : chaque visite revalide les statistiques ;
- cache d'un an sur `/assets/*` : quand `style.css`, `app.js` ou un logo change, augmentez le paramètre `?v=` de son lien dans `index.html` (et, pour les logos, dans `logoDepot` de `app.js`) ;
- en-têtes de sécurité : `Content-Security-Policy` stricte (aucun script, style ni ressource externe ; aucun script ni style en ligne), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, et `X-Robots-Tag: noindex` (la page ne doit pas être indexée). Le sondage passe par `connect-src 'self'` ; le son, synthétisé par Web Audio, ne demande aucune directive : la politique n'a pas été élargie.

À vérifier avant la première mise en ligne : l'offre gratuite de Vercel n'accepte pas toujours un dépôt privé appartenant à une organisation GitHub. Si l'import est refusé, il faut une équipe Vercel payante ou un dépôt `stats` public (il ne contient que des chiffres agrégés, les nombres de commits, les descriptions et les derniers messages de commit).

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

Paramètres de test (à combiner) :

- `?demo-commit=1` : une notification de démonstration, titrée « Démonstration », apparaît 3 secondes après le chargement ; elle reprend le dernier vrai commit du dépôt le plus récent, sans toucher au compteur. Le son ne joue que si la page a déjà reçu un clic ou une touche ;
- `?sondage=5` : relit `data/stats.json` toutes les 5 secondes au lieu de 60 (2 à 3 600). Pour voir une vraie détection en local, remplacez `data/stats.json` d'une copie servie du site par un autre fichier généré : la page doit annoncer chaque dépôt changé sans se recharger.

## Licence

Propriétaire, comme les autres dépôts de l'organisation.
