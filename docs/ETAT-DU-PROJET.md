# État du projet — 22 novembre 2026

## Dernière intervention : cahier des charges du 19 novembre (parties I et II) et reçu A5

- **Fiche élève** : quartier, statut Nouveau/Redoublant (parcours existant proposé), date réelle d’inscription, doublons signalés.
- **Dossier enseignant** : matricule, nom, prénom, adresse, grade, téléphone, e-mail, photo obligatoire, matières multiples prédéfinies (gérées dans Paramètres).
- **Banque d’épreuves** PDF : classement matière/classe/séquence/année, recherche, consultation, téléchargement, doublons, archivage.
- **Reprise comptable** : date réelle + date de saisie, n° de reçu papier, justificatifs et pièces manquantes, transferts et reversements, comptages, rapprochement, état PDF, validation horodatée et verrouillage.
- **Paiements partiels** avec mois concerné et reste à payer ; **reçu A5** numéroté sur le modèle fourni.
- Plan de sauvegarde : `docs/SAUVEGARDE.md`. Tests : `npm test` (33 tests) et `npm run test:browser`.
- **Non fait** : partie III (site vitrine public) ; partie IV (évaluations, espace parent) prévue en phase ultérieure.
- **Avant mise en production** : lancer `npm run db:migrate` sur la base en ligne après un export de sauvegarde, puis déployer.

## Intervention du 18 novembre

## Périmètre confirmé

V1 : élèves, paiements, reçus, caisse, sièges, accès manager/secrétaires, paramètres et journal d’activité. Ajout de la **paie des enseignants**. Les présences, emplois du temps et évaluations restent des évolutions ultérieures.

## Dernière intervention : paie des enseignants

- Nouvelle page **Enseignants & paie** : enseignants payés à l’heure (taux propre) ou au salaire mensuel fixe, séances saisies par siège, avances et salaires sortant de la caisse d’un siège, reste à payer par mois, fiche détaillée et bulletin imprimable.
- Droits : le manager gère les fiches et barèmes ; les secrétaires saisissent séances, avances et salaires de leur siège.
- Règles détaillées dans `README.md`, section « Paie des enseignants ».
- Schéma : tables `gr_teachers`, `gr_teacher_sessions`, `gr_teacher_periods`, colonnes `teacher_id` / `period` et types `salary` / `advance` dans `gr_ledger`. Mise à niveau automatique et non destructive au démarrage (`src/migrate.js`).

## Refonte de l’interface (même jour)

- Lisibilité : texte courant relevé à 13–14 px (9–11 px auparavant), champs à 16 px sur téléphone (pas de zoom automatique).
- Repères : chaque page porte le nom de son menu ; le siège et la session affichés sont rappelés au-dessus du titre.
- Tableau de bord : quatre raccourcis (nouvel élève, paiement, dépense, séance) ; guide « premiers pas » tant qu’aucun élève n’est inscrit.
- Paiement : recherche unique avec résultats cliquables, tarif de la classe proposé, mode de règlement en boutons, nouvelle date de validité affichée avant confirmation, bouton « Encaisser X FCFA ».
- Listes : filtres en puces, lignes cliquables (fiche élève, justificatif, fiche enseignant), boutons « Encaisser » et « Payer » libellés, téléphone du parent cliquable.
- Fiche élève : carte de validité colorée, actions « Encaisser », « Appeler le parent », « Modifier ».
- Caisse : l’annulation (manager) se fait depuis le justificatif, plus depuis chaque ligne.
- Téléphone : tableaux affichés en cartes, barre de navigation basse avec bouton central « Encaisser », menu latéral avec fond assombri, fenêtres en panneau bas.
- Raccourci clavier : « / » place le curseur dans la recherche de la page.

## Manuel d’utilisation et compte secrétaire

- Rubrique **Manuel d’utilisation** (remplace « Guide de démarrage ») : 16 sections pour le manager, 12 pour une secrétaire (les sections réservées au manager sont masquées). Sommaire, recherche sans accents, boutons d’action intégrés, impression ou PDF. Contenu dans `public/manual.js`, à tenir à jour avec l’application.
- Compte secrétaire créé dans la base `ruissau` : « Secrétariat Biyem-Assi », rattaché au siège Biyem-Assi. Identifiants dans `IDENTIFIANTS-SECRETAIRE-BIYEM-ASSI.local.md` (exclu de Git, comme tous les fichiers `*.local.md`).

## Vérifications effectuées

- `npm test` : 25 tests réussis (dont 7 pour la paie : droits, séances, taux figé, plafonnement au reste dû, versements simultanés, annulations, barème figé, enseignant désactivé).
- `npm run test:browser` : parcours complet réussi, y compris création de deux enseignants (à l’heure et fixe), saisie d’une séance, versement du salaire et bulletin.
- Mise à niveau testée sur une base temporaire au format V1 : colonnes et tables ajoutées, deuxième exécution sans effet.

Les tests utilisent uniquement des bases temporaires. La base `ruissau` n’a pas été modifiée pendant cette intervention ; elle sera mise à niveau au prochain démarrage du serveur.

## Prise en main restante

Démarrer MySQL dans WampServer, puis lancer `DEMARRER.cmd`. Si le compte manager n’existe pas encore, ouvrir le lien privé d’initialisation affiché dans la fenêtre. Ensuite, créer les fiches enseignants dans **Enseignants & paie**.
