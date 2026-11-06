# OmniCom Facturation

Plateforme de facturation multi-entreprise éditée par **OmniCom**. Chaque entreprise cliente dispose
d'un espace isolé pour émettre ses **proformas**, **bons de commande** et **factures** à son logo et à ses couleurs, suivre
ses encaissements, ses clients, son stock et ses dépenses.

- **Frontend** : React 19 + TypeScript + Vite (`src/`)
- **API** : Express 5 + MongoDB/Mongoose (`server/`), déployable sur Vercel ou en Node classique

## Qui fait quoi

| Niveau | Qui | Peut |
|---|---|---|
| **Plateforme** | Équipe OmniCom (super-admins) | Créer les entreprises et leur administrateur, personnaliser leur profil, suspendre / réactiver un compte, réinitialiser un mot de passe, ajouter d'autres super-admins. N'accède pas aux données de facturation des entreprises. |
| **Entreprise** | Administrateur de l'entreprise | Tout dans son entreprise : logo et couleurs des factures, coordonnées, **création de rôles sur mesure**, utilisateurs. |
| **Entreprise** | Utilisateurs | Ce que leur rôle autorise (cases à cocher par permission). |

Seul OmniCom peut créer un compte entreprise : il n'y a pas d'inscription publique.

Un super-admin peut aussi **ouvrir la console d'une entreprise** (bouton « Ouvrir » dans **Entreprises**)
pour l'assister : il y dispose de tous les droits, un bandeau « Mode OmniCom » le rappelle, et chacune de
ses actions apparaît dans le journal de l'entreprise avec la mention « (OmniCom) ». « Revenir à la
plateforme » le ramène à la console OmniCom. Côté API, c'est l'en-tête `X-Company-Id`, accepté uniquement
pour les super-admins.

### Rôles et permissions

Chaque entreprise reçoit trois rôles de départ : **Administrateur** (verrouillé, accès complet),
**Gestionnaire** et **Employé**. L'administrateur peut les modifier ou créer les siens (ex. Caissier,
Magasinier) en combinant les permissions :

| Domaine | Permissions |
|---|---|
| Ventes | créer/modifier factures et proformas · annuler des factures · enregistrer / supprimer des encaissements · gérer / supprimer des clients |
| Opérations | gérer le catalogue · mouvements de stock · dépenses |
| Pilotage | rapports et résultats financiers · journal d'activité |
| Administration | utilisateurs · rôles · paramètres et personnalisation |

Tout utilisateur peut consulter les factures, clients et produits de son entreprise. Les droits sont
relus à chaque requête : un changement de rôle, un blocage ou la suspension d'une entreprise
prend effet immédiatement.

### Isolation des données

Chaque document (client, produit, facture, paiement, dépense, mouvement de stock, journal) porte
l'identifiant de son entreprise et toutes les requêtes de l'API sont filtrées dessus. La numérotation
(`FAC-2026-0001`, `PRO-2026-0001`) est propre à chaque entreprise. Les tests automatisés vérifient
qu'une entreprise ne peut ni lire ni modifier les données d'une autre.

## Modules d'une entreprise

| Module | Fonctionnalités |
|---|---|
| **Tableau de bord** | CA facturé et encaissé, créances et retards, résultat, graphique sur 12 mois, alertes de stock |
| **Factures & proformas** | Modèle imprimable A4/A5/A6 au logo, aux couleurs et aux coordonnées de l'entreprise, remise, échéance, conversion proforma → facture, annulation, export CSV |
| **Bons de commande** | Commande d'un client numérotée `BC-AAAA-0001`, au même modèle (titre « BON DE COMMANDE N° » personnalisable dans le modèle importé), modifiable tant qu'elle est en attente, sans effet sur le stock ni encaissement ; « Commande confirmée » la transforme en facture |
| **Encaissements** | Paiements partiels ou totaux, statut automatique, journal exportable |
| **Clients** | Fiches, solde dû par devise, historique |
| **Produits & stock** | Catalogue USD/FC, prix sur devis, stock décrémenté à la facturation, mouvements, seuils d'alerte |
| **Rapport du jour** | Pour une date : documents émis, facturé, encaissé, dépensé, résultat, caisse et comptes (début et fin de journée), produits vendus, mouvements d'argent ; impression sur une page A4 et résumé envoyé par WhatsApp |
| **Trésorerie** | Solde de chaque compte (Caisse, Mobile Money, Banque) en USD et en FC et total disponible ; journal unique des entrées (encaissements, autres entrées) et des sorties (dépenses) ; virements entre comptes et solde de départ |
| **Dépenses & rapports** | Dépenses par catégorie, rapports consolidés au taux de change de l'entreprise |
| **Entreprise & logo** | Logo, bandeau de bas de page, trois couleurs, coordonnées légales et bancaires, taux de change |
| **Signature et paiement en ligne** | Signature (et cachet) importée et imprimée au-dessus de « La direction » ; lien de paiement (ex. FlexPaie `vpos.flexpaie.com/pay/FPG_DRC`) imprimé avec son QR code et les moyens acceptés (M-Pesa, Orange Money, Airtel Money, Africell Money, Visa, Mastercard, RakkaCash, Masolo) sur les factures non réglées et ajouté au message WhatsApp |
| **Modèle de facture** | Modèle standard, ou **import du modèle de l'entreprise** (PDF, PNG, JPEG ; A4 ou A5) adapté dans un éditeur visuel |

