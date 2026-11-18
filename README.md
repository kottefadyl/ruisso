# GestRuisseau

Première version de gestion du **Ruisseau du Succès**, réseau de centres de répétition à Yaoundé. Application en français, avec Express 5, MySQL 8 / WampServer et une interface HTML/CSS/JavaScript adaptée aux ordinateurs et téléphones.

## Démarrer sur ce poste

La base **`ruissau`** a été initialisée. Les dépendances et le fichier `.env` sont déjà installés/configurés pour MySQL WampServer, sur `127.0.0.1:3306`.

1. Démarrer WampServer et vérifier que MySQL fonctionne.
2. Dans le dossier du projet, lancer :

   ```powershell
   npm run dev
   ```

   Ou double-cliquer sur **`DEMARRER.cmd`** pour démarrer sans surveillance des fichiers.

3. Lors du premier démarrage, ouvrir **le lien d’initialisation affiché dans le terminal**. Il contient une clé privée dans le fragment `#token=…`.
4. Choisir le nom, l’e-mail et le mot de passe du manager (au moins 12 caractères).
5. Ensuite, se connecter normalement sur **http://127.0.0.1:3010**.

Il n’existe aucun compte ni mot de passe par défaut. La création initiale se ferme automatiquement après le premier compte manager. Ne pas partager le lien d’initialisation. Le serveur doit rester ouvert pendant l’utilisation ; `Ctrl+C` l’arrête.

Le fichier `.env` n’est pas versionné. Si votre compte MySQL possède un mot de passe, renseigner `DB_PASSWORD`. Apache/PHP ne servent pas cette application : Express utilise par défaut le port **3010**, configurable avec `PORT` dans `.env`, tandis que MySQL est fourni par WampServer.

## Installation sur un autre poste

Prérequis : Node.js 22 ou supérieur, npm et MySQL 8. La base `ruissau` doit exister. Aucune base existante n’est supprimée par l’initialisation.

```powershell
npm ci
npm run db:init
npm start
```

`db:init` crée `.env` et des secrets aléatoires s’il n’existe pas, puis crée les tables préfixées `gr_`. Ajuster les paramètres DB dans `.env` si nécessaire, puis relancer `db:init`. Il est possible de relancer cette commande : elle ne vide pas les tables et ne remplace pas les tarifs ou centres déjà présents. Le SQL de référence se trouve dans `database/schema.sql`.

## Fonctions disponibles

- Connexion, déconnexion, changement de mot de passe et initialisation privée du manager.
- Manager : vision globale, création/modification des sièges, comptes secrétaires, tarifs et session scolaire.
- Secrétaire : consultation et saisie uniquement dans son siège ; restrictions appliquées à chaque route côté serveur.
- Élèves : inscription, modification, classe, groupe, session, coordonnées du parent, recherche et filtre de validité.
- Paiements : tarif configurable, espèces / MTN Mobile Money / Orange Money / virement, prolongation automatique et reçu imprimable A4.
- Caisse : recettes, dépenses, solde initial par siège, historique, références uniques et annulation justifiée par le manager.
- Tableau de bord : effectifs de la session, entrées du jour, soldes, échéances, mouvements sur sept jours et répartition par siège.
- Journal d’activité : connexions, modifications et opérations importantes.
- Manuel d’utilisation intégré (menu « Manuel d’utilisation ») : chaque écran pas à pas, règles, exemples chiffrés, questions fréquentes, adapté au rôle et imprimable. Contenu : `public/manual.js`.
- Enseignants & paie : fiche enseignant payée **à l’heure** (taux propre à chaque enseignant) ou par **salaire mensuel fixe**, saisie des séances par siège, avances et salaires versés depuis la caisse d’un siège, reste à payer par mois et bulletin imprimable.

Les modes MTN/Orange servent à **enregistrer manuellement un règlement déjà reçu**. Ils ne déclenchent aucun prélèvement et ne sont pas reliés à une API Mobile Money.

## Premier parcours

