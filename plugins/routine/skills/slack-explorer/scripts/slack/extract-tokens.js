#!/usr/bin/env node
/**
 * Extract Slack xoxc + xoxd tokens from the macOS Slack desktop app
 * and print them to stdout.
 *
 * How it works:
 *   1. Reads the Slack Safe Storage encryption key from macOS Keychain
 *   2. Decrypts the `d` cookie (xoxd) from ~/Library/Application Support/Slack/Cookies (SQLite)
 *   3. Fetches the workspace homepage with the d cookie to get a fresh xoxc token
 *
 * Usage:
 *   node extract-tokens.js [workspace-domain]
 *
 * Options:
 *   workspace  Workspace domain (default: first signed-in workspace)
 *
 * On success, prints the token values to stdout. Export them as environment variables.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import crypto from 'crypto';

const SLACK_DIR = join(homedir(), 'Library', 'Application Support', 'Slack');
const COOKIES_DB = join(SLACK_DIR, 'Cookies');
const ROOT_STATE = join(SLACK_DIR, 'storage', 'root-state.json');

/**
 * Get the Slack Safe Storage encryption key from macOS Keychain.
 */
function getKeychainKey() {
  try {
    const key = execSync(
      'security find-generic-password -s "Slack Safe Storage" -w',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return key;
  } catch {
    throw new Error(
      'Could not read Slack Safe Storage key from Keychain. ' +
      'Is Slack installed and have you signed in at least once?'
    );
  }
}

/**
 * Derive the AES-128-CBC key from the Keychain key using Chromium's PBKDF2 params.
 */
function deriveAesKey(keychainKey) {
  return crypto.pbkdf2Sync(keychainKey, 'saltysalt', 1003, 16, 'sha1');
}

/**
 * Decrypt a Chromium v10 encrypted value.
 * Format: 'v10' (3 bytes) + AES-128-CBC ciphertext (space-filled IV on macOS).
 */
function decryptV10(encryptedBuffer, aesKey) {
  if (encryptedBuffer.length < 4) {
    throw new Error('Encrypted value too short');
  }

  const prefix = encryptedBuffer.subarray(0, 3).toString('ascii');
  if (prefix !== 'v10') {
    throw new Error(`Unknown encryption version: ${prefix}`);
  }

  const iv = Buffer.alloc(16, 0x20); // space-filled IV
  const ciphertext = encryptedBuffer.subarray(3);

  const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  // The first CBC block (16 bytes) may contain garbage due to IV mismatch,
  // then the remaining blocks have some padding. Find the xoxd token start.
  const xoxdIdx = decrypted.indexOf('xoxd');
  if (xoxdIdx < 0) {
    throw new Error('Could not find xoxd token in decrypted cookie');
  }

  // Extract only printable ASCII characters from the token onwards
  const bytes = decrypted.subarray(xoxdIdx);
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 0x20 && b < 0x7f) {
      token += String.fromCharCode(b);
    }
  }

  return token;
}

/**
 * Read the encrypted `d` cookie from the Slack Cookies SQLite database.
 * Uses the sqlite3 CLI to avoid native module dependencies.
 */
