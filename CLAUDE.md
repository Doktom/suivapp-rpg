# CLAUDE.md — contexte du projet

## Projet
**Suivapp RPG** : la variante « RPG coloré et décalé » de Suivapp. Webapp **personnelle** (un seul utilisateur) de suivi d'habitudes, de tâches, d'agenda et d'**entraînement** (sport, mobilité, danse), avec une gamification RPG (XP, niveaux, caractéristiques). Mêmes fonctions que Suivapp V0.4 ; ce qui change, c'est l'habillage, le ton et la mise en scène de la progression. Direction artistique **« Taverne en pagaille »** (BD cartoon : fond parchemin, contours épais, ombres franches, autocollants colorés, tavernier moqueur), mobile d'abord, thème clair / sombre.

- Ce dépôt part du tag `v0.4-base` de `Doktom/suivapp` (la version sobre et zen). **Ne jamais rien développer ni pousser dans `Doktom/suivapp` depuis ici.**
- Spécification fonctionnelle de référence : `docs/CAHIER_DES_CHARGES.md` (héritée de Suivapp). Les planches des 3 directions artistiques proposées sont dans `docs/maquettes/directions.html` (A retenue).
- `docs/REPRISE.md` est hérité de Suivapp et décrit la version sobre : ne le mettre à jour que si l'utilisateur le demande.
- Dépôt GitHub public : `Doktom/suivapp-rpg`. Production : https://doktom.github.io/suivapp-rpg/

