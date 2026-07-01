# Budgie - Projet IBC

Budgie est une application web de gestion de budget développée pour le projet IBC.
Le but est de permettre à un utilisateur de gérer ses comptes, ses dépenses, ses revenus, ses quotas, son abonnement Premium et le partage de comptes avec d'autres utilisateurs.

Le projet a été réalisé à deux :

- Alexandre Sage - GitHub `AlexandreSag`
- William Sage - GitHub `pilliam91`

## Objectif du projet

L'objectif du projet est de créer une application complète autour de la gestion de budget personnel, en respectant le sujet qui nous a été donné.
L'application permet à un utilisateur de suivre ses comptes, d'ajouter ses revenus et ses dépenses, puis de visualiser l'impact sur son solde et ses prévisions.

Le sujet demandait aussi d'intégrer une partie blockchain.
Nous l'avons donc reliée au système d'abonnement Premium, avec un paiement en ETH ou en USDC, un historique des paiements et un renouvellement automatique.

Cette partie nous permet de montrer comment une application web peut communiquer avec un smart contract et un wallet comme MetaMask, tout en gardant une logique applicative classique côté backend et base de données.

## Fonctionnalités principales

- Création de compte utilisateur avec vérification par email.
- Connexion avec JWT stocké en cookie HTTP-only.
- Gestion des comptes bancaires.
- Ajout de dépenses et de revenus.
- Calcul du solde des comptes et affichage des prévisions.
- Quotas différents entre le plan Gratuit et le plan Premium.
- Page abonnement avec paiement Ethereum ou USDC.
- Renouvellement automatique en USDC via smart contract.
- Historique des paiements confirmés.
- Retour au plan Gratuit avec nettoyage des données qui dépassent les quotas.
- Partage d'un compte par invitation email, avec accès en lecture seule pour la personne invitée.

## Stack technique

Le projet est lancé avec Docker Compose.

- Frontend : React, Vite, React Router.
- Backend : Node.js, Express.
- Base de données : MySQL 8.
- Proxy : Nginx.
- Admin DB : phpMyAdmin.
- Blockchain locale : Anvil.
- Smart contract : Solidity compilé avec `solc`.
- Interaction blockchain : `viem`.

## Architecture

L'application est découpée en plusieurs services Docker.
Le frontend React est servi derrière Nginx, qui sert aussi de point d'entrée pour les appels API.
Le backend Express gère l'authentification, les données métier, les abonnements et les paiements.
La base MySQL stocke les utilisateurs, les comptes, les transactions, les abonnements et l'historique des paiements.

Pour la partie blockchain, le frontend communique avec MetaMask pour signer les transactions.
Le backend vérifie ensuite les paiements et garde l'état de l'abonnement en base.
Anvil sert de blockchain de test, avec un fork Ethereum quand on veut utiliser le vrai contrat USDC dans un environnement local.

Flux principal :

```txt
Navigateur
  -> Nginx
  -> Frontend React
  -> API Express
  -> MySQL

MetaMask
  -> Anvil
  -> SubscriptionCore
```

## Structure du projet

```txt
.
├── backend/        # API Express, auth, abonnements, paiements, partage
├── contracts/      # Smart contract SubscriptionCore et scripts Anvil
├── database/       # Schéma SQL et migrations
├── frontend/       # Application React
├── nginx/          # Configuration du reverse proxy
├── compose.yml     # Services Docker
├── .env.example    # Exemple de configuration
└── README.md
```

## Prérequis

- Docker
- Docker Compose
- Node.js si on lance certains scripts hors Docker
- MetaMask pour tester les paiements blockchain

## Installation

Copier le fichier d'exemple :

```bash
cp .env.example .env
```

Puis adapter les variables utiles dans `.env`.

Pour un lancement simple en local, les valeurs par défaut suffisent pour MySQL et l'application.
Pour tester USDC sur le fork Ethereum, il faut ajouter une URL RPC mainnet dans `ANVIL_FORK_URL`, par exemple via Alchemy ou Infura.

## Lancer le projet

```bash
docker compose up --build
```

Accès principaux :

- Application : http://localhost
- API : http://localhost/api
- phpMyAdmin : http://localhost/phpmyadmin
- Anvil RPC : http://localhost:8545

Identifiants MySQL par défaut :

- Serveur : `db`
- Utilisateur : `ibc_user`
- Mot de passe : `ibc_password`
- Base : `ibc_db`

## Déploiement

Pour le déploiement serveur, nous utilisons Docker et un tunnel Cloudflare déjà configuré sur la machine.
Le fichier `compose.prod.yml` sert à lancer l'application sans exposer directement les ports publics du projet.
Cloudflare Tunnel redirige ensuite les domaines vers les conteneurs Docker.

Domaines utilisés en déploiement :

- `https://budgie.batouney.com` : application Budgie.
- `https://anvil.batouney.com` : RPC Anvil utilisé par MetaMask.

Le backend utilise directement `http://anvil:8545` dans le réseau Docker.
Le frontend utilise l'URL publique du RPC, car MetaMask tourne dans le navigateur de l'utilisateur.

## Paiement et abonnement

Le paiement Premium peut se faire de deux façons :

- En ETH : paiement direct pour une durée choisie dans la modale.
- En USDC : paiement avec activation du renouvellement automatique.

Le smart contract principal est `SubscriptionCore`.
Il gère surtout le paiement USDC et le renouvellement automatique.

En local, Anvil est utilisé comme blockchain de test.
Le projet peut être lancé avec un fork Ethereum pour utiliser le vrai contrat USDC mainnet dans un environnement local.

Commandes utiles côté contracts :

```bash
cd contracts
npm install
npm run compile
npm run deploy:fork
npm run fund:fork
```

Après un redéploiement du contrat, il faut mettre à jour `SUBSCRIPTION_CORE_ADDRESS` dans `.env`.

## Variables importantes

Les variables principales sont dans `.env.example`.

- `APP_BASE_URL` : URL de l'application, utilisée pour les liens email.
- `JWT_SECRET` : secret utilisé pour signer les tokens.
- `SMTP_*` : configuration email.
- `ETH_WALLET_ADDRESS` : wallet qui reçoit les paiements ETH.
- `ANVIL_FORK_URL` : URL RPC utilisée pour forker Ethereum.
- `SUBSCRIPTION_CORE_ADDRESS` : adresse du contrat déployé.
- `USDC_WHALE_ADDRESS` : wallet utilisé pour créditer des USDC de test sur le fork.
- `AUTO_RENEW_RUNNER_PRIVATE_KEY` : clé utilisée par le backend pour lancer les renouvellements.

## Commandes de développement

Lint global :

```bash
npm run lint
```

Frontend :

```bash
cd frontend
npm install
npm run dev
npm run build
```

Backend :

```bash
cd backend
npm install
npm run dev
```

Contracts :

```bash
cd contracts
npm install
npm run compile
```

## Remettre l'environnement à zéro

Pour repartir sur une base propre :

```bash
docker compose down -v
docker compose up --build
```

Cette commande supprime les volumes Docker, donc aussi la base MySQL et l'état Anvil.

## Notes

- Le backend parle à MySQL via le réseau Docker interne.
- Le frontend passe par Nginx pour appeler l'API en `/api`.
- Le runner de renouvellement automatique tourne côté backend.
- Les comptes partagés sont visibles en lecture seule pour les utilisateurs invités.
