import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { desktopBuildProfile } from '../apps/desktop/build-profile';
import { appIdentifier, appVersion, projectName } from '@/project';

describe('desktop application identity', () => {
  it('keeps web and desktop metadata consistent with the release manifest', () => {
    const profile = desktopBuildProfile({});

    expect(profile.name).toBe(projectName);
    expect(profile.identifier).toBe(appIdentifier);
    expect(profile.version).toBe(appVersion);
    expect(profile.version).toBe(packageJson.version);
  });

  it('requires an explicit release configuration before a stable build', () => {
    expect(() => desktopBuildProfile({ DESKTOP_ENV: 'stable' })).toThrow(
      'unsigned development builds',
    );
  });
});
