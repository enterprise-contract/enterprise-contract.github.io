// Used in the nav-menu.hbs partial to specify component order

const objectValues = function (obj) {
  return Object.keys(obj).map((k) => obj[k])
}

const componentOrder = [
  "user-guide",
  "ec-cli",
  "ecc",
  "ec-policies",
]

const componentSorter = function (a, b) {
  const aa = componentOrder.indexOf(a.name)
  const bb = componentOrder.indexOf(b.name)
  return (aa > bb ? 1 : (aa < bb ? -1 : 0))
}

module.exports = (components) => {
  return objectValues(components).sort(componentSorter)
}
