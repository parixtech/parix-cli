import { spawn } from 'node:child_process';
import process from 'node:process';

export async function openUrlInBrowser(url: string) {
  const command = getOpenCommand(url);
  if (!command) {
    return false;
  }

  try {
    const child = spawn(command.bin, command.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return true;
  }
  catch {
    return false;
  }
}

function getOpenCommand(url: string) {
  if (process.platform === 'darwin') {
    return { bin: 'open', args: [url] };
  }

  if (process.platform === 'win32') {
    return { bin: 'cmd', args: ['/c', 'start', '', url] };
  }

  if (process.platform === 'linux') {
    return { bin: 'xdg-open', args: [url] };
  }

  return null;
}
