const fs = require('node:fs');
const path = require('node:path');
const { readJson } = require('./catalog');

function planInitialization(catalog, modules, projectRoot) {
  const manifestPath = path.join(projectRoot, 'package.json');
  const packageJson = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : { name: path.basename(projectRoot), private: true };
  const files = new Set();
  const fields = new Set();
  function collectFiles(directory, relative = '') {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) collectFiles(path.join(directory, entry.name), name);
      else files.add(name.split(path.sep).join('/'));
    }
  }
  for (const name of modules) {
    const directory = catalog.modules.get(name).directory;
    collectFiles(path.join(directory, 'files'));
    const snippetPath = path.join(directory, 'package.json.snippet');
    if (!fs.existsSync(snippetPath)) continue;
    const snippet = readJson(snippetPath);
    for (const section of ['scripts', 'devDependencies', 'dependencies']) {
      if (section === 'dependencies' && !snippet.dependencies) continue;
      packageJson[section] = { ...packageJson[section], ...snippet[section] };
      for (const key of Object.keys(snippet[section] ?? {})) fields.add(`${section}.${key}`);
    }
    if (snippet.packageManager) {
      packageJson.packageManager = snippet.packageManager;
      fields.add('packageManager');
    }
    if (snippet.engines) {
      packageJson.engines = snippet.engines;
      fields.add('engines');
    }
  }
  if (fields.size || !fs.existsSync(manifestPath)) files.add('package.json');
  return { files: [...files].sort(), fields: [...fields].sort(), packageJson };
}

module.exports = { planInitialization };