1. Vérifier les coordonnées dans **Nos sièges**.
2. Vérifier les tarifs dans **Paramètres**.
3. Créer un compte par secrétaire dans **Équipe & accès**. Transmettre ses identifiants personnellement ; la secrétaire peut changer son mot de passe via son avatar.
4. Inscrire un élève depuis **Élèves**, puis enregistrer son paiement.
5. Imprimer le reçu ou utiliser « Enregistrer au format PDF » dans la fenêtre d’impression du navigateur.
6. Enregistrer une dépense et vérifier le solde dans **Caisse & mouvements**.
7. En cas d’erreur, utiliser l’action d’annulation dans la caisse (manager), saisir le motif, puis enregistrer l’opération correcte.

Le solde initial se saisit depuis **Manuel d’utilisation** (section « Solde initial d’un siège ») ; c’est une entrée de caisse tracée. Il est facultatif si le siège démarre à zéro. Une seule écriture initiale est autorisée par siège.

## Règles retenues pour cette V1

- Devise : FCFA/XAF, montants entiers.
- Dates métier : fuseau `Africa/Douala`. Horodatage technique et journal en UTC.
- Une mensualité représente **30 jours**, durée modifiable pour les prochains paiements.
- Un renouvellement anticipé ajoute des jours à la fin de validité existante. Si elle est expirée, la période commence le jour du paiement.
- Validité : vert au-delà de 20 jours ; jaune entre 10 et 20 ; rouge entre 1 et 9 ; expirée à zéro ou en dessous. Sans paiement donnant des jours : « Non payé ».
- L’inscription à 2 500 FCFA ne prolonge pas la validité. Inscription et mensualité se paient avec deux écritures distinctes.
- Le montant payé est celui du tarif sélectionné, contrôlé côté serveur. Les paiements partiels, remises et opérations antidatées sont hors V1.
- Le siège et la session d’une inscription sont fixes, pour préserver son historique. Une nouvelle session nécessite une nouvelle fiche ; la réinscription liée à l’ancienne fiche viendra ensuite.
- La caisse agrège tous les modes de paiement et toutes les sessions. Le filtre de session affecte les élèves et effectifs, pas le total financier historique.
- Les totaux d’entrées/sorties incluent les contre-écritures. Le solde est la somme de toutes les écritures signées, solde initial inclus.
- Les montants et durées des paiements sont figés au moment de l’encaissement. Un changement de tarif n’a aucun effet rétroactif.
- Une annulation crée une écriture opposée et recalcule la validité avec les paiements non annulés, dans l’ordre de leurs dates et identifiants. On ne peut ni supprimer un mouvement ni annuler deux fois le même mouvement.
- Les sièges ne sont pas supprimés ; les accès secrétaires et tarifs peuvent être désactivés.

## Paie des enseignants

- Le manager crée et modifie les fiches enseignants : mode de paie, taux horaire ou salaire mensuel, date d’entrée, activation. Les secrétaires saisissent les séances, avances et salaires **de leur siège** ; elles voient la situation globale de chaque enseignant mais seulement les séances et versements de leur siège.
- Un enseignant peut intervenir dans plusieurs sièges. Chaque séance est rattachée au siège où elle a lieu ; chaque avance ou salaire sort de la caisse du siège choisi (écritures `salary` / `advance` du journal).
- **À l’heure** : dû du mois = somme des séances non annulées du mois. Le montant d’une séance (durée × taux) est figé à la saisie ; un changement de taux ne touche pas les séances déjà saisies.
- **Salaire fixe** : dû du mois = salaire mensuel, mois complet dès le mois de la date d’entrée (pas de prorata en V1). Les séances peuvent être saisies pour le suivi, sans effet sur le montant.
- Reste à payer = dû − avances − salaires versés, mois par mois. Un salaire ne peut pas dépasser le reste à payer ; une avance n’est pas plafonnée. Un reste négatif apparaît comme **trop-perçu**.
- Le barème d’un mois (mode et salaire fixe) est figé dès la première avance ou le premier salaire de ce mois. Un changement ultérieur s’applique aux mois sans versement.
- Corrections : une séance s’annule avec un motif (secrétaire du siège ou manager) ; une avance ou un salaire s’annule par contre-écriture du manager, comme toute opération de caisse.
- Pas de versement pour un mois futur ni de séance future. Un enseignant désactivé ne reçoit plus de séance ; ses mois avec activité restent consultables et payables. Solder ses mois avant de le désactiver.
- Retenues, primes, cotisations sociales et bulletins de paie légaux sont hors périmètre.

