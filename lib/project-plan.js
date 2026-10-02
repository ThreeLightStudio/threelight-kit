const fs = require('node:fs');
const path = require('node:path');
const { readJson, readCatalog, resolveModules } = require('./catalog');

function validateProjectName(name) {
  if (
    typeof name !== 'string' ||
    name.length > 214 ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(name) ||
    ['node_modules', 'favicon.ico'].includes(name)
  ) {
    throw new Error(
      'Project name must be a valid unscoped lowercase npm name (use --name to choose one)',
    );
  }
  return name;
}

function assertNoSymlinks(destination) {
  const absolute = path.resolve(destination);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink())
        throw new Error(`Symlink destination or ancestor is not allowed: ${current}`);
      if (!stat.isDirectory())
        throw new Error(`Destination or ancestor is not a directory: ${current}`);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  return absolute;
}

function validateDestination(destination) {
  const absolute = assertNoSymlinks(destination);
  if (!fs.existsSync(absolute)) return absolute;
  const entries = fs.readdirSync(absolute);
  if (entries.length === 0) return absolute;
  if (entries.length === 1 && entries[0] === '.git') {
    const stat = fs.lstatSync(path.join(absolute, '.git'));
    if (!stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile())) return absolute;
  }
  throw new Error(
    `Destination must be missing, empty, or contain only a real .git entry: ${absolute}`,
  );
}

function nodeCompatibility(runtime, version = process.versions.node) {
  const actual = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const minimum = runtime.node.split('.').map(Number);
  const values = actual && actual.slice(1).map(Number);
  const ok = Boolean(
    values &&
    values[0] === minimum[0] &&
    (values[1] > minimum[1] || (values[1] === minimum[1] && values[2] >= minimum[2])),
  );
  return { ok, message: `Node ${runtime.nodeRange} is required; current Node is ${version}` };
}

function renderText(content, tokens, label) {
  return content.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, token) => {
    if (!Object.hasOwn(tokens, token))
      throw new Error(`Unknown template token {{${token}}} in ${label}`);
    return tokens[token];
  });
}

function runtimeCompatibility(runtime, options = {}) {
  const node = nodeCompatibility(runtime, options.nodeVersion);
  if (!node.ok) return node;
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  if (runtime.platform && runtime.platform !== platform) {
    return {
      ok: false,
      message: `This preset requires ${runtime.platform}; current platform is ${platform}`,
    };
  }
  if (runtime.architecture && runtime.architecture !== architecture) {
    return {
      ok: false,
      message: `This preset requires ${runtime.architecture}; current architecture is ${architecture}`,
    };
  }
  return { ok: true, message: 'Runtime requirements satisfied' };
}

function safeRelative(file) {
  const normalized = file.split(path.sep).join('/');
  if (
    path.isAbsolute(file) ||
    normalized.split('/').some((segment) => segment === '..' || segment === '.git') ||
    !normalized
  ) {
    throw new Error(`Invalid generated file path: ${file}`);
  }
  return normalized;
}

