.PHONY: help dev prod stop logs clean db-reset

# Default target
help:
	@echo "Cloud Azure - Docker Commands"
	@echo ""
	@echo "Development (with hot reload):"
	@echo "  make dev          - Start all services in development mode"
	@echo "  make dev-logs     - View logs in development mode"
	@echo "  make dev-stop     - Stop development services"
	@echo ""
	@echo "Production (built containers):"
	@echo "  make prod         - Build and start all services in production mode"
	@echo "  make prod-logs    - View logs in production mode"
	@echo "  make prod-stop    - Stop production services"
	@echo ""
	@echo "With Nginx reverse proxy:"
	@echo "  make prod-nginx   - Start with Nginx (access via localhost:8080)"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs         - View all logs"
	@echo "  make stop         - Stop all services"
	@echo "  make clean        - Stop and remove all containers, volumes"
	@echo "  make db-reset     - Reset database (delete data)"
	@echo "  make db-shell     - Open PostgreSQL shell"

# Development mode (with hot reload)
dev:
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "Services started in development mode!"
	@echo "  Frontend: http://localhost:5173"
	@echo "  Backend:  http://localhost:3001"
	@echo "  Database: localhost:5432"
	@echo ""
	@echo "Run 'make dev-logs' to view logs"

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

dev-stop:
	docker compose -f docker-compose.dev.yml down

# Production mode (built containers)
prod:
	docker compose up -d --build
	@echo ""
	@echo "Services started in production mode!"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:3001"
	@echo "  Database: localhost:5432"
	@echo ""
	@echo "Run 'make prod-logs' to view logs"

prod-logs:
	docker compose logs -f

prod-stop:
	docker compose down

# Production with Nginx
prod-nginx:
	docker compose --profile with-nginx up -d --build
	@echo ""
	@echo "Services started with Nginx!"
	@echo "  App (via Nginx): http://localhost:8080"
	@echo ""
	@echo "Run 'make prod-logs' to view logs"

# General utilities
logs:
	docker compose -f docker-compose.dev.yml logs -f 2>/dev/null || docker compose logs -f

stop:
	docker compose -f docker-compose.dev.yml down 2>/dev/null || true
	docker compose down 2>/dev/null || true

clean:
	docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true
	docker compose down -v 2>/dev/null || true
	@echo "All containers and volumes removed"

db-reset:
	docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true
	docker compose down -v 2>/dev/null || true
	docker volume rm cloud-azure_postgres_data 2>/dev/null || true
	@echo "Database reset complete"

db-shell:
	docker exec -it cloud-azure-db psql -U cloudazure -d cloudazure
