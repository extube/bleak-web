# bleak-node front-end — developer tasks
#
# Stack: npm-workspaces monorepo (apps/web SvelteKit SPA, apps/helper thin
# service, packages/api-client). See docs/ARCHITECTURE.md.

.DEFAULT_GOAL := help
TASK_DB := tasks.db

.PHONY: help setup dev dev-helper dev-web build test lint fmt clean task-list task-show session-list log-tail

help: ## Show this help
	@echo "bleak-node front-end"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

setup: ## Install all workspace dependencies
	npm install

dev: ## Run helper (:8787) + web dev server (:5173, proxies /api and /h)
	npm run dev

dev-web: ## Run only the SPA dev server
	npm run dev -w @bleak/web

dev-helper: ## Run only the helper service
	npm run dev -w @bleak/helper

build: ## Production build (typecheck + static SPA bundle + helper dist)
	npm run build

test: ## Run the unit test suite (vitest, all workspaces)
	npm run test

lint: ## Lint everything (eslint flat config)
	npm run lint

fmt: ## Check formatting-adjacent issues via eslint --fix
	npx eslint . --fix

clean: ## Remove build artifacts
	rm -rf apps/web/build apps/web/.svelte-kit apps/helper/dist packages/*/dist

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
