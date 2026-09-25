export function desktopBuildProfile(env: NodeJS.ProcessEnv = process.env) {
  const channel = env.DESKTOP_ENV ?? 'dev';
  if (channel !== 'dev' && channel !== 'stable')
    throw new Error('DESKTOP_ENV must be dev or stable');
  return channel === 'stable'
    ? { name: 'MyApp', identifier: 'com.example.myapp' }
    : { name: 'MyApp Dev', identifier: 'com.example.myapp.dev' };
}

export function desktopRuntimeEnvironment(info: { channel: string; identifier: string }) {
  return info.channel === 'stable' && info.identifier === 'com.example.myapp'
    ? ('production' as const)
    : ('development' as const);
}
