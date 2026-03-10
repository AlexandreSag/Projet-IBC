# Projet IBC

- un backend Node.js/Express ;
- un frontend React (Vite) ;
- une base de données MySQL ;
- un proxy Nginx en frontal ;
- phpMyAdmin pour l'administration MySQL ;

## Prérequis

- Docker

## Structure

```
.
├── backend/        # API Express + Dockerfile dédié
├── frontend/       # Application React + Dockerfile dédié
├── nginx/          # Proxy inverse Nginx + Dockerfile
├── compose.yml
├── .env.example    # Variables d'environnement pour Compose
└── README.md
```

## Configuration

1. Copier les variables d'exemple :
   ```bash
   cp .env.example .env
   ```
2. Ajuster le mot de passe root MySQL et les identifiants applicatifs si besoin.

Les valeurs sont ensuite injectées dans les conteneurs via `docker-compose.yml`.

## Démarrer l'environnement

```bash
docker compose up --build
```

- **frontend** : servi via Nginx sur http://localhost
- **backend** : accessible via le proxy (`/api/...`).
- **nginx** : reverse proxy unique exposé sur le port 80.
- **phpmyadmin** : interface d'administration MySQL via http://localhost/phpmyadmin.
- **db** : MySQL 8, volume persistant `db_data`, aucun port exposé vers l'hôte.

- Deux réseaux sont définis : `ibc-internal` (interne) pour le couple backend ↔ MySQL et `ibc-public` pour exposer uniquement le proxy Nginx et phpMyAdmin tout en leur donnant accès au frontend et au backend.

## Accès MySQL / phpMyAdmin

- URL : http://localhost/phpmyadmin
- Serveur : `db`
- Identifiants par défaut : `ibc_user` / `ibc_password` (définis dans `.env`).
- Le compte root reste accessible depuis l'intérieur du réseau docker (`root` / `rootpassword`).

## Notes de développement

- Le frontend Vite proxifie les appels `/api` vers le service `backend`, évitant d'ouvrir un port supplémentaire.
- Le backend expose une route de santé `/api/health` qui vérifie la connexion MySQL.
- Le backend expose `POST /api/login` (émission JWT), `GET /api/me` et `POST /api/logout` (routes protégées par middleware JWT).
- Pour relancer depuis zéro la base de données, supprimez le volume Docker `projet-ibc_db_data`.