function readFiles(directory, tokens) {
  const files = new Map();
  if (!fs.existsSync(directory)) return files;
  function walk(current, relative = '') {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      const name = path.join(relative, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Symlink template files are not supported: ${file}`);
      if (entry.isDirectory()) walk(file, name);
      else if (entry.isFile())
        files.set(safeRelative(name), renderText(fs.readFileSync(file, 'utf8'), tokens, file));
      else throw new Error(`Unsupported template file: ${file}`);
    }
  }
  walk(directory);
  return files;
}

function equal(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]))
    );
  }
  return false;
}

function mergePackage(target, contribution, overrides, isTemplate, label, prefix = '') {
  if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution))
    throw new Error(`Invalid package snippet: ${label}`);
  for (const [key, value] of Object.entries(contribution)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error(`Invalid package field: ${key}`);
    const field = prefix ? `${prefix}.${key}` : key;
    if (!Object.hasOwn(target, key)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = {};
        mergePackage(target[key], value, overrides, isTemplate, label, field);
      } else target[key] = value;
    } else if (
      value &&
      target[key] &&
      typeof value === 'object' &&
      typeof target[key] === 'object' &&
      !Array.isArray(value) &&
      !Array.isArray(target[key])
    ) {
      mergePackage(target[key], value, overrides, isTemplate, label, field);
    } else if (!equal(target[key], value)) {
      if (!isTemplate || !overrides.has(field))
        throw new Error(`Undeclared package overwrite: ${field} from ${label}`);
      target[key] = value;
    }
  }
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item))
    throw new Error(`${label} must be an array of strings`);
  return value;
}

function planCreation(root, presetName, destination, options = {}) {
  const catalog = readCatalog(root);
  const preset = catalog.presets.get(presetName);
  if (!preset?.create) throw new Error(`Preset is not runnable: ${presetName}`);
  const recipe = preset.create;
  if (!['single-package', 'workspace'].includes(recipe.layout))
    throw new Error(`Unsupported creation layout: ${recipe.layout}`);
  if (typeof recipe.runtime !== 'string' || !/^[a-z0-9-]+$/.test(recipe.runtime))
    throw new Error('Invalid runtime metadata name');
  const runtime = readJson(path.join(root, 'runtimes', `${recipe.runtime}.json`));
  if (
    !/^\d+\.\d+\.\d+$/.test(runtime.node) ||
    !/^\d+\.\d+\.\d+$/.test(runtime.pnpm) ||
    typeof runtime.nodeRange !== 'string' ||
    !/^[>=<~^0-9. |]+$/.test(runtime.nodeRange) ||
    typeof runtime.runner !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(runtime.runner)
  ) {
    throw new Error(`Invalid runtime metadata: ${recipe.runtime}`);
  }
  if (runtime.nodeRange !== `>=${runtime.node} <${Number(runtime.node.split('.')[0]) + 1}`) {
    throw new Error(`Runtime nodeRange must match its minimum and major: ${recipe.runtime}`);
  }
  for (const field of ['platform', 'architecture']) {
    if (
      runtime[field] !== undefined &&
      (typeof runtime[field] !== 'string' || !/^[a-z0-9-]+$/.test(runtime[field]))
    ) {
      throw new Error(`Invalid runtime ${field}: ${recipe.runtime}`);
    }
  }
  if (
    runtime.commands !== undefined &&
    (!Array.isArray(runtime.commands) ||
      runtime.commands.some(
        (command) => typeof command !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(command),
      ))
  ) {
    throw new Error(`Invalid runtime prerequisite commands: ${recipe.runtime}`);
  }
  const projectRoot = validateDestination(destination);
  const name = validateProjectName(options.name ?? path.basename(projectRoot));
  const modules = resolveModules(catalog, recipe.modules);
  if (typeof recipe.template !== 'string' || path.isAbsolute(recipe.template))
    throw new Error('Template must be repository-relative');
  const template = path.resolve(root, recipe.template);
  const relativeTemplate = path.relative(root, template);
  if (
    !relativeTemplate ||
    relativeTemplate.startsWith(`..${path.sep}`) ||
    relativeTemplate === '..'
  )
    throw new Error('Template must be inside the kit repository');
  if (!fs.statSync(template).isDirectory())
    throw new Error(`Missing template directory: ${template}`);
  const fileOverrides = new Set(
    stringArray(recipe.overrides?.files ?? [], 'overrides.files').map(safeRelative),
  );
  const packageOverrides = new Set(
    stringArray(recipe.overrides?.package ?? [], 'overrides.package'),
  );
  const tokens = {
    projectName: name,
    nodeVersion: runtime.node,
    nodeRange: runtime.nodeRange,
    pnpmVersion: runtime.pnpm,
    runner: runtime.runner,
    appIdentifier: `com.threelight.${name.replace(/[._]/g, '-')}`,
  };
  const files = new Map();
  const packageJson = {};
  for (const source of [
    ...modules.map((module) => ({
      label: module,
      directory: catalog.modules.get(module).directory,
      isTemplate: false,
    })),
    { label: recipe.template, directory: template, isTemplate: true },
  ]) {
    for (const [file, content] of readFiles(path.join(source.directory, 'files'), tokens)) {
      if (file === 'package.json')
        throw new Error('Contribute package.json through package.json.snippet');
      if (
        files.has(file) &&
        files.get(file) !== content &&
        (!source.isTemplate || !fileOverrides.has(file))
      ) {
        throw new Error(`Undeclared file overwrite: ${file} from ${source.label}`);
      }
      files.set(file, content);
    }
    const snippet = path.join(source.directory, 'package.json.snippet');
    if (fs.existsSync(snippet)) {
      const contribution = JSON.parse(
        renderText(fs.readFileSync(snippet, 'utf8'), tokens, snippet),
      );
      mergePackage(packageJson, contribution, packageOverrides, source.isTemplate, source.label);
    }
  }
  for (const field of stringArray(recipe.removePackage ?? [], 'removePackage')) {
    const separator = field.indexOf('.');
    const section = field.slice(0, separator);
    const key = field.slice(separator + 1);
    if (
      !['scripts', 'dependencies', 'devDependencies'].includes(section) ||
      !key ||
      ['__proto__', 'constructor', 'prototype'].includes(key)
    ) {
      throw new Error(`Invalid package field removal: ${field}`);
    }
    if (!packageJson[section] || !Object.hasOwn(packageJson[section], key)) {
      throw new Error(`Cannot remove missing package field: ${field}`);
    }
    delete packageJson[section][key];
  }
  const manifest = {
    name,
    version: '0.1.0',
    private: true,
    ...packageJson,
    engines: { ...packageJson.engines, node: runtime.nodeRange },
    packageManager: `pnpm@${runtime.pnpm}`,
  };
  Object.assign(manifest, { name, version: '0.1.0', private: true });
  const nodeVersionFile = `${runtime.node}\n`;
  if (files.has('.node-version') && files.get('.node-version') !== nodeVersionFile)
    throw new Error('Runtime conflicts with template .node-version');
  files.set('.node-version', nodeVersionFile);
  files.set('package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  for (const file of files.keys()) {
    const parts = file.split('/');
    for (let index = 1; index < parts.length; index++) {
      if (files.has(parts.slice(0, index).join('/')))
        throw new Error(`Generated file/directory conflict: ${file}`);
    }
  }
  return {
    destination: projectRoot,
    name,
    modules,
    runtime,
    files,
    packageJson: manifest,
    compatibility: runtimeCompatibility(runtime, options),
  };
}

function writeCreation(plan) {
  validateDestination(plan.destination);
  fs.mkdirSync(plan.destination, { recursive: true });
  for (const [file, content] of plan.files) {
    const destination = path.join(plan.destination, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, { flag: 'wx' });
  }
}

module.exports = {
  validateProjectName,
  validateDestination,
  nodeCompatibility,
  runtimeCompatibility,
  renderText,
  planCreation,
  writeCreation,
};
