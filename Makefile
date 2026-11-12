# bleak-node front-end — developer tasks

.DEFAULT_GOAL := help
TASK_DB := tasks.db

.PHONY: help setup dev build test lint task-list task-show session-list log-tail

help: ## Show this help
	@echo "bleak-node front-end"
	@echo
	@echo "Feature targets (placeholders — the architect makes them real):"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

setup: ## Install dependencies (placeholder)
	@echo "placeholder: npm/pnpm install — implemented by the architect"

dev: ## Run the dev server (placeholder)
	@echo "placeholder: dev server — implemented by the architect"

build: ## Production build (placeholder)
	@echo "placeholder: production build — implemented by the architect"

test: ## Run tests (placeholder)
	@echo "placeholder: test runner — implemented by the architect"

lint: ## Run linter (placeholder)
	@echo "placeholder: linter — implemented by the architect"

# --- coordination wrappers -------------------------------------------------

task-list: ## List tasks (make task-list [STATUS=todo])
	@python3 scripts/task.py list $(STATUS)

task-show: ## Show one task (make task-show ID=1)
	@test -n "$(ID)" || { echo "usage: make task-show ID=1"; exit 1; }
	@python3 scripts/task.py show $(ID)

session-list: ## List session records (make session-list [STATUS=running])
	@bash scripts/session.sh list $(STATUS)

log-tail: ## Tail an instance log (make log-tail HASH=1640ba9e)
	@test -n "$(HASH)" || { echo "usage: make log-tail HASH=1640ba9e"; exit 1; }
	@tail -n 20 docs/logs/$(HASH).log 2>/dev/null || echo "no log for $(HASH)"