## Pensé pour être simple

- **Créer un document en 3 étapes** : type et client → articles (catalogue en un clic, quantités avec − / +, article libre avec Entrée) → enregistrer. Les réglages rares (remise, numéro, taux, format, notes) sont repliés dans « Plus d'options ».
- **Après l'enregistrement** : imprimer, **envoyer par WhatsApp** (message prêt avec le montant et le reste à payer, au numéro de la fiche client), encaisser en un clic, ou **refaire un document identique**.
- **Recherche rapide** (`Ctrl + K` ou « Rechercher… ») : une page, un client ou un numéro de facture.
- **Sur téléphone** : barre de navigation en bas avec un gros bouton « + » pour créer un document.
- **Photos de profil** : chacun ajoute la sienne dans **Mon profil** (recadrée et allégée automatiquement) ; un administrateur peut mettre celle d'un collaborateur depuis **Utilisateurs**. Sans photo, les initiales s'affichent.
- Tableau de bord avec actions rapides et guide « Bien démarrer », thème clair ou sombre, confirmations claires.

## Importer son propre modèle de facture

Dans **Modèle de facture** (permission « Paramètres et personnalisation ») :

1. **Importer** une page vierge de son modèle : PDF (1re page convertie dans le navigateur), PNG ou JPEG.
   En-tête, pied de page, filigrane et coordonnées restent tels quels ; le format A4/A5 est détecté.
2. **Placer les zones** à la souris sur l'aperçu (déplacer, redimensionner par le coin) ou au pourcentage près :
   numéro et dates, client, tableau des articles, totaux, montant en lettres, notes, cachet PAYÉ/ANNULÉ.
   Chaque zone peut être masquée et alignée.
