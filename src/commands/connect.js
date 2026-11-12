// Explicit, local-only onboarding: consent comes before settings changes or scanning.
import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { SETTINGS_FILE, PROJECTS_DIR, BACKUP_DIR, BIN } from '../paths.js';

function confirm(input, output) {
  return new Promise((resolve) => {
    const rl = createInterface({ input, output });
    let settled = false;
    const finish = (answer = '') => {
      if (settled) return;
      settled = true;
      resolve(/^(y|yes)$/i.test(answer.trim()));
      rl.close();
    };
    rl.once('SIGINT', () => finish());
    rl.once('close', () => finish());
    rl.question('Connect ClaudePlus now? [y/N] ', finish);
  });
}

export async function run(args = {}, {
  input = process.stdin,
  output = process.stdout,
  startDashboard = async (options) => (await import('../server.js')).serve(options),
} = {}) {
  const say = (text) => output.write(text + '\n');
  say(`
WARNING!! - Connect ClaudePlus to Claude Code

This will:
  - Read your local Claude Code transcripts for your own usage statistics:
    ${PROJECTS_DIR}
  - Install the Guard hook and ClaudePlus statusline in:
    ${SETTINGS_FILE}
    Existing settings are backed up first. An existing statusline is replaced.
    Guard can stop repeated reads, oversized reads and noisy commands.
  - Open the dashboard on 127.0.0.1 (this computer only).

Transcripts are never changed. No usage data is uploaded.
No account or API key is needed.
Keep this project folder in place after connecting: installed hooks use its absolute path.
Undo the integration with cplus uninstall, or without npm link:
  node "${BIN}" uninstall
`);

  if (args.port !== undefined && (!Number.isInteger(Number(args.port)) || Number(args.port) < 1 || Number(args.port) > 65535)) {
    throw new Error('Port must be an integer from 1 to 65535. Nothing was changed.');
  }

  const approved = args.yes === true || args.yes === 'true';
  if (!approved) {
    if (!input.isTTY) throw new Error('Interactive confirmation is required. Run cplus connect in a terminal, or use --yes for automation. Nothing was changed.');
    if (!await confirm(input, output)) {
      say('\nCancelled. Nothing was changed.');
      return false;
    }
  }

  const hadSettings = fs.existsSync(SETTINGS_FILE);
  const { install } = await import('../installer.js');
  await install({ guard: true, statusline: true, quiet: true });
  say('\nConnected: Guard and the statusline are installed.');
  say(hadSettings ? `Settings backup folder: ${BACKUP_DIR}` : `Created settings: ${SETTINGS_FILE} (no previous settings to back up).`);
  say('Open a new Claude Code session to activate the integration.');
  say('Keep this terminal open for the dashboard. Ctrl+C stops the dashboard; the integration stays installed.\n');
  await startDashboard(args);
  return true;
}
