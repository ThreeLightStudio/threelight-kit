import { ApplicationMenu, BrowserWindow } from 'electrobun/main';
import { desktopBuildProfile } from '../build-profile';

const profile = desktopBuildProfile();

ApplicationMenu.setApplicationMenu([
  { label: profile.name, submenu: [{ role: 'quit', accelerator: 'CommandOrControl+Q' }] },
  { label: 'Edit', submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
]);

const mainWindow = new BrowserWindow({
  title: profile.name,
  url: 'views://app/index.html',
  renderer: 'native',
  frame: { width: 1100, height: 800, x: 120, y: 80 },
});

void mainWindow;
