import type { ElectrobunConfig } from 'electrobun';
import packageJson from './package.json';
import { desktopBuildProfile } from './apps/desktop/build-profile';

const profile = desktopBuildProfile();
const stable = profile.identifier === 'com.example.myapp';
const cacheRoot = stable ? '.cache/electrobun' : '.cache/electrobun/dev';

export default {
  app: { ...profile, version: packageJson.version },
  build: {
    mainProcess: 'cottontail',
    cottontail: { entrypoint: 'apps/desktop/src/main.ts' },
    mac: { codesign: true, notarize: true, createDmg: true },
    copy: { [`${cacheRoot}/web`]: 'views/myapp' },
    buildFolder: `${cacheRoot}/build`,
    artifactFolder: `${cacheRoot}/artifacts`,
  },
  release: {
    baseUrl: stable
      ? 'https://github.com/example/myapp/releases/latest/download'
      : '',
    generatePatch: false,
  },
  runtime: { exitOnLastWindowClosed: true },
  scripts: { preBuild: 'apps/desktop/scripts/build-web.mjs' },
} satisfies ElectrobunConfig;
