/**
 * The electrobun 2.0.1 npm package is a CLI bootstrap. The authoritative SDK
 * lives in the generated .hutch/devkit projection after `desktop:prepare`.
 * These narrow declarations cover only the SDK APIs used by this starter;
 * extend them from that projection when introducing another desktop API.
 */
declare module 'electrobun/main' {
  export class BrowserWindow {
    constructor(options: {
      title: string;
      url: string;
      renderer?: 'native' | 'cef';
      frame: { width: number; height: number; x?: number; y?: number };
    });
  }

  export const ApplicationMenu: {
    setApplicationMenu(
      menu: { label: string; submenu: { role: string; accelerator?: string }[] }[],
    ): void;
  };
}

declare module 'electrobun' {
  export interface ElectrobunConfig {
    app: { name: string; identifier: string; version: string };
    build: {
      mainProcess: 'cottontail';
      cottontail: { entrypoint: string };
      watch: string[];
      watchIgnore: string[];
      mac: { codesign: boolean; notarize: boolean; createDmg: boolean };
      copy: Record<string, string>;
      buildFolder: string;
      artifactFolder: string;
    };
    runtime: { exitOnLastWindowClosed: boolean };
    scripts: { preBuild: string };
  }
}