3. **Adapter** la police, la taille du texte, les couleurs du tableau et tous les libellés
   (ex. « FACTURE D'ACHAT N° », « P.U »).

Le rendu est **adaptatif** : chaque zone réduit automatiquement sa taille de texte pour que tout son contenu
tienne (un tableau de 25 lignes reste lisible en A5). Si une zone ne peut vraiment pas tout contenir,
un avertissement s'affiche dans l'éditeur et sur la facture. Le modèle s'applique à toutes les factures
et proformas, réimpressions comprises ; on peut revenir au modèle standard à tout moment sans perdre
le modèle importé.

## Installer l'application

OmniCom Facturation s'installe comme une application (PWA) depuis le site : page **`/installer`**, bouton
« Installer l'application » sur l'écran de connexion et dans le menu.

- **Android** (Chrome, Samsung Internet) et **ordinateur** (Chrome, Edge) : installation en un clic ;
- **iPhone / iPad** (Safari) : Partager → « Sur l'écran d'accueil ».

L'application a son icône OmniCom, s'ouvre en plein écran et fonctionne hors ligne. La fenêtre d'installation montre des captures de l'application ; la page `/installer` propose un QR code pour l'installer sur un téléphone depuis un ordinateur. Une nouvelle version s'annonce par « Mettre à jour » plutôt que de changer en pleine saisie. Chaque entreprise s'y connecte
à **son propre espace** ; les données (`/api`) ne sont jamais conservées sur l'appareil.

## Travailler hors ligne

L'application continue de fonctionner quand la connexion est coupée ou instable :

- **Consultation** : les dernières données consultées (tableau de bord, factures, clients, produits, trésorerie…)
  sont gardées sur l'appareil, pour l'utilisateur connecté uniquement ; elles sont effacées à la déconnexion.
  Le catalogue, les clients et le modèle de facture sont préparés dès la connexion.
- **Saisie** : factures et proformas, encaissements, dépenses, clients et mouvements de trésorerie saisis hors ligne
  sont mis en attente, puis **envoyés automatiquement** au retour du réseau (et toutes les 30 secondes). La facture reçoit
  son numéro définitif à l'envoi.
- **Sans doublon** : chaque saisie porte une clé d'idempotence (`Idempotency-Key`) ; si elle est renvoyée après une
  coupure, le serveur rejoue la première réponse au lieu d'enregistrer une deuxième fois.
- Un bandeau indique l'état (hors ligne, saisies en attente, envoi en cours) ; une saisie refusée par le serveur est
  montrée avec la raison. Une coupure de réseau ne déconnecte plus l'utilisateur.

La première connexion sur un appareil se fait en ligne.

## Catalogue de l'entreprise

Chaque entreprise démarre avec un catalogue vide et le construit elle-même : produit par produit, ou en important un
fichier **CSV** (Excel, Google Sheets) avec les colonnes Nom, Catégorie, Prix (ou « Sur devis »), Devise (USD ou FC),
Unité, Référence. Un modèle est téléchargeable depuis la fenêtre d'import ; un export du catalogue se réimporte tel quel.
Les produits déjà présents (même nom) sont ignorés.

## Page client : voir et payer une facture

Chaque facture et proforma a un **lien secret** (`/p/…`, impossible à deviner) envoyé au client par
**« Envoyer par WhatsApp »** ou **« Copier le lien client »** (SMS, e-mail). Le client l'ouvre sans compte, sur son
téléphone :

- montant à payer (reste dû), échéance, déjà payé ;
- bouton **« Payer en ligne »** vers le lien de paiement de l'entreprise (ex. FlexPaie : M-Pesa, Orange Money,
  Airtel Money, Africell Money, Visa, Mastercard, RakkaCash, Masolo), avec la référence et le montant à copier ;
- **nos numéros et comptes** (M-Pesa, Orange Money, Airtel Money, Africell Money, banque…) saisis dans
  *Entreprise & logo → Paiement des clients*, chacun avec un bouton « Copier » ; ils sont aussi imprimés sur les factures ;
- bouton **« J'ai payé »** : le client indique le moyen utilisé, le montant et la référence reçue par SMS. Rien n'est
  encaissé tout de suite : le paiement annoncé apparaît sur le tableau de bord et sur la facture, l'entreprise vérifie
  sur son téléphone ou son relevé puis clique **Reçu** (l'encaissement est créé, en Mobile Money, virement ou carte)
  ou **Pas reçu**. Le client voit le résultat sur sa page ;
- à défaut, les coordonnées bancaires ;

### Page de paiement en ligne (FlexPaie)

Dans *Entreprise & logo → Page de paiement en ligne*, trois modes :

- **Désactivé** : la page propose vos numéros et « J'ai payé » (ci-dessus).
- **Essai (sans argent)** : la vraie page de paiement fonctionne sans débiter personne. Le paiement est accepté
  après quelques secondes ; un numéro qui finit par `000` est refusé. Idéal pour montrer la page ou former l'équipe.
- **Réel (FlexPaie)** : saisissez le **code marchand** et la **clé API (jeton)** fournis par FlexPaie. La clé reste
  sur le serveur (jamais renvoyée au navigateur, jamais dans les journaux).

Le client ouvre le lien de sa facture (ou scanne le QR code imprimé, qui pointe maintenant vers cette page) et voit une page
aux couleurs et au logo de l'entreprise : il choisit **M-Pesa, Orange Money, Airtel Money, Africell Money** ou **la carte**
(Visa, Mastercard), saisit son numéro, puis confirme avec son code secret sur son téléphone. La carte passe par la page
sécurisée de FlexPaie puis revient sur la page du client. L'état est vérifié auprès de FlexPaie (toutes les 3 s pendant
que la page est ouverte, et à la notification de FlexPaie) : quand le paiement réussit, l'encaissement est créé
automatiquement (une seule fois), la facture passe en « Payée » et la trésorerie est à jour.

**Prestataire du paiement réel** (mode « Réel ») :

