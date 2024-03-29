
# enterprise-contract.github.io

These are the sources for building the https://enterprisecontract.dev website.
The website uses [Hugo](https://gohugo.io/) and
[Antora](https://docs.antora.org/) to build different sections of the website.

Includes:
* [Website content](./website), built with [Hugo](https://gohugo.io/), published at [enterprisecontract.dev][ec]
* [Documentation](./antora), built with [Antora](https://antora.org/), published
  at [enterprisecontract.dev/docs][ec-docs]


## Live reload preview

To run the preview of the website as changes are made to files within this
repository run `make preview`. Note that the `preview` target also invokes
`npm ci` in the `antora` directory which will reinstall and remove linked
packages needed for development, running `npm run dev:setup` should restore the
links and help with debugging. More on this below.

## Development

The website makes use of
[Antora Extensions](https://docs.antora.org/antora/latest/extend/extensions/),
there are several extensions defined as development dependencies in
`antora/package.json` and configured in `antora/antora-playbook.yml`.

To make changes locally to the extensions run `npm run dev:setup` script in the
`antora` directory. The script assumes that the local clones of
[ec-cli](https://github.com/enterprise-contract/ec-cli/) and
[ec-policies](https://github.com/enterprise-contract/ec-policies/) repositories
are present in the directory above this one. The outcome of running the
`dev:setup` script is that local copies of the NPM packages that comprise the
extensions are [linked](https://docs.npmjs.com/cli/v6/commands/npm-link), so
instead of the versions released to npmjs.com, local versions with any local
changes will be used.

Opening the `enterprise-contract.github.io.code-workspace` workspace file within
VSCode will load the Node projects of the same extensions and the `Antora Build`
launch configuration in `.vscode/launch.json` allows running the debugger
against those.


[ec]: https://enterprisecontract.dev
[ec-docs]: https://enterprisecontract.dev/docs
