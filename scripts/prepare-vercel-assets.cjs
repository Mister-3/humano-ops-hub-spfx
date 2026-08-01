const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const releaseAssetsDirectory = path.join(projectRoot, 'release', 'assets');
const outputDirectory = path.join(projectRoot, 'vercel-dist');
const componentId = 'b1c501d9-6c98-4884-aa79-cf6920738444';
const manifestPath = path.join(distDirectory, `${componentId}.manifest.json`);

if (!fs.existsSync(manifestPath)) {
  throw new Error(`No se encontró el manifiesto compilado: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entryResource = manifest.loaderConfig?.scriptResources?.[manifest.loaderConfig.entryModuleId];

if (!entryResource || entryResource.type !== 'path' || !entryResource.path) {
  throw new Error('El manifiesto no contiene un bundle de entrada válido.');
}

const entryFileName = entryResource.path;
const entrySourcePath = path.join(releaseAssetsDirectory, entryFileName);

if (!fs.existsSync(entrySourcePath)) {
  throw new Error(`No se encontró el bundle compilado: ${entrySourcePath}`);
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(entrySourcePath, path.join(outputDirectory, entryFileName));

const licenseSourcePath = `${entrySourcePath}.LICENSE.txt`;
if (fs.existsSync(licenseSourcePath)) {
  fs.copyFileSync(licenseSourcePath, path.join(outputDirectory, `${entryFileName}.LICENSE.txt`));
}

// El Hosted Workbench ya contiene los manifiestos de la plataforma SPFx. Publicamos
// únicamente el manifiesto del Web Part y resolvemos su bundle desde la misma URL
// HTTPS que sirve manifests.js, sin depender de localhost ni de un dominio fijo.
manifest.loaderConfig.internalModuleBaseUrls = [];

const serializedManifest = JSON.stringify(manifest);
const manifestsScript = `(function () {
  'use strict';

  var currentScript = document.currentScript;
  var scriptUrl = currentScript && currentScript.src ? currentScript.src.split('?')[0] : '';
  var baseUrl = scriptUrl ? scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1) : window.location.origin + '/';
  var sourceManifest = ${serializedManifest};

  var debugManifests = {
    _metadata: undefined,
    getManifests: function () {
      var runtimeManifest = JSON.parse(JSON.stringify(sourceManifest));
      runtimeManifest.loaderConfig.internalModuleBaseUrls = [baseUrl];
      return [runtimeManifest];
    }
  };

  self.debugManifests = debugManifests;
  define([], function () { return debugManifests; });
}());
`;

fs.writeFileSync(path.join(outputDirectory, 'manifests.js'), manifestsScript, 'utf8');
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