- **pawaPay** (recommandé pour démarrer) : inscription et environnement de **test gratuits**, clé API immédiate sur
  [dashboard.sandbox.pawapay.io](https://dashboard.sandbox.pawapay.io). M-Pesa (Vodacom), Orange Money et Airtel Money
  en RDC, demande de paiement envoyée **directement sur le téléphone** du client. En environnement *Test*, la page appelle
  vraiment pawaPay mais rien n'est encaissé (numéro de test M-Pesa qui réussit : 0973456789). Passez en *Réel* quand
  pawaPay a validé votre compte (commission par transaction, pas d'abonnement). Adresse de notification à saisir dans
  pawaPay (*Paramètres → Développeurs → URL de rappel → Dépôts* ; clé : *Paramètres → Développeurs → Jetons API* ; laisser *Sécurité des API* désactivée) : `https://VOTRE-SITE/api/public/pawapay/callback`.
  Les opérateurs proposés au client sont lus sur **votre compte pawaPay** (portefeuilles *Finances → Portefeuilles* :
  M-Pesa, Orange Money, Airtel Money, Africell Money… selon ce que pawaPay a ouvert), en ne gardant que ceux qui
  acceptent la devise de la facture. Le bouton **« Vérifier ma clé pawaPay »** (Entreprise & logo) interroge le vrai
  compte et affiche ces opérateurs : c'est le moyen de confirmer que la connexion fonctionne.
- **FlexPaie** : Mobile Money (dont Africell) et carte, avec le code marchand et la clé fournis par FlexPaie.

**Fiabilité du paiement**

- Coupure réseau au moment de l'envoi : le paiement reste « en cours » et est revérifié chez pawaPay avec le même
  identifiant (jamais renvoyé deux fois, jamais marqué échoué à tort). Une demande jamais arrivée est close après 2 minutes.
- Client parti avant la fin ou notification perdue : les paiements en cours sont revérifiés quand l'entreprise ouvre la
  facture ou le tableau de bord ; un paiement réussi est alors encaissé.
- Le client est guidé : opérateur détecté d'après le préfixe du numéro (« Ce numéro est un numéro Airtel Money »),
  limites de montant de l'opérateur vérifiées avant l'envoi, motifs de refus traduits (solde insuffisant, paiement non
  validé sur le téléphone…).
- Chaque facture affiche l'historique de ses paiements en ligne (réussi, en cours, échoué et pourquoi).

**Sécurité du paiement en ligne**

- La clé API FlexPaie est **chiffrée en base** (AES-256-GCM, clé `PAYMENT_SECRET_KEY` ou dérivée de `JWT_SECRET`) et
  n'est jamais renvoyée au navigateur. Si la clé du serveur change, ressaisissez la clé FlexPaie.
- Le montant est toujours calculé par le serveur (reste dû de la facture) ; le client ne peut pas le modifier.
- Un paiement n'est encaissé qu'après **vérification auprès de FlexPaie** ; la notification de FlexPaie n'est jamais crue
  telle quelle (lien secret par paiement + nouvelle vérification). Si FlexPaie annonce un autre montant ou une autre
  devise, rien n'est encaissé et une alerte est écrite au journal d'activité.
- Une même transaction FlexPaie ne peut servir qu'une fois ; un double clic ou une double notification n'encaisse
  jamais deux fois.
- Le **mode essai** n'encaisse jamais rien et ne change jamais la facture : un mode essai oublié ne peut pas faire passer
  une facture en « Payée ».
- Les adresses de retour (après la carte) et les liens imprimés ne viennent jamais de la requête : seulement de
  `PUBLIC_APP_URL`, `CORS_ORIGIN` ou de l'adresse du site (pas de redirection vers un faux site). En production, le
  paiement réel exige le https.
- Changement de mode, de code marchand ou de clé : tracé au journal d'activité (jamais la valeur de la clé).
- Limites de débit sur les pages publiques (consultation, paiement, « J'ai payé »).
- En-têtes de sécurité du site (`vercel.json`) : Content-Security-Policy, interdiction d'affichage dans un autre site
  (anti-hameçonnage), `Referrer-Policy: no-referrer` (le lien secret d'une facture ne fuit pas vers d'autres sites), HSTS.

Adresses de l'API utilisées par défaut (modifiables si FlexPaie vous en donne d'autres) :
`FLEXPAY_PAYMENT_URL=https://corporateapi.flexpay.cd/api/rest/v1/paymentService` et
`FLEXPAY_CHECK_URL=https://apicheck.flexpaie.com/api/rest/v1/check`.
- la facture elle-même (modèle standard ou importé), à télécharger en PDF.

Une facture réglée affiche « Facture réglée », une facture annulée « Facture annulée ». Si l'entreprise est
suspendue, ses liens ne s'ouvrent plus. La page ne montre que cette facture et les coordonnées imprimées dessus.

## Effacer les données de test

Dans **Entreprise & logo** (administrateur) ou dans **Gérer** (console OmniCom), « Effacer les données de test » supprime au choix :
factures, proformas et encaissements (la numérotation repart à 0001), dépenses et trésorerie, clients, produits et stock,
journal d'activité. L'entreprise, ses utilisateurs, ses rôles, son logo et son modèle de facture sont conservés. L'effacement
est définitif et n'est possible qu'en tapant le nom exact de l'entreprise ; il est inscrit au journal.

## Installation

```bash
docker compose up -d mongodb          # ou MongoDB Atlas

cd server
cp .env.example .env                  # MONGODB_URI, OMNICOM_ADMIN_PASSWORD
npm install && npm run dev            # http://localhost:5000

# autre terminal, dans ProformatWeb/
npm install && npm run dev            # http://localhost:5173
```

1. Définissez `OMNICOM_ADMIN_PASSWORD` : au premier démarrage, le compte administrateur OmniCom est créé
   automatiquement et vous vous connectez directement (ou utilisez l'écran **Installation** avec `SETUP_KEY`).
2. Dans **Entreprises**, créez chaque entreprise avec son logo et son administrateur.
3. L'administrateur se connecte, ajuste ses rôles et crée ses utilisateurs.

### Reprise des données existantes

Les données de la version précédente (mono-entreprise) sont rattachées automatiquement à l'entreprise
**Mélanine Print**, créée avec son logo, ses coordonnées et ses rôles ; les anciens comptes gardent leur
niveau (admin → Administrateur, gestionnaire → Gestionnaire, employé → Employé). Migration idempotente,
aussi disponible via `npm --prefix server run migrate`.

## Variables d'environnement (API)

| Variable | Obligatoire | Description |
|---|:-:|---|
| `MONGODB_URI` | ✅ | Chaîne de connexion MongoDB (Atlas : autoriser `0.0.0.0/0` dans Network Access pour Vercel). Sans nom de base dans l'adresse (adresse copiée telle quelle depuis Atlas), la base `proformat` est utilisée |
| `MONGODB_DB` | | Nom de la base à utiliser à la place de celui de l'adresse (par défaut : celui de l'adresse, sinon `proformat`) |
| `OMNICOM_ADMIN_PASSWORD` | ✅ au premier démarrage | Crée automatiquement le compte administrateur OmniCom (8 caractères minimum). Jamais écrasé ensuite : changez le mot de passe dans l'application |
| `OMNICOM_ADMIN_EMAIL` | | E-mail de ce compte (défaut `mpunantitarubain@gmail.com`) ; un ancien compte portant cet e-mail devient le compte OmniCom |
| `JWT_SECRET` | | Secret des sessions ; s'il est absent, il est dérivé de `MONGODB_URI` |
| `SETUP_KEY` | | Alternative : écran « Installation » pour créer le premier compte OmniCom |
| `JWT_EXPIRES_IN` | | Durée d'une session (défaut `12h`) |
| `CORS_ORIGIN` | | Origines autorisées, séparées par des virgules |

`GET /api/health` indique les variables manquantes (noms uniquement) ; l'écran de connexion affiche
le réglage à compléter.

Sur Vercel : **Project → Settings → Environment Variables** (jamais dans un fichier commité).

## Tests

```bash
npm --prefix server test                                                             # MongoDB en mémoire
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/proformat_test npm --prefix server test   # base locale
npm run lint && npm run build                                                        # frontend
```

Couverture : installation protégée, création d'entreprise réservée à OmniCom, rôles sur mesure et
permissions, blocage et suspension, personnalisation (logo, couleurs), modèle importé (validation, droits, isolation), 2FA, photos de profil, trésorerie (soldes, virements, droits), rapport journalier, effacement des données de test, signature et lien de paiement, page client publique, cycle de facturation
complet, isolation entre entreprises et migration des anciennes données.