## État actuel (2026-11-12)
- **Étape 1 de la version RPG faite** : thème « Taverne en pagaille » (`src/index.css`), composants de base (`src/components/ui.tsx`), navigation, module `src/rpg/` (héros, tavernier, boss de la semaine, célébrations), écrans **Taverne** (Aujourd'hui) et **Butin** (Trophées) refaits, vocabulaire RPG sur les autres écrans.
- **Reste à faire, écran par écran** : mise en scène propre du Livre des quêtes (Habitudes), du Donjon (Entraînement : séance guidée, mobilité, danse), des Missions (Tâches), de l'Agenda et de l'Arrière-boutique (Réglages). Ils héritent déjà du thème par les variables et les classes communes, mais pas encore d'une composition dédiée. Icônes de l'app (PWA) encore celles de Suivapp.
- Version `package.json` : 0.4.0. 90 tests (Vitest) au vert (81 hérités + 9 pour `src/rpg/`), build OK.
- **Phase de test** : le site GitHub Pages est construit **sans Supabase**, donc sans connexion ; les données restent dans le navigateur. Les deux sites partagent le domaine `doktom.github.io` : le stockage local utilise le préfixe **`suivapp-rpg:`** pour ne jamais lire ni écrire les données de Suivapp. Pour reprendre ses données : Réglages → « Copier depuis Suivapp… » (`src/rpg/suivappCopy.ts` : copie à sens unique des clés `suivapp:*`, Suivapp n'est jamais modifié ; le bouton n'apparaît que si Suivapp a des données dans ce navigateur). Il n'y a pas d'import de fichier JSON.

## Vocabulaire RPG (à tenir partout dans l'interface)
- Habitude = **quête** ; tâche = **mission** (sous-tâche = étape) ; Entraînement = **donjon** ; Trophées = **butin** ; Aujourd'hui = **taverne** (le tableau des quêtes) ; Réglages = arrière-boutique.
- Le **tavernier** commente (bulles `KeeperSays`) : humour pince-sans-rire, tutoiement, jamais culpabilisant. Les répliques sont dans `src/rpg/lore.ts` (choix stable par jour, pas d'aléatoire à chaque rendu).
- Le code, les tables et les types gardent les noms d'origine (`habits`, `tasks`, `training_*`) : seul le texte affiché change. Le texte des rappels (`src/data/reminders.ts`, testé) est resté celui de Suivapp.

## Façon de travailler avec l'utilisateur
- Échanges, documentation et textes de l'interface **en français** ; code (noms, commentaires) **en anglais**.
- Pour une demande ouverte (« améliore », « propose ») : **proposer d'abord** une liste priorisée, attendre son choix, puis coder.
- Rester **simple** : il a refusé le suivi trop détaillé (verres d'eau, nombre de pas). Le sur-mesure est réservé à l'Entraînement.
- **Livraison (phase de test)** : il construit et teste l'app au fur et à mesure sur GitHub Pages. Claude **pousse sur `main`** une fois l'étape validée (tests + build verts) ; le site se redéploie seul. S'il demande une branche, travailler dessus, l'envoyer, puis fusionner dans `main` seulement quand il dit oui. Après un envoi, suivre le déploiement (`gh run watch`) et vérifier la page en ligne. Le zip via l'interface web de GitHub a échoué (dossiers non envoyés) : ne plus le proposer.
- En fin d'étape : tests + build + essai dans le navigateur (mobile 375 px et PC, console sans erreur), puis mise à jour de `CLAUDE.md`, du cahier des charges et de `docs/REPRISE.md`.

## Commandes
```bash
npm ci            # dépendances
npm run dev       # http://localhost:5173/suivapp-rpg/ (le chemin /suivapp-rpg/ est obligatoire)
npm test          # Vitest
npm run build     # tsc -b puis vite build (fait aussi par la CI avant déploiement)
```
`.claude/launch.json` déclare le serveur de dev pour l'aperçu de Claude Code.

## Carte du code
```
src/
  App.tsx, main.tsx          routes par hash (#today, #habits, #training…), connexion Supabase, ErrorBoundary, thème
  rpg/                       MISE EN SCÈNE RPG (ne change aucune règle : lit ce que le domaine calcule)
    lore.ts                  pur et testé (rpg.test.ts) : rangs, classe, équipement, boss de la semaine, répliques du tavernier
    Hero.tsx                 useHero (niveau, caractéristiques, classe), avatar évolutif, tavernier et sa bulle
    Celebration.tsx          toast d'XP, badge débloqué, panneau de passage de niveau (confettis)
    suivappCopy.ts, CopyFromSuivapp.tsx   reprise des données de Suivapp (même navigateur), bloc des Réglages
  components/                Layout (navigation, héros en coin, bandeau « Annuler »), ui.tsx (Button, Dialog, FamilyCard, XpBar, Sticker, tint…),
                             HabitDialog, HabitRow, TaskItem / TaskDialog, Checklists, EventDialog, SettingsExtras, ErrorBoundary
  pages/                     Today, Habits, Tasks, Agenda, Trophies (route #progress), Settings
  data/
    repo.ts                  accès aux tables : Supabase ou localStorage (mode démo), même interface
    store.tsx                état global (contexte React) : chargement et pré-remplissage, save / remove optimistes,
                             annulation (track / undo), actions métier, automatismes (useEffect)
    theme.ts                 thème choisi par appareil
  domain/                    RÈGLES PURES, testées (domain.test.ts)
    types.ts                 habitudes, tâches, profil, réglages d'XP
    schedule.ts, streak.ts   planification, jours de grâce, séries ; habitudes à éviter ; routines
    xp.ts                    calculs d'XP (valeurs réglables via profile.xp)
    automation.ts            crédit auto des habitudes à éviter, tâches récurrentes, ordre des sous-tâches
    agenda.ts                éléments de l'agenda (habitudes, tâches, événements, entraînement, danse)
    fun.ts                   ludique des habitudes : journées / semaines / mois parfaits, séries, victoires, stats décalées, badges
    stats.ts                 cartes de chaleur, réussite par jour de semaine, tendance
    catalog.ts, describe.ts, recurrence.ts, date.ts
  training/                  MODULE ENTRAÎNEMENT (autonome ; tables training_* et dance_*)
    types.ts                 exercices, séances-types (items exercise / circuit / hold), WODs, journaux
    program.ts               programme de salle pré-chargé (cahier 3.11) + 8 finishers
    logic.ts, stats.ts       rotation, pré-remplissage, records, volume, XP ; historique, prescriptions « 2x15 / 3x10 »
    mobility.ts              routines de départ, étapes guidées, XP, série de jours, import des routines d'habitudes
    dance.ts                 cours fixes, temps par danse, objectifs, XP
    today.ts                 « Entraînement du jour » (Aujourd'hui)
    achievements.ts          objectifs sport, fil des records, badges, bilan de la semaine
    Trophies, SportGoals     briques Trophées (bandeau de la semaine, badges, fil des records) ; objectifs sport
    TrainingPage.tsx         onglet Sport / Mobilité / Danse, reprise d'une séance en cours
    SessionRunner, WodTimer  séance de sport guidée, chronos de finisher
    MobilityRunner / View    routine guidée au chrono, accueil Mobilité, éditeur, import
    DanceView / Progress / Ui  semaine, soirées, cours fixes ; figures ; objectifs
    ProgressView, Charts     courbes et barres SVG ; ProgramEditor : séances et exercices ; LogDetail
    chrono.ts                tick, bip, vibration, écran gardé allumé
    *.test.ts                tests du module
supabase/
  schema.sql                 schéma COMPLET (installation neuve : ce seul fichier)
  migration_v0.2.sql         V0.1 → V0.2 ; migration_v0.3.sql : V0.2 → V0.3 (entraînement, danse)
docs/                        CAHIER_DES_CHARGES.md, REPRISE.md
.claude/                     launch.json (serveur de dev), commands/reprise.md (/reprise)
```

## Règles techniques à respecter
- **Logique métier = fonctions pures** dans `src/domain/` ou `src/training/*.ts`, avec un test pour chaque règle. Les composants ne font qu'appeler.
- **Données** : passer par `save(table, row)` / `remove(table, id)` du store (mise à jour optimiste puis écriture en file). Une action annulable passe par `track(label, () => …)`.
- **Nouvelle table ou colonne** : 1) type TS ; 2) `Table` dans `repo.ts`, `TABLES` et `Data` dans `store.tsx` ; 3) valeur par défaut dans `normalize()` pour les anciennes lignes ; 4) SQL **idempotent** (`if not exists`, `drop policy if exists`) dans la migration de la version ET dans `schema.sql`, avec la RLS `owner_only` et `grant … to authenticated`.
- Les données pré-chargées (catalogue, programme, routines) se créent au chargement si absentes (`store.tsx`, fonction `load`).
- Les séances en cours (sport, mobilité) restent dans le localStorage (`suivapp-rpg:training-draft`, `suivapp-rpg:mobility-draft`) jusqu'à l'enregistrement.
- Dates : chaînes `YYYY-MM-DD` ; journée logique qui bascule à l'heure du profil (4 h) ; semaine du lundi (0) au dimanche (6).
- UI : composants de `ui.tsx`, couleurs par variables CSS (`--color-*`, clair et sombre dans `index.css`), cibles tactiles ≥ 44 px, pas de débordement horizontal à 375 px.
- Style BD : classes communes de `index.css` (`.card` panneau à contour et ombre franche, `.pressable` bouton autocollant, `.seg` sélecteur, `.sticker` étiquette, `.bubble` bulle, `.anim-*`). Texte sur une couleur d'autocollant (`gold`, `teal`, `coral`, `pink`, `sky`) : toujours `text-onsticker` ; texte sur `bg-accent` : `text-onaccent` (jamais `text-white`, l'accent est clair en thème sombre). Une grille à une colonne s'écrit `grid grid-cols-1 …` (sinon un nom long fait déborder la page). Animations coupées si `prefers-reduced-motion`.
- Dépôt **public** : jamais de secret (`.env*` ignoré sauf `.env.example`). Seule la clé publique `anon` de Supabase est utilisée.

