const fs = require('node:fs');
const path = require('node:path');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`);
  }
}

function moduleNames(value, label) {
  if (!Array.isArray(value) || value.some((name) => typeof name !== 'string' || !name)) {
    throw new Error(`${label} must be an array of module names`);
  }
  return value;
}

function readCatalog(root) {
  const modules = new Map();
  const presets = new Map();
  const modulesDir = path.join(root, 'modules');
  for (const entry of fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(modulesDir, entry.name);
    const metadata = readJson(path.join(directory, 'module.json'));
    modules.set(entry.name, {
      directory,
      requires: moduleNames(metadata.requires, `${entry.name}.requires`),
    });
  }
  const presetsDir = path.join(root, 'presets');
  if (fs.existsSync(presetsDir)) {
    for (const file of fs
      .readdirSync(presetsDir)
      .filter((file) => file.endsWith('.json'))
      .sort()) {
      const preset = readJson(path.join(presetsDir, file));
      moduleNames(preset.modules, `${file}.modules`);
      presets.set(file.slice(0, -5), preset);
    }
  }
  return { root, modules, presets };
}

function resolveModules(catalog, roots) {
  moduleNames(roots, 'Module selection');
  const visiting = [];
  const visited = new Set();
  const resolved = [];
  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.includes(name))
      throw new Error(`Module dependency cycle: ${[...visiting, name].join(' -> ')}`);
    const module = catalog.modules.get(name);
    if (!module) throw new Error(`Unknown module dependency: ${name}`);
    visiting.push(name);
    for (const dependency of module.requires) visit(dependency);
    visiting.pop();
    visited.add(name);
    resolved.push(name);
  }
  for (const name of roots) visit(name);
  return resolved;
}

function resolveTarget(catalog, target) {
  if (catalog.presets.has(target)) {
    const preset = catalog.presets.get(target);
    if (preset.configuration === false)
      throw new Error(
        `Preset ${target} supports creation only; use kit create ${target} <directory>`,
      );
    return resolveModules(catalog, preset.modules);
  }
  if (catalog.modules.has(target)) return resolveModules(catalog, [target]);
  throw new Error(
    `Unknown module or preset: ${target}\nAvailable presets: ${[...catalog.presets.keys()].join(', ')}\nAvailable modules: ${[...catalog.modules.keys()].join(', ')}`,
  );
}

module.exports = { readJson, readCatalog, resolveModules, resolveTarget };