Au démarrage (`npm start`, `npm run dev`, `DEMARRER.cmd`) ou via `npm run db:init`, une base V1 existante est mise à niveau automatiquement : création des tables `gr_teachers`, `gr_teacher_sessions`, `gr_teacher_periods` et ajout des colonnes `teacher_id` / `period` au journal. Aucune donnée n’est modifiée ni supprimée.

Tarifs de départ issus des documents : inscription 2 500 FCFA ; 4e/3e 5 000 FCFA ; Première A 6 000 FCFA ; Terminale A 7 000 FCFA. Les trois sièges sont Biyem-Assi, Ngoa Ekélé et Mendong. Les numéros des flyers sont des contacts du réseau, préremplis dans les fiches et modifiables.

## Authentification et intégrité

- Hachage bcrypt, coût 12, mots de passe de 12 caractères minimum et 72 octets maximum.
- Sessions conservées dans MySQL, renouvelées à la connexion ; durée maximale de 8 heures.
- Cookies `HttpOnly` et `SameSite=Lax`, `Secure` en production.
- Jeton CSRF pour chaque mutation, y compris connexion et initialisation.
- Limitation des tentatives de connexion et des requêtes par IP.
- Rôle, activité et version d’authentification revérifiés en base à chaque requête. Une modification d’accès ou de mot de passe invalide les anciennes sessions.
- À la déconnexion ou lorsqu’une session expirée est détectée, les fiches ouvertes et le reçu préparé pour impression sont effacés ; le formulaire de connexion redevient accessible.
- Validation Zod, requêtes SQL paramétrées, échappement des contenus affichés, en-têtes Helmet et politique CSP.
- Paiement, recalcul de validité, caisse et audit dans la même transaction SQL ; verrou sur l’élève pour les opérations concurrentes.
- Clé unique de formulaire pour empêcher un double encaissement dû au renvoi d’une même requête.

Le responsable peut réinitialiser le mot de passe d’une secrétaire dans **Équipe & accès**. La récupération automatique du mot de passe manager par e-mail n’est pas intégrée à cette V1.

