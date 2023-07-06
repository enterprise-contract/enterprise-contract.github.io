
help:
	@grep '[[:space:]]##[[:space:]]' Makefile | sed 's/^\(.*\):.*##\(.*\)$$/#\2\nmake \1\n/'

hugo-server: ## Run hugo server for website hacking
	@cd website && hugo server

preview: preview-antora hugo-server ## Run hugo server for website hacking with pre-built antora docs

antora-local-build: ## Build antora docs once using your locally checked out git repos
	@cd antora && hack/local-build.sh

antora-local-live: ## Live build antora docs your locally checked out git repos
	@cd antora && hack/local-live.sh

preview-antora: ## Build antora docs
	@cd antora && npm ci && URL=http://localhost:1313/docs npm run build

build-antora: ## Build antora docs
	@cd antora && npm ci && npm run build

build-antora-fast: ## Build antora docs without re-fetching sources
	@cd antora && npm run build:fast

PWD=$(shell pwd)
build-hugo: ## Build hugo docs
	@cd website && env HUGO_ENVIRONMENT=development hugo
	@echo file://$(PWD)/public/index.html

build-all: build-antora build-hugo

ifndef THEME_NAME
THEME_NAME=night-owl
endif
download-highlight-js-theme:
	curl -s https://highlightjs.org/static/demo/styles/$(THEME_NAME).css > website/assets/css/highlight.css
