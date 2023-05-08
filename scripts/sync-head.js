// sync-head.js
const fs = require('fs');
const path = require('path');

const headDirectory = './common/partials/head';
const orderedHeadFilenames = [
  'head-prelude.html',
  'head-title.html',
  'head-info.html',
  'head-styles.html',
  'head-meta.html',
  'head-scripts.html',
  'head-icons.html',
];

const hugoPartialsPath = './website/layouts/partials/';
const antoraPartialsPath = './antora/supplemental-ui/partials/';

orderedHeadFilenames.forEach((filename) => {
  const filePath = path.join(headDirectory, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`File not present, skipping: ${filename}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');

  if (fileContent.trim() === '') {
    console.log(`Skipping empty file: ${filename}`);
    return;
  }

  // Convert shared content to Hugo syntax
  const hugoContent = fileContent;

  // Save the content to Hugo's partial
  const hugoPartialPath = path.join(hugoPartialsPath, filename);
  fs.writeFileSync(hugoPartialPath, hugoContent, 'utf8');

  // Convert shared content to Antora (Handlebars) syntax
  const antoraContent = fileContent.replace(/{{\s*partial\s+"(.+?)"\s*\.\s*}}/g, '{{> $1}}');

  // Save the content to Antora's partial
  const antoraPartialPath = path.join(antoraPartialsPath, filename.replace('.html', '.hbs'));
  fs.writeFileSync(antoraPartialPath, antoraContent, 'utf8');

  console.log(`Synchronized shared content for: ${filename}`);
});

console.log('Synchronization complete.');