function readEncryptedCookie() {
  if (!existsSync(COOKIES_DB)) {
    throw new Error(`Slack Cookies DB not found at ${COOKIES_DB}`);
  }

  // sqlite3 hex() output gives us the encrypted bytes as hex string
  const hex = execSync(
    `sqlite3 "${COOKIES_DB}" "SELECT hex(encrypted_value) FROM cookies WHERE name='d' AND host_key='.slack.com' LIMIT 1;"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();

  if (!hex) {
    throw new Error('No d cookie found in Slack Cookies DB. Are you signed in?');
  }

  return Buffer.from(hex, 'hex');
}

/**
 * Extract the xoxd token (d cookie) from the Slack desktop app.
 * Returns the URL-encoded cookie value ready to use in Cookie headers.
 */
export function extractXoxd() {
  const keychainKey = getKeychainKey();
  const aesKey = deriveAesKey(keychainKey);
  const encryptedCookie = readEncryptedCookie();
  return decryptV10(encryptedCookie, aesKey);
}

/**
 * Get workspace URLs from Slack's persisted state.
 * Returns an array of { id, name, domain, url }.
 */
function getWorkspaces() {
  if (!existsSync(ROOT_STATE)) {
    return [];
  }

  try {
    const data = JSON.parse(readFileSync(ROOT_STATE, 'utf-8'));
    const workspaces = data.workspaces || {};
    return Object.values(workspaces)
      .filter(ws => ws.url && ws.domain)
      .map(ws => ({
        id: ws.id,
        name: ws.name,
        domain: ws.domain,
        url: ws.url,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch a fresh xoxc token for a workspace by loading its homepage.
 * The workspace serves boot_data containing api_token in the HTML.
 *
 * @param {string} workspaceUrl - Full workspace URL (e.g. https://myorg.slack.com/)
 * @param {string} xoxd - The decrypted d cookie value
 * @returns {string} The xoxc token
 */
async function fetchXoxc(workspaceUrl, xoxd) {
  // Ensure trailing slash
  const url = workspaceUrl.endsWith('/') ? workspaceUrl : workspaceUrl + '/';

  // Use a browser UA here — the Slack desktop UA returns an SSB stub without boot_data.
  const resp = await fetch(url, {
    headers: {
      'Cookie': `d=${xoxd}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch workspace ${url}: HTTP ${resp.status}`);
  }

  const html = await resp.text();

  // Extract api_token from boot_data in the HTML
  const match = html.match(/"api_token"\s*:\s*"(xoxc-[^"]+)"/);
  if (!match) {
    throw new Error(
      `Could not find xoxc token in workspace HTML for ${url}. ` +
      'The d cookie may be expired — try restarting Slack.'
    );
  }

  return match[1];
}

/**
 * Extract Slack tokens for one or all workspaces.
 *
 * @param {string} [workspace] - Workspace domain (e.g. 'myorg.slack.com')
 *                                or full URL. If omitted, extracts for all signed-in workspaces.
 * @returns {Promise<Object|Object[]>} Token object(s) with { xoxc, xoxd, workspace }
 *
 * @example
 *   // Single workspace
 *   const { xoxc, xoxd } = await extractTokens('myorg.slack.com');
 *
 *   // All workspaces
 *   const tokens = await extractTokens();
 *   // [{ xoxc, xoxd, workspace: { id, name, domain, url } }, ...]
 */
export async function extractTokens(workspace) {
  const xoxd = extractXoxd();

  if (workspace) {
    // Single workspace
    const url = workspace.startsWith('https://') ? workspace : `https://${workspace}`;
    const xoxc = await fetchXoxc(url, xoxd);
    return { xoxc, xoxd, workspace: { url } };
  }

  // All workspaces
  const workspaces = getWorkspaces();
  if (workspaces.length === 0) {
    throw new Error('No workspaces found in Slack state. Pass a workspace domain explicitly.');
  }

  const results = [];
  for (const ws of workspaces) {
    try {
      const xoxc = await fetchXoxc(ws.url, xoxd);
      results.push({ xoxc, xoxd, workspace: ws });
    } catch (err) {
      results.push({ xoxc: null, xoxd, workspace: ws, error: err.message });
    }
  }

  return results;
}

/**
 * Build a User-Agent string matching the Slack desktop app.
 * Slack appends Sonic + Slack_SSB/{version} to Electron's default UA,
 * and patches in the real macOS version + AppleSilicon on arm64.
 */
function getSlackUserAgent() {
  const run = (cmd) => execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const framework = '/Applications/Slack.app/Contents/Frameworks/Electron Framework.framework/Electron Framework';

  const slackVersion = run('defaults read /Applications/Slack.app/Contents/Info.plist CFBundleShortVersionString');
  const chromeVersion = run(`strings "${framework}" | grep -oE 'Chrome/[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' | head -1`).replace('Chrome/', '');
  const electronVersion = run(`strings "${framework}" | grep -oE 'Electron/[0-9]+\\.[0-9]+\\.[0-9]+' | head -1`).replace('Electron/', '');
  const macVersion = run('sw_vers -productVersion').replace(/\./g, '_');
  const arch = process.arch === 'arm64' ? ' AppleSilicon' : '';

  return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Slack/${slackVersion} Chrome/${chromeVersion} Electron/${electronVersion} Safari/537.36${arch} Sonic Slack_SSB/${slackVersion}`;
}

// CLI usage: node extract-tokens.js [workspace-domain]
const isMain = process.argv[1]?.endsWith('extract-tokens.js');
if (isMain) {
  const workspace = process.argv[2];

  try {
    const { xoxc, xoxd } = await extractTokens(workspace);
    const userAgent = getSlackUserAgent();

    console.log(`Slack tokens extracted for ${workspace}`);
    console.log('');
    console.log(`SLACK_XOXC_TOKEN="${xoxc}"`);
    console.log(`SLACK_XOXD_TOKEN="${xoxd}"`);
    console.log(`SLACK_USER_AGENT="${userAgent}"`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
