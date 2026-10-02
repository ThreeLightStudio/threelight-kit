export interface RuntimeConfig {
  root: string;
  host: '127.0.0.1';
  webPort: number;
  apiPort: number;
  webOrigin: string;
  apiOrigin: string;
  webDist: string;
  dataDir: string;
  name: string;
  version: string;
}

export function readRuntimeConfig(): RuntimeConfig;
