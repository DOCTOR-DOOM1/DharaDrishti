.PHONY: up down seed test demo lint clean logs

# ── Default ──
.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Stack ──
up: ## Start all services
	docker compose up -d --build
	@echo "⏳ Waiting for services..."
	@sleep 5
	@echo "✅ Stack is up — API at http://localhost:8000"

down: ## Stop all services
	docker compose down

logs: ## Tail service logs (use SVC=api to filter)
	docker compose logs -f $(SVC)

# ── Data ──
seed: ## Seed database and MinIO (SOURCE=fixture|real)
	@if [ -z "$(SOURCE)" ]; then echo "❌ Usage: make seed SOURCE=fixture|real"; exit 1; fi
	docker compose exec api python -m app.seed --source $(SOURCE)

# ── Tests ──
test: ## Run all tests
	docker compose exec api pytest api/tests/ -v
	@echo "──────────────────────────────"
	@echo "Pipeline tests (if env exists):"
	-cd pipeline && python -m pytest tests/ -v 2>/dev/null || echo "⚠️  Pipeline tests skipped (no env)"
	@echo "──────────────────────────────"
	-cd web && npm test 2>/dev/null || echo "⚠️  Web tests skipped (no node_modules)"

# ── Demo ──
demo: ## Full demo pipeline: up → seed fixture → verify
	$(MAKE) up
	@sleep 8
	$(MAKE) seed SOURCE=fixture
	@echo ""
	@echo "🎯 Demo ready!"
	@echo "   API:    http://localhost:8000/docs"
	@echo "   TiTiler: http://localhost:8001"
	@echo "   MinIO:  http://localhost:9001"
	@echo "   Web:    http://localhost:5173 (run 'cd web && npm run dev')"

# ── Quality ──
lint: ## Lint all code
	docker compose exec api ruff check app/ --fix
	docker compose exec api ruff format app/
	-cd web && npx eslint src/ 2>/dev/null || true

# ── Cleanup ──
clean: ## Remove containers, volumes, and build cache
	docker compose down -v --remove-orphans
	docker system prune -f

# ── Database ──
migrate: ## Run Alembic migrations
	docker compose exec api alembic upgrade head

migrate-new: ## Create a new migration (MSG="description")
	docker compose exec api alembic revision --autogenerate -m "$(MSG)"
