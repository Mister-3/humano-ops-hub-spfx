const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const releaseAssetsDirectory = path.join(projectRoot, 'release', 'assets');
const outputDirectory = path.join(projectRoot, 'vercel-dist');
const componentId = 'b1c501d9-6c98-4884-aa79-cf6920738444';
const manifestPath = path.join(distDirectory, `${componentId}.manifest.json`);
const writeManifestsPath = path.join(projectRoot, 'config', 'write-manifests.json');

if (!fs.existsSync(manifestPath)) {
  throw new Error(`No se encontró el manifiesto compilado: ${manifestPath}`);
}

// El Hosted Workbench ya contiene los manifiestos de la plataforma SPFx. Publicamos
// únicamente el manifiesto del Web Part y sustituimos cualquier URL intermedia de
// desarrollo por el CDN HTTPS absoluto configurado para Vercel.
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const writeManifestsConfig = JSON.parse(fs.readFileSync(writeManifestsPath, 'utf8'));
const cdnBasePath = writeManifestsConfig.cdnBasePath;

if (typeof cdnBasePath !== 'string' || !cdnBasePath.startsWith('https://') || !cdnBasePath.endsWith('/')) {
  throw new Error('cdnBasePath debe ser una URL HTTPS absoluta terminada en barra.');
}

manifest.loaderConfig.internalModuleBaseUrls = [cdnBasePath];

const referencedAssets = new Set();

const normalizeAssetPath = (assetPath) => {
  if (typeof assetPath !== 'string' || assetPath.trim().length === 0) {
    throw new Error('Se encontró una ruta de script vacía o inválida en el manifiesto.');
  }

  const trimmedPath = assetPath.trim();
  const pathname = /^https?:\/\//i.test(trimmedPath)
    ? new URL(trimmedPath).pathname
    : trimmedPath.split(/[?#]/, 1)[0];
  const fileName = path.posix.basename(pathname.replace(/\\/g, '/'));

  if (!fileName.toLowerCase().endsWith('.js')) {
    throw new Error(`El recurso de script no apunta a un archivo .js válido: ${assetPath}`);
  }

  referencedAssets.add(fileName);
  return fileName;
};

const normalizePathValue = (pathValue) => {
  if (typeof pathValue === 'string') {
    return normalizeAssetPath(pathValue);
  }

  if (pathValue && typeof pathValue === 'object' && typeof pathValue.path === 'string') {
    return { ...pathValue, path: normalizeAssetPath(pathValue.path) };
  }

  throw new Error('Se encontró un recurso path/localizedPath con formato inválido.');
};

for (const resource of Object.values(manifest.loaderConfig.scriptResources)) {
  if (resource.type === 'path') {
    resource.path = normalizePathValue(resource.path);
  } else if (resource.type === 'localizedPath') {
    resource.defaultPath = normalizePathValue(resource.defaultPath);

    if (resource.paths) {
      for (const locale of Object.keys(resource.paths)) {
        resource.paths[locale] = normalizePathValue(resource.paths[locale]);
      }
    }
  }
}

const entryResource = manifest.loaderConfig.scriptResources[manifest.loaderConfig.entryModuleId];
const entryFileName = typeof entryResource?.path === 'string' ? entryResource.path : entryResource?.path?.path;

if (!entryResource || entryResource.type !== 'path' || !entryFileName) {
  throw new Error('El manifiesto no contiene un bundle de entrada válido.');
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const assetFileName of referencedAssets) {
  const assetSourcePath = path.join(releaseAssetsDirectory, assetFileName);

  if (!fs.existsSync(assetSourcePath)) {
    throw new Error(`No se encontró el asset referenciado por el manifiesto: ${assetSourcePath}`);
  }

  fs.copyFileSync(assetSourcePath, path.join(outputDirectory, assetFileName));

  const licenseSourcePath = `${assetSourcePath}.LICENSE.txt`;
  if (fs.existsSync(licenseSourcePath)) {
    fs.copyFileSync(licenseSourcePath, path.join(outputDirectory, `${assetFileName}.LICENSE.txt`));
  }
}

const serializedManifest = JSON.stringify(manifest);

if (/https?:\/\/localhost(?::\d+)?|(?:^|["'])\.\.?\//i.test(serializedManifest)) {
  throw new Error('El manifiesto saneado todavía contiene localhost o rutas relativas no resueltas.');
}

const manifestsScript = `(function () {
  'use strict';

  var sourceManifest = ${serializedManifest};

  var debugManifests = {
    _metadata: undefined,
    getManifests: function () {
      return [JSON.parse(JSON.stringify(sourceManifest))];
    }
  };

  self.debugManifests = debugManifests;
  define([], function () { return debugManifests; });
}());
`;

fs.writeFileSync(path.join(outputDirectory, 'manifests.js'), manifestsScript, 'utf8');
fs.writeFileSync(
  path.join(outputDirectory, `${componentId}.manifest.json`),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(outputDirectory, 'index.html'),
  `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><title>Humano Ops Hub SPFx Assets</title></head>
  <body><p>Humano Ops Hub SPFx assets disponibles.</p></body>
</html>\n`,
  'utf8'
);

console.log(`Assets de Vercel preparados en ${outputDirectory}`);
console.log(`Manifiesto: manifests.js`);
console.log(`Bundle: ${entryFileName}`);
console.log('loaderConfig publicado:');
console.log(JSON.stringify(manifest.loaderConfig, null, 2));
