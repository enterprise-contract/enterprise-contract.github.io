# Conforma (formerly Enterprise Contract) website

This directory contains the configuration needed by [Antora][antora] to render
the content of the `docs` directory and documentation sources from other
directories as HTML.

Run `npm run build` to generate the rendered HTML files in the `public`
directory.

## Local development

Antora supports building from local git clone of the repository and with
uncommited changes. This is done by changing the `content/sources` in
`antora-playbook.yml` to point to the local directory for the `url` and `HEAD`
for `branches.

With `hack/local-build.sh` script performs this by creating a temporary playbook
file pointing to the local clones of the mentioned repositories if those
repositories are located in the `../<repository>` for a
`https://github.com/<org>/<repository>.git` git URL. For example, it is expected
that the `ec-policies` repository is located at `../ec-policies`. If the local
repository is on a different path create a symlink pointing from
`../<repository>` to that path.

The `hack/local-live.sh` script calls `hack/local-build.sh` for any changes to
files in the locally cloned repositories. Useful to leave in the background and
have the generated HTML site continuously updated.

[antora]: https://docs.antora.org/