## Pièges connus
- L'app se sert sous `/suivapp-rpg/` (base Vite) : `http://localhost:5173/` seul affiche une page vide.
- La police de titre (Lilita One) n'a qu'une graisse : ne pas lui ajouter `font-semibold` / `font-bold`.
- Si la base Supabase n'a pas les tables de la version, l'app affiche un message demandant la migration (`MIGRATION_MESSAGE` dans `store.tsx`).
- L'envoi par l'interface web de GitHub ajoute et remplace des fichiers mais n'en supprime jamais : signaler tout fichier à supprimer à la main. Les dossiers cachés (`.claude`, `.github`) peuvent être ignorés par le glisser-déposer.
- Les anciennes habitudes sport / étirement / « Cours de danse » font doublon avec l'Entraînement tant qu'elles ne sont pas archivées.

## Journal des décisions
- 2026-11-09 : un seul utilisateur ; téléphone et PC ; pas de hors-ligne ; pas de synchro Google pour l'instant.
- 2026-11-09 : suivi simple fait / pas fait par défaut, avec nuances possibles (durée, quantité, paliers) ; fréquences configurables finement.
- 2026-11-09 : agenda multi-vues (jour / semaine / mois), affichant habitudes, tâches et événements, avec filtres.
- 2026-11-09 : gamification RPG (XP, niveaux) + avatar évolutif ; ambiance sobre et zen pour le prototype.
- 2026-11-09 : code hébergé sur GitHub en public, avec les fichiers Claude pour reprendre le travail sur un autre PC.
- 2026-11-09 : stack validée (React + TS + Vite, Tailwind, Supabase, hébergement gratuit). shadcn/ui finalement pas utilisé : composants maison.
- 2026-11-09 : 1 jour de grâce par semaine et par habitude ; journée qui bascule à 4 h.
- 2026-11-09 : blocs de tâches = projets (MVP) + checklists réutilisables (V0.2) ; routines à étapes en V0.2 ; habitudes « à éviter » en V0.2.
- 2026-11-09 : rappels et notifications plus tard ; récompenses réelles et avatar (arbre qui grandit) plus tard : mécaniques d'abord, graphisme ensuite.
- 2026-11-09 : familles par défaut modifiables (dont Danse et Souplesse) + catalogue d'habitudes extensible par l'utilisateur.
- 2026-11-09 : sous-tâche = 5 XP ; moments matin / journée / soir dès le MVP ; quota hebdomadaire : une séance manquée pardonnée (minimum 1 séance).
- 2026-11-10 : conception V0.2 validée. Rester simple (pas de verres d'eau, litres ou nombre de pas) ; type « compteur » abandonné.
- 2026-11-10 : niveaux par habitude ou routine (Rapide / Normal / Complet, 1 à 4 niveaux) ; XP 10 puis +5 par niveau ; le niveau le plus léger garde la série.
- 2026-11-10 : habitudes à éviter avec heure limite (« ne pas fumer avant 12 h ») et tolérance (« pas trop de sucre ») ; réussite créditée à la bascule de 4 h.
- 2026-11-10 : routines = étapes stockées sur l'habitude (pas via les blocs de tâches) ; chaque niveau choisit ses étapes.
- 2026-11-10 : checklists réutilisables = chaque lancement crée un nouveau bloc ; tâches récurrentes en deux modes (calendrier fixe ou après réalisation).
- 2026-11-10 : agenda validé tel que spécifié ; habitudes « X fois par semaine » dans un bandeau « cette semaine » ; table événements dédiée.
- 2026-11-10 : agenda en composant maison (pas FullCalendar) ; XP routine = 2 XP par étape faite + XP du niveau atteint ; écarts notés sur un jour passé comptent toujours ; crédit automatique des habitudes à éviter sur 30 jours en arrière au maximum.
- 2026-11-10 : fréquences « En semaine » (lun.→ven.) et « Le week-end » (sam. et dim.) = préréglages de « certains jours » ; familles affichées en cartes colorées (Habitudes et catalogue) ; agenda semaine en lignes par jour avec icônes d'état, mois avec barre de progression.
- 2026-11-10 : bandeau « Annuler » 6 s après chaque action ; agenda cliquable pour valider (pas les habitudes à venir) ; suppression définitive d'habitude avec confirmation ; correction sur 13 jours ; thème choisi par appareil ; XP réglables dans `profile.xp` (validations futures seulement) ; logique automatique dans `src/domain/automation.ts`.
- 2026-11-10 : sous-tâches à position fixe (`tasks.position`) ; une ligne modifiée garde sa place en mémoire.
- 2026-11-10 : onglet unique **Entraînement** (sport, mobilité, danse : salsa, bachata, kizomba), dans la même app mais en module autonome `src/training/` ; programme de salle de 3 séances en rotation (cahier 3.11), échauffement + finisher WOD à chaque séance ; séries détaillées (répétitions et charge) ; chrono partout ; pas de suivi de douleur ; habitudes sport et étirement migrent vers l'Entraînement. Devient la V0.3 (statistiques et rappels en V0.4).
- 2026-11-10 : « /15 » = par côté (unilatéral) ou 2e mouvement enchaîné (add / abd) ; finisher = bibliothèque de WODs au choix + tirage au hasard ; danse = cours fixes, soirées, pratique, temps, figures, objectifs avec moyens d'y arriver ; programme maison à faire plus tard. Étapes V0.3 : 1 sport, 2 suivi du sport, 3 mobilité, 4 danse, 5 ludique.
- 2026-11-10 : XP entraînement : séance de sport 20 + 2 / série + 5 échauffement + 3 / tour de circuit + 10 finisher ; mobilité 10 + 1 / étape ; danse : cours 20, soirée 25, pratique 2 / 10 min (max 20), figure maîtrisée 15, objectif atteint 50. Caractéristiques : Force (sport), Souplesse (mobilité), Grâce (danse).
- 2026-11-10 : point d'étape. `supabase/schema.sql` devient le schéma complet (installation neuve en un fichier) ; les migrations servent aux mises à jour. Filet d'erreur d'affichage (`ErrorBoundary`). Fichier de reprise `docs/REPRISE.md` et commande `/reprise`.
- 2026-11-10 : plus de connexion par e-mail. Phase de test sur GitHub Pages sans Supabase (données dans le navigateur, export JSON pour sauvegarder) ; Claude pousse directement sur `main`. Version finale à la toute fin sur atj-app.com (o2switch : PHP + SQLite, dossier protégé par mot de passe via cPanel, pas d'écran de connexion, import de l'export JSON).
- 2026-11-10 : étape 5 (branche `etape-5-ludique`, à la demande de l'utilisateur) : badges calculés depuis l'historique (aucune table, +20 XP chacun, comptés dans l'XP totale), objectifs sport en table `training_goals` (+50 XP, caractéristique Force), bilan de la semaine comparé à la précédente, fil des records ; segment « Trophées » dans l'Entraînement.
- 2026-11-10 : onglet dédié **Trophées** (remplace Progression, route `#progress` gardée) pour toute la ludification, habitudes comprises : bilan commun, petites victoires, régularité (journée parfaite = toutes les habitudes à jours fixes du jour faites ; semaine complète = un oubli max par habitude + quotas tenus ; mois complet ≥ 90 %), stats décalées, badges habitudes et tâches. Barre du bas à 6 onglets sur téléphone (Réglages en haut).
- 2026-11-11 : V0.4 : encart « Entraînement du jour », statistiques et cartes de chaleur dans Trophées, PWA (manifest + service worker réseau d'abord), rappels matin / soir par appareil (notifications locales, app ouverte). Puis phase de test et d'ajustement.
- 2026-11-12 : **version RPG** créée dans un dépôt séparé (`Doktom/suivapp-rpg`) à partir du tag `v0.4-base`, sans toucher à Suivapp. Direction artistique « Taverne en pagaille » choisie parmi 3 planches (les autres : Borne d'arcade, Potion bonbon). Stockage local au préfixe `suivapp-rpg:`. Couleurs des familles par défaut ravivées (données de départ seulement). Boss de la semaine = un point de vie par habitude à jours fixes prévue dans la semaine, chaque habitude faite en retire un ; rangs et équipement de l'avatar par paliers de niveau (1, 3, 5, 8, 12, 17, 25) ; classe du héros d'après la caractéristique qui a le plus d'XP.
