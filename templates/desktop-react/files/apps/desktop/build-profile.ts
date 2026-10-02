import packageJson from '../../package.json';

export function desktopBuildProfile(env: NodeJS.ProcessEnv = process.env) {
  if (env.DESKTOP_ENV && env.DESKTOP_ENV !== 'dev') {
    throw new Error(
      'This starter supports unsigned development builds. Configure release signing separately.',
    );
  }

  return { name: packageJson.name, identifier: '{{appIdentifier}}', version: packageJson.version };
}