Les choix de sessions et cookies suivent les [recommandations de sécurité Express](https://expressjs.com/advanced/best-practice-security/) et la [documentation express-session](https://expressjs.com/en/resources/middleware/session/).

## Vérifier le projet

```powershell
npm test
npm run test:browser
```

Les tests créent une base MySQL temporaire `ruissau_test_<date>_<aléatoire>`, la remplissent, puis la suppriment. Ils ne modifient pas la base `ruissau`. Le compte MySQL utilisé par les tests doit donc pouvoir créer et supprimer cette base temporaire. Le test navigateur utilise Chrome ou Edge installé sous Windows ; ailleurs, fournir `CHROME_PATH` ou installer le navigateur Playwright.

Les captures et le PDF de reçu de test sont écrits dans `artifacts/` (ignoré par Git). Ils contiennent uniquement les données fictives de test.

Le parcours navigateur vérifie aussi la révocation d’une session pendant qu’une fiche élève est ouverte, l’effacement du reçu imprimable et la reconnexion. Le dernier état de reprise est consigné dans [docs/ETAT-DU-PROJET.md](docs/ETAT-DU-PROJET.md).

## Structure

```text
src/app.js           Routes Express, authentification, droits et opérations
src/db.js            Connexion MySQL et transactions
src/domain.js        Validations, calculs de validité et de paie
src/migrate.js       Création des tables et mise à niveau non destructive
src/config.js        Configuration par environnement
src/server.js        Démarrage (avec mise à niveau) et arrêt du serveur
database/schema.sql  Structure de la base
scripts/init-db.js   Initialisation non destructive et tarifs de départ
public/              Interface, styles et ressources locales
tests/               Tests métier et intégration MySQL
docs/CONCEPTION.md   Sources, périmètre et décisions
```

## Déploiement sur Vercel

- `api/index.js` exporte l’application Express : Vercel l’exécute comme fonction pour toutes les routes `/api/*`.
- `vercel.json` : fichiers de `public/` servis directement par Vercel, retour vers `index.html` pour `/login`, `/initialisation` et `/app`, en-têtes de sécurité (CSP, HSTS…) et région **Paris (`cdg1`)**, proche de la base alwaysdata.
- Sur Vercel (`VERCEL=1`), l’application fait confiance au proxy HTTPS : cookies `Secure`, vraie adresse IP pour la limitation des tentatives.
- Le schéma n’est pas mis à jour au démarrage d’une fonction. Après une évolution de `database/schema.sql`, lancer `npm run db:migrate` (avec `.env` pointant vers la base en ligne) **avant** de pousser sur `main`.
- La limitation des tentatives de connexion est conservée en mémoire de chaque instance : elle reste efficace mais moins stricte qu’avec un seul serveur.

Variables d’environnement à définir dans Vercel (*Settings → Environment Variables*, environnement *Production*) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | `mysql-<compte>.alwaysdata.net` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `<compte>_<base>` |
| `DB_USER` | utilisateur alwaysdata |
| `DB_PASSWORD` | mot de passe alwaysdata (marquer *Sensitive*) |
| `DB_SSL` | `1` |
| `DB_CONNECTION_LIMIT` | `3` |
| `SESSION_SECRET` | 96 caractères aléatoires, propres à la production (*Sensitive*) |

`SETUP_TOKEN` est inutile tant qu’un compte manager existe. `HOST`, `PORT` et `TRUST_PROXY` ne servent qu’en local.

## Base de données hébergée (alwaysdata)

alwaysdata fournit **MariaDB** : l’application est testée sur MySQL 8.4 et MariaDB 11.4.

1. Dans l’administration alwaysdata (**Bases de données → MySQL**), relever l’hôte (`mysql-<compte>.alwaysdata.net`), le nom de la base (préfixé par le compte, ex. `<compte>_ruissau`) et l’utilisateur (préfixé lui aussi), avec son mot de passe.
2. Dans `.env`, remplacer `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` ; garder `DB_PORT=3306` ; mettre `DB_SSL=1` pour chiffrer la connexion (revenir à `0` si alwaysdata la refuse).
3. Copier les données locales (comptes, sièges, tarifs, élèves, caisse…) : `npm run db:copy -- --dry-run` pour vérifier, puis `npm run db:copy`. La base locale n’est que lue ; la copie refuse une cible qui contient déjà des données. Ne pas lancer `npm run db:init` sur la cible avant la copie.
4. Démarrer avec `DEMARRER.cmd` : les tables manquantes sont créées automatiquement.

Les tests (`npm test`) utilisent toujours le serveur local `TEST_DB_*` (WampServer par défaut), jamais la base distante.

## Mise en ligne ultérieure

Cette livraison fonctionne localement. Pour un accès entre les sièges via Internet, prévoir un hébergement Node/MySQL, HTTPS, un compte SQL dédié, des sauvegardes régulières et un proxy configuré. Mettre `NODE_ENV=production` ; n’activer `TRUST_PROXY=1` que derrière un proxy de confiance. Les limites de débit de cette V1 sont en mémoire d’un seul processus ; un déploiement à plusieurs instances nécessitera un stockage partagé des limites. Le mode développement ne doit pas être exposé directement sur Internet.

## Évolutions prévues

Affectations des enseignants aux classes, retenues et primes, présences, emplois du temps, évaluations et notes, photos de profils, banque d’épreuves et documents, réinscriptions avec archives liées, SMS/e-mails et site vitrine. Ces modules ne sont pas simulés dans cette première version.
