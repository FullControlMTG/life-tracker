.PHONY: help db db-stop db-reset api web install test build fmt image deploy deploy-down

help:
	@echo "make install     - install frontend deps and download Go modules"
	@echo "make db          - start Postgres in Docker (port 5433)"
	@echo "make api         - run the Go API on :8080 (migrates on boot)"
	@echo "make web         - run the Vite dev server on :5173"
	@echo "make test        - run backend and frontend tests"
	@echo "make build       - build the API binary and the production frontend"
	@echo "make db-reset    - drop the database volume and start fresh"
	@echo "make image       - build the production Docker image"
	@echo "make deploy      - build and start the Traefik stack (needs APP_DOMAIN, POSTGRES_PASSWORD)"
	@echo "make deploy-down - stop the Traefik stack, keeping the database volume"

install:
	cd backend && go mod download
	cd frontend && npm install

# The dev overlay only adds a loopback port binding to the database service.
DEV_COMPOSE = docker compose -f docker-compose.yml -f docker-compose.dev.yml

db:
	$(DEV_COMPOSE) up -d life-tracker-db
	@echo "Postgres listening on 127.0.0.1:5433"

db-stop:
	$(DEV_COMPOSE) stop life-tracker-db

db-reset:
	$(DEV_COMPOSE) rm -sfv life-tracker-db
	docker volume rm -f life-tracker_life-tracker-db
	$(DEV_COMPOSE) up -d life-tracker-db

# Migrations are embedded in the binary and applied on boot, so this is all
# that is needed after `make db`.
api:
	cd backend && go run ./cmd/server

web:
	cd frontend && npm run dev

test:
	cd backend && go test ./...
	cd frontend && npm test

build:
	cd backend && go build -o bin/server ./cmd/server
	cd frontend && npm run build

fmt:
	cd backend && go fmt ./... && go vet ./...

image:
	docker build -t life-tracker:local .

deploy:
	docker compose build --pull
	docker compose up -d

# No -v: the database volume must survive a redeploy.
deploy-down:
	docker compose down --remove-orphans
