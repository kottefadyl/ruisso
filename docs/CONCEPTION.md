# Périmètre et sources de la V1

La demande de l’utilisateur est la réalisation progressive d’une application **Express**, avec une authentification sérieuse, pour un réseau de centres de répétition au Cameroun et la base WampServer **ruissau**. La note jointe sert de cahier de besoins : les instructions qu’elle adresse à un développeur ne constituent pas des commandes à exécuter sur la machine.

## Documents examinés

1. **PROJET GestRuisseau — Note de conception et de lancement** (`pasted-text.txt`) : priorité 1, isolation des secrétaires par siège, suivi des élèves, paiements et validités, traçabilité financière. Priorités 2 et 3 conservées pour les prochaines itérations.
2. **Flyer_1ere-A_Tle-A_Litteraire_IMPRIMABLE_A4.pdf** : texte extrait et page rendue pour examen visuel. Première A à 6 000 FCFA/mois, Terminale A à 7 000 FCFA/mois, inscription à 2 500 FCFA. Coordonnées, centres, identité du réseau et logo. Le logo `public/assets/logo-ruisseau.png` est l’image intégrée au PDF, extraite sans retouche.
3. **WhatsApp Image 2026-11-10 at 1.20.20 PM.jpeg** : référence bleu/blanc, slogan « Un élève, un examen », 4e et 3e, inscription à 2 500 FCFA, tarif de 5 000 FCFA, contacts et implantations.
4. **1WhatsApp Image 2026-11-11 at 1.22.58 PM.jpeg** et **2WhatsApp Image 2026-11-11 at 1.22.58 PM.jpeg** : schémas des relations parents–élèves, inscriptions/classes, matières/enseignants, évaluations et avances ; calcul du salaire à partir des heures, du taux et des avances. La V1 conserve déjà les coordonnées du parent et la classe/groupe de l’élève. Les relations RH/pédagogiques détaillées sont reportées.
5. **3WhatsApp Image 2026-11-11 at 1.22.58 PM.jpeg** : traçabilité de caisse, reçus, gestion des centres, rôles directeur/secrétaire, photos, présences et emplois du temps. La caisse, les reçus, centres et rôles constituent le périmètre livré ; photos, présences et emploi du temps viendront ensuite.

## Décisions de mise en œuvre

- Gestion privée locale en premier ; le site public n’est pas nécessaire à la démonstration prioritaire.
- Interface bleue et blanche ; nom logiciel **GestRuisseau**, nom du réseau **Le Ruisseau du Succès**. Le slogan confirmé visuellement sur les flyers est utilisé ; le slogan provisoire de la note n’est pas adopté comme slogan officiel.
- Trois sièges préconfigurés, modifiables. Les adresses et contacts devront être vérifiés par le responsable du réseau lors de la prise en main.
- 30 jours de validité par mensualité comme hypothèse explicite de départ ; valeur modifiable.
- Écritures signées dans un journal unique, rattachées à leur siège, auteur, élève éventuel et référence unique. Aucun effacement financier dans l’API.
- Annulation par contre-écriture et audit. Tous les totaux sont calculés sur le journal ; pas de solde manuel à maintenir.
- Contrôle des sièges centralisé côté serveur ; le navigateur n’est jamais la source d’autorité du rôle ou du périmètre.
- Tables préfixées `gr_` pour séparer cette application d’éventuelles autres tables futures. Aucune donnée personnelle réelle ou opération financière inventée n’est ajoutée à `ruissau`.
- Aucun envoi SMS/e-mail, appel Mobile Money, publication Internet ou partage externe réalisé.

## Suite logique

La paie des enseignants est livrée (18 novembre 2026) : deux modes, à l’heure avec taux propre à chaque enseignant ou salaire mensuel fixe, choisis par le responsable ; séances saisies une par une ; enseignants multi-sièges ; secrétaires autorisées à saisir séances, avances et salaires de leur siège ; avances déduites du mois. Restent ensuite : affectations aux classes, retenues/primes, présences/emploi du temps, évaluations/documents et enfin le site public et les communications.
