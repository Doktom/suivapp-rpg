# Point d'étape et reprise — mis à jour le 11 novembre 2026 (V0.4 en ligne, phase de test et d'ajustement)

À lire en début de session (avec `CLAUDE.md`). À mettre à jour à chaque fin d'étape.

## Où on en est

| Version | Contenu | État |
|---|---|---|
| V0.1 — MVP | Habitudes simples / durée / quantité, catalogue, séries et jour de grâce, XP et niveaux, tâches, listes, blocs | ✅ codée |
| V0.2 — Profondeur | Niveaux, routines, habitudes à éviter, fréquences (mois, tous les N jours, semaine, week-end), tâches récurrentes, checklists, agenda jour / semaine / mois + événements ; annulation, agenda cliquable, suppression d'habitude, export JSON, thème sombre, XP réglables | ✅ codée |
| V0.3 — Entraînement | Étape 1 : sport en salle, séance guidée, chrono, finisher · Étape 2 : progression, records, volume, éditeur de programme · Étape 3 : mobilité guidée au chrono · Étape 4 : danse (cours, soirées, figures, objectifs) | ✅ étapes 1 à 5 codées et en ligne |
| V0.4 — Confort | Encart « Entraînement du jour » (Aujourd'hui), statistiques et cartes de chaleur (Trophées), PWA installable, rappels (Réglages) | ✅ codée, en phase de test et d'ajustement |

Contrôles du point d'étape : 59 tests au vert, build OK, parcours complet sur une base vierge (habitude, tâche, séance de sport, routine de mobilité, danse, agenda, progression) sans erreur dans la console, affichage vérifié à 375 px et sur PC, thème clair et sombre.

## Hébergement : phase de test, puis serveur privé

- **Maintenant (phase de test)** : l'app se construit et se teste au fur et à mesure sur GitHub Pages (https://doktom.github.io/suivapp/), **sans connexion et sans Supabase** : les données restent dans le navigateur de chaque appareil (pas de synchronisation téléphone / PC). Sauvegarde : Réglages → Exporter mes données. Claude pousse directement sur `main` ; le site se redéploie en 1 à 2 min.
- **À la toute fin** : installation sur le serveur privé de l'utilisateur, **atj-app.com** (hébergement o2switch : Apache + PHP, cPanel, envoi des fichiers par FileZilla). Version prévue :
  - l'app compilée, déposée par FTP dans un dossier (ex. `atj-app.com/suivapp/`, avec une base Vite relative) ;
  - un fichier `api.php` + une base SQLite dans un seul fichier (synchronisation téléphone / PC, sauvegarde par copie du fichier), branché via l'interface `Repo` de `src/data/repo.ts` ;
  - pas d'écran de connexion dans l'app : mot de passe posé sur le dossier depuis le cPanel (une fois par appareil) ;
  - import de l'export JSON pour récupérer les données de la phase de test.
- Supabase (`supabase/*.sql`, mode Supabase de `repo.ts`) n'est plus utilisé ; le code reste en place tant que la version serveur n'existe pas.

## Premiers pas dans l'app (côté utilisateur)
- Saisir les cours fixes de danse (Entraînement → Danse → Cours fixes).
- Ajuster les routines de mobilité de départ et les finishers (ce sont des suggestions).
- Ne pas ajouter d'habitudes sport, étirement ou « Cours de danse » : c'est l'Entraînement qui s'en charge. Si une routine d'étirement existe en habitude, l'importer depuis Entraînement → Mobilité.

## Étape 5 (côté ludique) : faite et en ligne (branche `etape-5-ludique` fusionnée dans `main`)

- **Onglet Trophées** (remplace Progression, dans la barre du bas sur téléphone) : niveau et caractéristiques (+ caractéristique chouchoute), bilan de la semaine habitudes + entraînement (taux de réussite, journées parfaites, sport, volume, mobilité, danse, tâches, XP) comparé à la semaine d'avant, **petites victoires** des 14 derniers jours, **régularité** (journées parfaites et série de journées parfaites, semaines complètes = un oubli max par habitude et quotas tenus, mois complets ≥ 90 %, séries en cours et records de série), **stats décalées** (profil du matin / du soir, jour fort, journée record, coches, temps investi et tonnage avec équivalences, jours de résistance, habitude la plus fidèle / la plus boudée), derniers records, badges.
- Logique des habitudes dans `src/domain/fun.ts` (testée dans `fun.test.ts`) ; 15 badges habitudes et tâches en plus des 23 de l'entraînement.
- L'Entraînement garde son bandeau de la semaine, qui mène à l'onglet Trophées.

- **Bilan de la semaine** : bandeau en haut de l'Entraînement (séances, kg, records, routines, danse, XP, badges) ; vue **Trophées** avec la semaine en cours ou la précédente, comparées à la semaine d'avant.
- **Badges** : 23, calculés depuis l'historique (`src/training/achievements.ts`), +20 XP chacun, date d'obtention retrouvée.
- **Objectifs sport** (Sport → Objectifs) : charge ou répétitions sur un exercice (meilleure performance), séances ou tonnage depuis le début ; moyens d'y arriver à cocher ; +50 XP une fois atteint.
- **Records** : fil des derniers records (Sport → Séances et Trophées) ; la fin de séance affiche le gain sur l'ancien record et les badges débloqués.
- Nouvelle table `training_goals` (ajoutée à `migration_v0.3.sql` et `schema.sql`).

## V0.4 (11 novembre 2026)
- **Encart « Entraînement du jour »** sur Aujourd'hui : prochaine séance de sport, cours de danse du jour, routines de mobilité (cochées si faites). Logique : `src/training/today.ts`.
- **Statistiques** (Trophées) : cartes de chaleur habitudes et entraînement sur 20 semaines, réussite par jour de la semaine, tendance sur 12 semaines. Logique : `src/domain/stats.ts`.
- **PWA** : `public/manifest.webmanifest`, `public/sw.js` (réseau d'abord, cache en secours), icônes générées dans `public/icons/`. Installation : « Ajouter à l'écran d'accueil ».
- **Rappels** (Réglages, par appareil) : matin et soir, résumé de ce qu'il reste à faire. Sans serveur, ils partent quand l'app est ouverte ou active en arrière-plan (`ReminderRunner`) ; de vrais rappels poussés viendront avec la version serveur. Sur iPhone, installer d'abord l'app.
- Non vérifié : le service worker n'a pas pu s'enregistrer dans le navigateur intégré de Claude ; à tester sur un vrai téléphone / Chrome.

## Prochaine étape : phase de test et d'ajustement
Utilisateur teste l'app en ligne et note les ajustements ; Claude les traite et pousse sur `main`.

## Autres pistes (à proposer avant de coder)

- Programme « maison » à construire ensemble.
- À la toute fin : version serveur sur atj-app.com (voir plus haut).

## Questions ouvertes
- Programme de séances à la maison : à construire ensemble.
- Récompenses réelles : forme et fonctionnement.
- Valeurs d'XP et courbe de niveau : à ajuster à l'usage (les valeurs des habitudes et tâches sont déjà réglables dans Réglages ; celles de l'entraînement ne le sont pas encore).

## Points à surveiller
- Phase de test : chaque appareil a ses propres données ; exporter régulièrement (Réglages) pour pouvoir les réimporter dans la version finale.
- Les séances en cours sont gardées dans le navigateur de l'appareil où elles ont commencé.
- Les données pré-chargées (programme, routines, finishers) ne se recréent pas tant qu'il en existe ; supprimer tout le programme ne le recharge pas.
