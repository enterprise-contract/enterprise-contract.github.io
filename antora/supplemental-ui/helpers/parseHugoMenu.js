const fs = require("fs");
const toml = require("toml");

module.exports = () => {
  const filePath = "./hugo.toml";
  const fileContent = fs.readFileSync(filePath, "utf8");
  const config = toml.parse(fileContent);
  const menu = config.menu.main || [];
  const processed = new Set();

  const createMenu = (item) => {
    if (processed.has(item)) {
      return {};
    }
    processed.add(item);
    const children = menu
      .filter((child) => child.parent === item.name)
      .map(createMenu);
    const menuItem = {
      name: item.name,
      url: item.url,
      pageRef: item.pageRef,
      weight: item.weight || 0,
      parent: item.parent,
      graphic: item.graphic,
    };
    if (children.length) {
      menuItem["children"] = children;
    }
    return menuItem;
  };

  const menuData = menu
    .filter((item) => typeof item.parent === "undefined")
    .map((item) => createMenu(item));
  const sortedMenuData = menuData.sort((a, b) => a.weight - b.weight);
  return sortedMenuData;
};
