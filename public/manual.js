// Manuel d'utilisation de GestRuisseau, affiché dans la rubrique « Manuel d'utilisation ».
// Chaque section : id (ancre), titre, rôle ('all' ou 'manager') et contenu HTML statique.
// Le contenu décrit le comportement réel de l'application : le mettre à jour avec elle.
window.manualContent = ({ icon, button }) => [
{ id:'presentation', title:'1. Présentation', role:'all', html:`
<p><strong>GestRuisseau</strong> est l’espace de gestion du réseau <strong>Le Ruisseau du Succès</strong> (Biyem-Assi, Ngoa Ekélé, Mendong). Il regroupe au même endroit les élèves, leurs paiements et leur validité, la caisse de chaque siège et la paie des enseignants.</p>
<h4>Deux rôles</h4>
<table class="manual-table"><thead><tr><th>Action</th><th>Manager (directeur)</th><th>Secrétaire</th></tr></thead><tbody>
<tr><td>Voir les données</td><td>Tous les sièges</td><td>Uniquement son siège</td></tr>
<tr><td>Inscrire et modifier les élèves</td><td>Oui</td><td>Oui, dans son siège</td></tr>
<tr><td>Encaisser un paiement, imprimer un reçu</td><td>Oui</td><td>Oui</td></tr>
<tr><td>Dépenses et autres recettes</td><td>Oui</td><td>Oui, caisse de son siège</td></tr>
<tr><td>Solde initial d’un siège</td><td>Oui (une fois par siège)</td><td>Non</td></tr>
<tr><td>Annuler une opération de caisse</td><td>Oui, avec un motif</td><td>Non : demander au manager</td></tr>
<tr><td>Créer ou modifier un enseignant, fixer son salaire</td><td>Oui</td><td>Non</td></tr>
<tr><td>Saisir une séance, verser une avance ou un salaire</td><td>Oui</td><td>Oui, pour son siège</td></tr>
<tr><td>Sièges, comptes secrétaires, tarifs, session, journal</td><td>Oui</td><td>Non</td></tr>
</tbody></table>
<p class="manual-tip">${icon('shield')}<span>Ces limites sont contrôlées par le serveur : une secrétaire ne peut pas voir ni modifier les données d’un autre siège, même en changeant l’adresse de la page.</span></p>`},

{ id:'connexion', title:'2. Se connecter et gérer son compte', role:'all', html:`
<h4>Se connecter</h4>
<ol><li>Ouvrir le navigateur (ordinateur ou téléphone) à l’<strong>adresse internet de l’application</strong> communiquée par le directeur. Elle commence par <code>https://</code> : le cadenas du navigateur indique une connexion sécurisée. Astuce : l’ajouter aux favoris, ou sur téléphone à l’écran d’accueil.</li>
<li>Saisir l’<strong>identifiant</strong> (une adresse de la forme <code>nom@ruisseaudusucces.local</code>) et le <strong>mot de passe</strong> remis par le directeur, puis « Se connecter ».</li></ol>
<p>Après <strong>10 tentatives échouées</strong>, la connexion est bloquée pendant 15 minutes. En cas d’oubli, seul le directeur peut réinitialiser le mot de passe d’une secrétaire (« Équipe & accès »).</p>
<h4>Changer son mot de passe</h4>
<ol><li>Cliquer sur son nom en bas du menu (sur téléphone : ouvrir le menu ${icon('menu')} d’abord).</li>
<li>Saisir le mot de passe actuel puis le nouveau : <strong>au moins 12 caractères</strong>. Une phrase facile à retenir convient très bien (ex. « Le cahier bleu de Mendong 2027 »).</li>
<li>Valider : toutes vos sessions sont fermées et vous vous reconnectez avec le nouveau mot de passe.</li></ol>
<h4>Durée de session et déconnexion</h4>
<p>Une session reste ouverte <strong>8 heures</strong> au maximum. Si elle expire, ou si le directeur modifie votre accès, l’application revient à l’écran de connexion et efface la fiche ouverte. Pour partir, utilisez le bouton ${icon('logout')} en bas du menu, surtout sur un ordinateur partagé.</p>`},

{ id:'reperes', title:'3. Se repérer dans l’écran', role:'all', html:`
<ul><li><strong>Menu à gauche</strong> (sur téléphone : bouton ${icon('menu')} en haut à gauche) : toutes les rubriques. La rubrique ouverte est surlignée en bleu.</li>
<li><strong>Barre du haut</strong> : le <strong>siège</strong> et la <strong>session scolaire</strong> affichés. Le manager peut choisir « Tous les sièges » ou un siège précis ; la secrétaire voit toujours son siège. Le rappel bleu au-dessus de chaque titre (ex. « BIYEM-ASSI · SESSION 2026-2027 ») indique ce qui est affiché.</li>
<li><strong>Sur téléphone</strong>, une barre en bas donne accès à Accueil, Élèves, <strong>Encaisser</strong> (bouton rond central), Caisse et Paie.</li>
<li><strong>Lignes cliquables</strong> : dans les listes, cliquer sur une ligne ouvre la fiche (élève, enseignant) ou le justificatif (opération de caisse).</li>
<li><strong>Recherche rapide</strong> : sur ordinateur, la touche <kbd>/</kbd> place le curseur dans la zone de recherche de la page.</li>
<li><strong>Messages</strong> : une confirmation verte apparaît en bas à droite après chaque enregistrement ; un message rouge explique ce qui manque en cas d’erreur.</li></ul>
<h4>Couleurs de validité d’un élève</h4>
<p><span class="badge active">Plus de 20 jours</span> à jour · <span class="badge warning">10 à 20 jours</span> échéance proche · <span class="badge urgent">1 à 9 jours</span> à relancer · <span class="badge expired">Expiré</span> 0 jour ou date dépassée · <span class="badge">Non payé</span> aucune mensualité enregistrée.</p>`},

{ id:'tableau-de-bord', title:'4. Le tableau de bord', role:'all', html:`
<p>C’est la page d’accueil. Elle répond à trois questions : que dois-je faire, combien a-t-on encaissé, quels élèves relancer ?</p>
<ul><li><strong>Raccourcis</strong> : Nouvel élève, Enregistrer un paiement, Enregistrer une dépense, Saisir une séance.</li>
<li><strong>Chiffres clés</strong> : élèves inscrits dans la session, encaissements du jour, solde des caisses, élèves à suivre (échéance sous 20 jours, expirés ou non payés).</li>
<li><strong>Mouvements de la semaine</strong> : entrées (bleu foncé) et sorties (bleu clair) des 7 derniers jours.</li>
<li><strong>Vos sièges</strong> : élèves et solde de chaque caisse.</li>
<li><strong>Dernières opérations</strong> et <strong>élèves à accompagner</strong> : cliquer sur une ligne pour ouvrir le justificatif ou la fiche.</li></ul>
<p>Tant qu’aucun élève n’est inscrit, le tableau de bord affiche à la place un guide « Bienvenue » en quelques étapes.</p>`},

{ id:'eleves', title:'5. Les élèves', role:'all', html:`
<h4>Inscrire un élève</h4>
<ol><li>« Élèves » puis <strong>Inscrire un élève</strong> (ou le raccourci du tableau de bord).</li>
<li>Renseigner : nom complet, siège, session (ex. 2026-2027), classe (liste proposée ou saisie libre), groupe (ex. « Groupe du soir »), nom et <strong>téléphone du parent</strong> (format camerounais : 9 chiffres ou +237…), e-mail du parent et notes si utile.</li>
<li>« Inscrire l’élève ». La fiche est créée avec l’état <span class="badge">Non payé</span> : enregistrez ensuite son paiement.</li></ol>
${button('Inscrire un élève','student-new','plus','secondary small-btn')}
<h4>Retrouver un élève</h4>
<ul><li>Rechercher par <strong>nom, classe, groupe ou téléphone du parent</strong>, puis Entrée.</li>
<li>Filtrer en un clic : Tous, À jour, Échéance proche, Expirés, Non payés.</li>
<li>La liste affiche la session choisie en haut de l’écran ; changer la session pour retrouver les élèves d’une année précédente.</li></ul>
<h4>La fiche élève</h4>
<p>Cliquer sur la ligne de l’élève. La fiche montre sa validité (carte colorée), les coordonnées du parent, l’historique des paiements, et trois actions : <strong>Encaisser un paiement</strong>, <strong>Appeler le parent</strong> (sur téléphone, lance l’appel), <strong>Modifier la fiche</strong>.</p>
<h4>Modifier une fiche</h4>
<p>Tout peut être corrigé sauf le <strong>siège</strong> et la <strong>session</strong>, qui restent fixes pour préserver l’historique des paiements. Pour une nouvelle année scolaire, créer une nouvelle fiche dans la nouvelle session.</p>`},

{ id:'paiements', title:'6. Encaisser un paiement', role:'all', html:`
<h4>Pas à pas</h4>
<ol><li>Bouton <strong>Enregistrer un paiement</strong> (tableau de bord, page Paiements, bouton « Encaisser » d’une ligne élève, ou bouton rond sur téléphone).</li>
<li>Taper au moins 2 lettres du nom (ou la classe, ou le téléphone du parent), puis <strong>cliquer sur l’élève</strong> dans les résultats. « Changer » permet de corriger le choix.</li>
<li>Le <strong>tarif de sa classe</strong> est proposé automatiquement. Vérifier, ou choisir un autre tarif (ex. Inscription).</li>
<li>Choisir le <strong>mode de règlement</strong> : Espèces, MTN Mobile Money, Orange Money ou Virement bancaire.</li>
<li>Lire le résumé : montant et <strong>nouvelle date de validité</strong>. Valider avec « Encaisser … FCFA ».</li>
<li>Le <strong>reçu</strong> s’ouvre : « Imprimer le reçu », ou choisir « Enregistrer au format PDF » dans la fenêtre d’impression pour l’envoyer au parent.</li></ol>
${button('Enregistrer un paiement','payment-new','plus','secondary small-btn')}
<h4>Les règles à connaître</h4>
<ul><li>Le montant est celui du tarif, sans modification possible : <strong>pas de paiement partiel ni de remise</strong> dans cette version.</li>
<li><strong>Inscription et mensualité</strong> sont deux opérations distinctes. L’inscription (2 500 FCFA) ne donne aucun jour de validité.</li>
<li>Une mensualité ajoute <strong>30 jours</strong> (durée réglable par le directeur dans Paramètres).</li>
<li><strong>Renouvellement anticipé</strong> : si l’élève a encore des jours, ils sont conservés. Exemple : validité jusqu’au 10 décembre, paiement le 1er décembre → nouvelle validité jusqu’au 9 janvier.</li>
<li><strong>Après expiration</strong> : la nouvelle période part du jour du paiement. Exemple : validité expirée le 10 novembre, paiement le 18 novembre → jusqu’au 18 décembre.</li>
<li>Le paiement est toujours daté <strong>du jour</strong> : impossible d’antidater.</li>
<li><strong>MTN / Orange Money</strong> servent à noter un règlement <strong>déjà reçu</strong> sur le téléphone du centre : l’application ne prélève rien.</li></ul>
<h4>Revoir ou réimprimer un reçu</h4>
<p>Page « Paiements » ou fiche élève : cliquer sur la ligne du paiement. Un paiement enregistré deux fois ou sur le mauvais élève se corrige par une annulation (voir « La caisse »).</p>`},

{ id:'caisse', title:'7. La caisse', role:'all', html:`
<p>« Caisse & mouvements » liste toutes les entrées et sorties d’argent : paiements d’élèves, autres recettes, dépenses, salaires et avances des enseignants, soldes initiaux et annulations.</p>
<h4>Enregistrer une dépense</h4>
<ol><li><strong>Enregistrer une dépense</strong>.</li><li>Choisir le siège (la secrétaire : le sien), le montant, le mode de règlement.</li>
<li>Indiquer une <strong>catégorie</strong> courte (Fournitures, Loyer, Transport, Électricité…) et un <strong>motif</strong> précis (« 2 boîtes de craies et 4 marqueurs »).</li><li>Valider : le justificatif s’affiche et peut être imprimé.</li></ol>
${button('Enregistrer une dépense','expense-new','plus','secondary small-btn')}
<p class="manual-tip">${icon('book')}<span>Un salaire ou une avance d’enseignant se saisit dans « Enseignants & paie », pas comme une dépense : sinon le reste à payer de l’enseignant ne serait pas mis à jour.</span></p>
<h4>Autre recette</h4>
<p>Pour une entrée qui n’est pas le paiement d’un élève (don, vente de fascicules…). Les frais d’un élève passent toujours par « Enregistrer un paiement », pour mettre à jour sa validité.</p>
<h4>Lire la caisse</h4>
<ul><li><strong>Total des entrées</strong>, <strong>total des sorties</strong>, <strong>solde disponible</strong> = entrées − sorties, toutes périodes et tous modes de paiement confondus (espèces + Mobile Money + virements).</li>
<li>Filtres : Tout / Entrées / Sorties, et recherche par référence, nom ou motif.</li>
<li>Le filtre de session ne change pas la caisse : elle couvre toute l’histoire du siège.</li></ul>
<h4>Corriger une erreur</h4>
<p>Une opération n’est <strong>jamais supprimée</strong>. Le manager ouvre son justificatif et clique sur <strong>Annuler l’opération</strong>, avec un motif. Une contre-écriture de même montant est créée ; l’original reste visible, marqué <span class="badge expired">Annulée</span>. Pour un paiement d’élève, sa validité est recalculée. Il suffit ensuite d’enregistrer l’opération correcte. La secrétaire signale l’erreur au directeur avec la référence (ex. GR-20261118-…).</p>`},

{ id:'solde-initial', title:'8. Solde initial d’un siège', role:'manager', html:`
<p>Si un siège démarre avec de l’argent en caisse, saisir ce montant une seule fois : c’est une entrée tracée comme les autres. Facultatif si la caisse démarre à zéro. Un second solde initial est refusé : utiliser ensuite une recette ou une dépense de rectification.</p>
${button('Enregistrer un solde initial','opening-new','wallet','secondary small-btn')}`},

{ id:'enseignants', title:'9. Enseignants et paie', role:'all', html:`
<h4>Deux façons de payer un enseignant</h4>
<table class="manual-table"><thead><tr><th></th><th>À l’heure</th><th>Salaire mensuel fixe</th></tr></thead><tbody>
<tr><td>Fixé dans la fiche</td><td>Un taux horaire propre à l’enseignant (ex. 2 000 FCFA/h)</td><td>Un salaire par mois (ex. 80 000 FCFA)</td></tr>
<tr><td>Dû du mois</td><td>Somme des séances du mois</td><td>Le salaire, dès le mois d’entrée (mois complet)</td></tr>
<tr><td>Séances</td><td>Indispensables : elles font le salaire</td><td>Facultatives, pour le suivi</td></tr></tbody></table>
<h4>Créer la fiche d’un enseignant <span class="badge blue">Manager</span></h4>
<ol><li>« Enseignants & paie » puis <strong>Nouvel enseignant</strong>.</li><li>Nom, téléphone, matières, date d’entrée.</li><li>Choisir le <strong>mode de paie</strong>, puis le taux horaire <em>ou</em> le salaire mensuel.</li><li>« Créer la fiche ».</li></ol>
<h4>Saisir une séance</h4>
<ol><li><strong>Saisir une séance</strong> (page Enseignants, raccourci du tableau de bord, ou icône ${icon('clock')} d’une ligne).</li>
<li>Choisir l’enseignant, le siège, la date (aujourd’hui ou passée, jamais future), la <strong>durée en heures</strong> : 2 pour 2 h, <strong>1,5 pour 1 h 30</strong>, 0,75 pour 45 min. Matière et classe sont facultatives mais utiles.</li>
<li>Valider : le message indique le montant ajouté (ex. 1,5 h × 2 000 = 3 000 FCFA).</li></ol>
${button('Saisir une séance','session-new','clock','secondary small-btn')}
<h4>Lire la paie du mois</h4>
<p>Choisir le <strong>mois de paie</strong> au-dessus du tableau. Pour chaque enseignant : <strong>Dû</strong>, <strong>Avances</strong>, <strong>Versé</strong> et <strong>Reste</strong> = dû − avances − versé, avec un statut : <span class="badge urgent">À payer</span> <span class="badge warning">Partiellement payé</span> <span class="badge active">Soldé</span> <span class="badge expired">Trop-perçu</span>. La secrétaire voit les totaux de chaque enseignant, mais seulement les séances et versements de son siège.</p>
<h4>Verser une avance ou le salaire</h4>
<ol><li>Bouton <strong>Payer</strong> sur la ligne de l’enseignant.</li><li>Choisir <strong>Salaire du mois</strong> (montant proposé : le reste dû) ou <strong>Avance sur salaire</strong>.</li><li>Choisir la caisse du siège qui paie et le mode de règlement, puis valider. Un bulletin imprimable s’affiche.</li></ol>
<ul><li>Un salaire ne peut pas dépasser le reste à payer. Une avance est libre et sera déduite du salaire du même mois.</li>
<li>Impossible de payer un mois qui n’a pas commencé.</li>
<li>Dès la première avance ou le premier salaire d’un mois, le <strong>barème de ce mois est figé</strong> : un changement de salaire dans la fiche s’applique aux mois suivants. Un changement de taux horaire ne modifie pas les séances déjà saisies.</li></ul>
<h4>Exemple complet</h4>
<p>Paul est payé 2 000 FCFA/h. En novembre : 3 séances de 2 h, 1 h 30 et 2 h = 5,5 h → <strong>dû 11 000 FCFA</strong>. Avance le 10 : 5 000. Le 30, « Payer » propose <strong>6 000 FCFA</strong> ; après versement, Paul est <span class="badge active">Soldé</span>.</p>
<h4>Corriger</h4>
<ul><li><strong>Séance erronée</strong> : ouvrir la fiche de l’enseignant, icône ${icon('undo')} de la séance, motif. Elle reste visible, barrée, et sort du calcul. La secrétaire peut annuler les séances de son siège.</li>
<li><strong>Avance ou salaire erroné</strong> : le manager annule l’opération depuis son justificatif, comme pour toute opération de caisse.</li>
<li><strong>Départ d’un enseignant</strong> <span class="badge blue">Manager</span> : solder ses mois, puis décocher « Enseignant actif » dans sa fiche. Son historique reste consultable.</li></ul>`},

{ id:'sieges', title:'10. Les sièges', role:'all', html:`
<p>« Nos sièges » affiche chaque siège avec son adresse, son téléphone, ses élèves de la session et le solde de sa caisse. « Ouvrir le tableau de bord » filtre l’application sur ce siège.</p>
<p><span class="badge blue">Manager</span> Le bouton ${icon('edit')} corrige le nom, l’adresse ou le téléphone ; « Ajouter un siège » crée une nouvelle implantation. Un siège n’est jamais supprimé, pour garder son historique.</p>`},

{ id:'equipe', title:'11. Équipe et accès', role:'manager', html:`
<h4>Créer un accès secrétaire</h4>
<ol><li>« Équipe & accès » puis <strong>Créer un accès secrétaire</strong>.</li><li>Nom, identifiant (ex. <code>prenom.siege@ruisseaudusucces.local</code>), <strong>siège attribué</strong>, mot de passe initial de 12 caractères au moins.</li>
<li>Remettre les identifiants <strong>en main propre</strong> et demander à la secrétaire de changer son mot de passe dès la première connexion.</li></ol>
<h4>Modifier, désactiver, réinitialiser</h4>
<p>« Modifier » sur la ligne du compte permet de changer le nom, l’identifiant, le siège, de <strong>désactiver</strong> le compte (départ, absence prolongée) ou de saisir un <strong>nouveau mot de passe</strong> (oubli). Toute modification déconnecte immédiatement les sessions ouvertes de ce compte.</p>`},

{ id:'parametres', title:'12. Paramètres : tarifs et session', role:'manager', html:`
<h4>Tarifs</h4>
<ul><li>« Ajouter » crée un tarif : libellé, montant, durée en jours (<strong>0 = frais sans prolongation</strong>, comme l’inscription ; 30 = une mensualité).</li>
<li>Pour que le tarif soit proposé automatiquement, mettre la classe dans le libellé, comme « Répétition · Terminale A ».</li>
<li>Un changement de montant ne modifie jamais les paiements déjà encaissés. Pour retirer un tarif, le désactiver plutôt que le transformer.</li></ul>
<h4>Session scolaire par défaut</h4>
<p>Au changement d’année (ex. passage à 2027-2028), modifier la session par défaut. Les inscriptions précédentes restent consultables en choisissant l’ancienne session dans la barre du haut.</p>`},

{ id:'journal', title:'13. Journal d’activité', role:'manager', html:`
<p>Chaque connexion, inscription, modification, paiement, annulation, séance et versement est enregistré avec son auteur, son siège et l’heure (en temps universel, UTC : ajouter 1 h pour l’heure de Yaoundé). Utile pour comprendre une erreur ou vérifier une activité inhabituelle.</p>`},

{ id:'routines', title:'14. Routines conseillées', role:'all', html:`
<h4>Chaque jour</h4>
<ul><li>Encaisser chaque paiement <strong>au moment où l’argent est reçu</strong> et remettre le reçu.</li><li>Saisir les dépenses et les séances du jour.</li><li>En fin de journée : comparer l’argent réellement en caisse (espèces + Mobile Money) avec le solde affiché.</li></ul>
<h4>Chaque semaine</h4>
<ul><li>Élèves → filtre « Échéance proche » et « Expirés » : appeler les parents depuis la fiche.</li></ul>
<h4>Chaque fin de mois</h4>
<ul><li>Enseignants & paie : vérifier les heures du mois, verser les salaires, contrôler que tout est <span class="badge active">Soldé</span>.</li><li><span class="badge blue">Manager</span> Parcourir la caisse de chaque siège et le journal d’activité.</li></ul>
<h4>À chaque rentrée</h4>
<ul><li><span class="badge blue">Manager</span> Mettre à jour la session par défaut et les tarifs.</li><li>Créer les fiches des élèves dans la nouvelle session.</li></ul>`},

{ id:'faq', title:'15. Questions fréquentes', role:'all', html:`
<dl class="manual-faq">
<dt>Je ne trouve pas un élève.</dt><dd>Vérifier la <strong>session</strong> et le <strong>siège</strong> choisis en haut de l’écran, puis le filtre (« Tous »). Chercher aussi par le téléphone du parent.</dd>
<dt>« Vous ne pouvez accéder qu’aux données de votre siège ».</dt><dd>L’élève ou la caisse appartient à un autre siège : s’adresser au secrétariat concerné ou au directeur.</dd>
<dt>J’ai encaissé le mauvais tarif ou le mauvais élève.</dt><dd>Noter la référence du reçu et demander au directeur d’annuler l’opération ; puis encaisser à nouveau correctement.</dd>
<dt>Un parent paie seulement une partie.</dt><dd>Les paiements partiels ne sont pas gérés : attendre le montant complet, ou demander au directeur s’il faut créer un tarif adapté.</dd>
<dt>« Le montant dépasse le reste à payer ».</dt><dd>L’enseignant a déjà reçu des avances ou une partie de son salaire ce mois-ci : le montant proposé par défaut est le bon.</dd>
<dt>« Session de formulaire expirée » ou retour à la connexion.</dt><dd>La session a duré plus de 8 heures ou l’accès a été modifié : recharger la page et se reconnecter. Rien de ce qui a été validé n’est perdu.</dd>
<dt>« Une erreur est survenue. Vérifiez la connexion à la base de données ».</dt><dd>La base de données n’a pas répondu à temps : patienter quelques secondes puis réessayer. Si l’erreur se répète, prévenir le directeur (vérifier l’état de la base dans l’administration alwaysdata).</dd>
<dt>La page ne s’ouvre pas du tout.</dt><dd>Vérifier la connexion internet et l’adresse (elle commence par <code>https://</code>). Si le problème persiste pour tout le monde, prévenir le directeur.</dd></dl>`},

{ id:'demarrage', title:'16. Hébergement et version locale', role:'manager', html:`
<p>L’application est en ligne : l’interface et le serveur sont hébergés sur <strong>Vercel</strong> (région Paris), les données sur <strong>alwaysdata</strong> (MariaDB, connexion chiffrée). Rien n’est à démarrer : il suffit d’ouvrir l’adresse de l’application, depuis n’importe quel siège.</p>
<ul><li><strong>Mise à jour</strong> : chaque modification envoyée sur la branche <code>main</code> du dépôt GitHub est déployée automatiquement par Vercel.</li>
<li><strong>Sauvegardes</strong> : alwaysdata sauvegarde les bases ; un export régulier depuis phpMyAdmin (Exporter → SQL) reste une bonne précaution.</li>
<li><strong>Version locale</strong> (dépannage, essais) : démarrer WampServer, double-cliquer sur <strong>DEMARRER.cmd</strong>, laisser la fenêtre ouverte et ouvrir <code>http://127.0.0.1:3010</code>. Elle utilise la base indiquée dans le fichier <code>.env</code> de l’ordinateur.</li></ul>`},
];
