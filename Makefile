
help:
	@grep '[[:space:]]##[[:space:]]' Makefile | sed 's/^\(.*\):.*##\(.*\)$$/#\2\nmake \1\n/'

sync-common-content:
	@npm run sync-css && npm run sync-head
	
preview: sync-common-content preview-antora ## Run hugo server for website hacking
	@npm run sync-css && npm run sync-head
	@cd website && hugo server --config hugo.toml

antora-local-build: sync-common-content ## Build antora docs once using your locally checked out git repos
	@cd antora && hack/local-build.sh

antora-local-live: sync-common-content ## Live build antora docs your locally checked out git repos
	@cd antora && hack/local-live.sh

preview-antora: ## Build antora docs
	
	@cd antora && npm ci && URL=http://localhost:1313/docs npm run build

build-antora: sync-common-content ## Build antora docs
	@cd antora && npm ci && npm run build

build-antora-fast: sync-common-content ## Build antora docs without re-fetching sources
	@cd antora && npm run build:fast

# Fixme: Not sure how to make the stylesheet and javascript urls work
PWD=$(shell pwd)
build-hugo: ## Build hugo docs
	@cd website && hugo --config hugo.toml
	@echo file://$(PWD)/public/index.html

build-all: build-antora build-hugo

ifndef THEME_NAME
THEME_NAME=night-owl
endif
download-highlight-js-theme:
	curl -s https://highlightjs.org/static/demo/styles/$(THEME_NAME).css > common/css/highlightjs-theme.css
