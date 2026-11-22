# Plan de sauvegarde et de restauration

Toutes les données de GestRuisseau sont dans **une seule base MySQL/MariaDB** (tables `gr_*`), y compris les photos des enseignants, les sujets PDF et les justificatifs (table `gr_files`). Sauvegarder la base suffit donc à tout sauvegarder.

## Fréquence

| Quand | Quoi | Qui |
|---|---|---|
| Chaque jour (automatique) | Sauvegarde de la base par alwaysdata (historique de plusieurs jours) | Hébergeur |
| Chaque vendredi soir | Export SQL manuel, conservé hors ligne (clé USB ou disque) | Manager |
| Avant toute mise à jour de l’application ou de `database/schema.sql` | Export SQL manuel | Développeur |
| Avant la validation de la reprise d’un siège | Export SQL manuel + état PDF consolidé | Manager |

Garder au moins les **4 derniers exports hebdomadaires**, sur un support différent de l’ordinateur du secrétariat.

## Faire un export (alwaysdata)

1. Se connecter à l’administration alwaysdata → **Bases de données → MySQL** → **phpMyAdmin**.
2. Choisir la base de l’application, puis **Exporter** → méthode **Personnalisée**.
3. Format **SQL**, cocher toutes les tables `gr_*`, laisser « Ajouter CREATE TABLE » et les données.
4. Pour les colonnes binaires (fichiers), laisser l’option « Exporter les données binaires en hexadécimal » cochée.
5. Nommer le fichier `gestruisseau-AAAA-MM-JJ.sql` et le copier hors de l’ordinateur.

En ligne de commande, sur un poste disposant du client MySQL :

```powershell
mysqldump --single-transaction --hex-blob --routines -h <hôte> -u <utilisateur> -p <base> > gestruisseau-2026-11-22.sql
```

## Restaurer

> Une restauration **remplace** les données actuelles. La faire d’abord sur une base de test.

1. Créer une base vide (ou vider la base de test).
2. phpMyAdmin → base cible → **Importer** → choisir le fichier `.sql` → Exécuter.
   Ou : `mysql -h <hôte> -u <utilisateur> -p <base> < gestruisseau-2026-11-22.sql`
3. Pointer une copie locale de l’application vers cette base (`.env`), lancer `DEMARRER.cmd` et vérifier :
   - connexion du manager et d’une secrétaire ;
   - nombre d’élèves, solde de chaque caisse, dernier reçu imprimé ;
   - ouverture d’un sujet de la banque d’épreuves et d’un justificatif.
4. Seulement après ces contrôles, restaurer sur la base de production si nécessaire.

## Test de restauration avant la mise en production

Avant le démarrage opérationnel : faire un export, le restaurer sur une base locale WampServer, et effectuer les contrôles du point 3. Noter la date du test et son résultat dans le procès-verbal de recette.
