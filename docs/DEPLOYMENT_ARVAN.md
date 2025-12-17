# Arvan Production Deployment (Bitnami Apache + PM2)

This document describes how to deploy the Foodapp monorepo to the Arvan server.

## Server Layout (current)

- Repo path: `/opt/foodapp/app`
- Environment file: `/opt/foodapp/config/.env`
- Web static root (Bitnami Apache): `/opt/bitnami/apache2/htdocs`
- API process manager: `pm2`
- API process name: `foodapp-api`
- API listens on: `127.0.0.1:3000`

## Pre-flight checks

```bash
cd /opt/foodapp/app
node -v
npm -v
pm2 -v
```

Optional:

```bash
pm2 status
sudo /opt/bitnami/ctlscript.sh status
```

## Full deploy (API + Web)

```bash
set -e

cd /opt/foodapp/app

git fetch origin
git checkout main
git pull origin main

npm install

npm run db:migrate -w @foodapp/api

npm run build -w @foodapp/api
npm run build -w @foodapp/web

sudo rm -rf /opt/bitnami/apache2/htdocs/*
sudo cp -R /opt/foodapp/app/apps/web/dist/* /opt/bitnami/apache2/htdocs/
sudo /opt/bitnami/ctlscript.sh restart apache

set -a
source /opt/foodapp/config/.env
set +a

pm2 restart foodapp-api --update-env
pm2 save

curl -i http://127.0.0.1:3000/api/v1/health
curl -i http://127.0.0.1/api/v1/health
```

## Restart API only

```bash
cd /opt/foodapp/app

set -a
source /opt/foodapp/config/.env
set +a

pm2 restart foodapp-api --update-env
pm2 save

pm2 logs foodapp-api --lines 50
curl -i http://127.0.0.1:3000/api/v1/health
```

## Deploy Web only

```bash
set -e

cd /opt/foodapp/app

git fetch origin
git checkout main
git pull origin main

npm install
npm run build -w @foodapp/web

sudo rm -rf /opt/bitnami/apache2/htdocs/*
sudo cp -R /opt/foodapp/app/apps/web/dist/* /opt/bitnami/apache2/htdocs/
sudo /opt/bitnami/ctlscript.sh restart apache
```

## Run DB migrations only

```bash
cd /opt/foodapp/app

set -a
source /opt/foodapp/config/.env
set +a

npm run db:migrate -w @foodapp/api
```

## Troubleshooting

### `pm2 restart foodapp-api` says "not found"

PM2 is per-user. First check the current user process list:

```bash
pm2 ls
```

If empty but you expect processes, try:

```bash
pm2 resurrect
pm2 ls
```

If it still doesn’t show, check if it’s managed under another user (commonly `root`):

```bash
sudo pm2 ls
```

### Apache troubleshooting

```bash
sudo /opt/bitnami/ctlscript.sh status
sudo /opt/bitnami/ctlscript.sh restart apache
```

### Logs

```bash
pm2 logs foodapp-api --lines 200
```

## Rollback (basic)

Deploy a known commit/tag, then rebuild and restart:

```bash
cd /opt/foodapp/app

git fetch origin
git checkout <commit-or-tag>

npm install
npm run db:migrate -w @foodapp/api

npm run build -w @foodapp/api
npm run build -w @foodapp/web

sudo rm -rf /opt/bitnami/apache2/htdocs/*
sudo cp -R /opt/foodapp/app/apps/web/dist/* /opt/bitnami/apache2/htdocs/
sudo /opt/bitnami/ctlscript.sh restart apache

set -a
source /opt/foodapp/config/.env
set +a

pm2 restart foodapp-api --update-env
pm2 save
```
