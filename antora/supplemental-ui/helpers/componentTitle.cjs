// I know we could just change the titles in each source's antora.yaml
// file, and maybe I'll do that later, but I want to be able to tweak
// the nav menu easily in this repo while experimenting

const customTitles = {
  "user-guide": "About",
  "ec-cli": "CLI Reference",
  "ecc": "Configuration Reference",
  "ec-policies": "Policies",
}

module.exports = (component) => {
  return customTitles[component.name] || component.title
}
