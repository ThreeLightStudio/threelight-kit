import type { ElectrobunConfig } from 'electrobun';
import { desktopBuildProfile } from './apps/desktop/build-profile';

export default {
  app: desktopBuildProfile(),
  build: {
    mainProcess: 'cottontail',
    cottontail: { entrypoint: 'apps/desktop/src/main.ts' },
    watch: ['apps/web', 'apps/desktop'],
    watchIgnore: ['.cache/**', '.hutch/**', '.cottontail-tmp/**'],
    mac: { codesign: false, notarize: false, createDmg: false },
    copy: { '.cache/electrobun/web': 'views/app' },
    buildFolder: '.cache/electrobun/build',
    artifactFolder: '.cache/electrobun/artifacts',
  },
  runtime: { exitOnLastWindowClosed: true },
  scripts: { preBuild: 'apps/desktop/scripts/build-web.mjs' },
} satisfies ElectrobunConfig;
