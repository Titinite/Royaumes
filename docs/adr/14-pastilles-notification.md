# ADR-14 - Pastilles du menu : nouveautés fournies par chaque module, « déjà vu » retenu par le navigateur

- Statut : accepté
- Date : 2026-10-28

## Contexte

Le menu latéral doit signaler, par une pastille à côté de la rubrique concernée, une quête terminée
à réclamer, un haut fait obtenu, ou un nouveau message dans la Taverne, quelle que soit la page
ouverte.

Le menu est rendu par le cadre de l'espace de jeu (`src/ui/app-shell.tsx`), qui n'appartient à aucun
module : il ne doit connaître ni les règles des Quêtes, ni celles des Hauts faits, ni celles de la
Taverne, et ne peut importer d'un module que son entrée publique `ui.tsx` (ADR 01).

Les trois rubriques n'ont pas la même nature :

- une quête terminée reste à réclamer tant que le joueur ne l'a pas fait : le serveur sait déjà
  quelles quêtes sont « à traiter » ;
- un haut fait obtenu ou un message publié ne demande aucune action : seule la notion de « vu »
  permet de savoir s'il est nouveau, et aucun module ne la conserve aujourd'hui.

Les Hauts faits et la Taverne disposent déjà d'un canal temps réel (`achievements-<joueur>`,
`tavern`). Les Quêtes n'en ont pas : leur progression est calculée par une projection, rattrapée à
la lecture (ADR 10 et 11).

## Décision

- **Chaque module fournit le nombre de nouveautés de sa rubrique**, par un hook de son entrée
  publique `ui.tsx` : `useQuestNotifications`, `useAchievementNotifications` et
  `useTavernNotifications`. Le cadre ne fait qu'afficher ces nombres.
- **Quêtes** : la pastille compte les quêtes terminées dont la récompense n'est pas réclamée. Elle
  disparaît à la réclamation ; aucun « déjà vu » n'est nécessaire. Faute de canal, le tableau est
  relu à chaque changement de page, au retour sur l'onglet et toutes les 30 secondes ; l'écran des
  Quêtes signale aussitôt chaque nouveau tableau (après une réclamation, par exemple).
- **Hauts faits** : la pastille compte les hauts faits obtenus après le dernier haut fait vu. Le même
  abonnement au canal du joueur sert aux notifications éphémères et à la pastille. Ouvrir l'écran
  des Hauts faits les rend vus.
- **Taverne** : la pastille compte les messages des autres joueurs publiés après le dernier message
  vu. Ouvrir la Taverne les rend vus ; pendant ce temps, le canal n'est pas ouvert une seconde fois.
- **Le « déjà vu » est retenu par le navigateur** (stockage local, `src/ui/device-store.ts`) : la date
  du dernier haut fait vu et l'identifiant du dernier message vu, sous une clé propre à chaque
  joueur. Au premier passage sur un navigateur, l'existant est considéré comme vu. Ces marqueurs
  sont supprimés à la déconnexion.
- Affichage : un nombre plafonné à « 9+ » à droite du lien, posé sur l'icône lorsque le menu est
  replié, et un point sur le bouton du menu fermé, sur petit écran. Le nombre est aussi lu par les
  lecteurs d'écran.

## Conséquences

### Positives

- Aucune nouvelle table, aucune migration, aucune nouvelle route : les pastilles réutilisent les
  lectures et les canaux existants.
- Aucune donnée personnelle supplémentaire n'est conservée par le serveur : le registre des
  traitements est inchangé. Le stockage local ne contient que des repères techniques nécessaires à
  l'affichage demandé par le joueur.
- Les frontières entre modules sont respectées : chaque règle de « nouveauté » reste dans son module,
  et le cadre n'importe que des entrées publiques. `pnpm lint:archi` le vérifie.
- La pastille des Quêtes reflète l'état du serveur : elle ne peut pas être fausse d'un appareil à
  l'autre.

### Négatives

- Le « déjà vu » des Hauts faits et de la Taverne n'est pas partagé entre appareils : un message lu
  sur le téléphone reste signalé sur l'ordinateur.
- La pastille des Quêtes peut apparaître jusqu'à 30 secondes après l'action qui termine une quête,
  et chaque joueur connecté provoque une lecture des Quêtes toutes les 30 secondes.
- Chaque joueur connecté ouvre en permanence le canal de la Taverne, en plus de celui de ses hauts
  faits : la charge de lecture décrite dans l'ADR 03 augmente d'un flux par joueur.
- Un haut fait daté avant le dernier haut fait vu (rattrapage tardif de la projection) ne serait
  pas signalé par la pastille ; sa notification éphémère reste affichée.
- Ces hooks ne sont vérifiés que manuellement : aucun test automatisé de l'interface n'existe dans le
  projet.

## Alternatives écartées

- **Table « vu » côté serveur** (dernier élément vu par joueur et par rubrique) : partagée entre
  appareils, mais demandait une table, une route d'écriture à chaque ouverture d'écran, et une
  donnée personnelle de plus à exporter et à effacer (ADR 08).
- **Module « Notifications » central**, alimenté par les événements de tous les modules : une
  projection de plus, et un module qui connaîtrait les règles des autres, pour trois compteurs.
- **Canal temps réel propre aux Quêtes** : supprimerait la relecture périodique, mais demandait une
  source de canal et un rattrapage de projection à chaque lecture, comme pour les Hauts faits
  (dette DT-015).
- **Pastille sans nombre** (un simple point) : plus simple, mais moins informative.

## Réexamen

Revoir cette décision si les joueurs utilisent couramment plusieurs appareils (une table « vu » côté
serveur deviendrait alors utile), ou si la charge des canaux (ADR 03) devient un problème.

## Usage de l'IA générative

Protoypage et idéation réalisés seul puis utilisation de Claude pour générer un code plus propre, commenté, pour faire le design des améliorations de bâtiments et rédiger la documentation.