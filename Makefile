
_default: hugo-server

website/themes/antora-default-ui-hugo-theme:
	@git submodule update --init

hugo-theme: website/themes/antora-default-ui-hugo-theme

hugo-server: hugo-theme
	@cd website && hugo server --config hugo.toml

antora-build:
	@cd antora && hack/local-build.sh

antora-live:
	@cd antora && hack/local-live.sh

build-antora:
	@cd antora && npm run build

# Fixme: Not sure how to make the stylesheet and javascript urls work
PWD=$(shell pwd)
build-hugo:
	@cd website && hugo --config hugo.toml
	@echo file://$(PWD)/public/index.html

build-all: build-hugo build-antora
