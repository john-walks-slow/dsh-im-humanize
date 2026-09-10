/** Run the built plugin through an original DSH CLI with an isolated, empty home. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const harnessRoot = process.argv[2];
if (!harnessRoot || process.argv.includes('--help')) {
  console.log('Usage: node scripts/verify-lan-management.mjs /path/to/built/deepseek-harness');
  process.exit(harnessRoot ? 0 : 1);
}
const pluginRoot = resolve(import.meta.dirname, '..');
const cli = resolve(harnessRoot, 'apps/cli/lib/bin.js');
await access(cli);
await access(join(pluginRoot, 'lib/index.js'));
// DSH 0.1.5 CLI intentionally permits only loopback listening. Exercise its
// real HTTP carrier with a trusted LAN authority, while keeping TCP local.
const lanIp = '192.168.1.100';

const directory = await mkdtemp(join(tmpdir(), 'dsh-im-lan-test-'));
const home = join(directory, 'home');
const profile = join(home, 'profiles/web');
const results = [];
let child;

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolveRequest, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1', port: url.port, path: `${url.pathname}${url.search}`,
      method, headers: { host: url.host, ...headers },
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('error', reject);
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers, body: text }));
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('HTTP request timed out')));
    req.end(body);
  });
}

function start() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => (
    !/^DSH_/i.test(key) && !/(?:KEY|SECRET|TOKEN|PASSWORD|PROXY)/i.test(key)
  )));
  child = spawn(process.execPath, [cli, 'web', '--no-open', '--host', '127.0.0.1',
    '--port', '0', '--trusted-host', lanIp], {
    cwd: directory,
    env: { ...env, DSH_HOME: home, DSH_AGENTS_HOME: join(directory, '.agents'),
      DSH_TELEMETRY_DISABLED: '1', SSH_CONNECTION: '', SSH_TTY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolveStart, reject) => {
    let output = '';
    const timer = setTimeout(() => finish(new Error('DSH startup timed out')), 45_000);
    let settled = false;
    function finish(error, url) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        const safeOutput = output.replace(/([?&]token=)[^\s)]+/g, '$1<redacted>');
        reject(new Error(`${error.message}\n${safeOutput}`));
      } else resolveStart(new URL(url));
    }
    function append(chunk) {
      output = `${output}${chunk}`.slice(-100_000);
      const match = /dsh web: (http:\/\/[^\s]+)/.exec(output);
      if (match) finish(null, match[1]);
    }
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', error => finish(error));
    child.once('exit', code => finish(new Error(`DSH exited before readiness: ${code}`)));
  });
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise(resolveStop => child.once('exit', resolveStop));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  try { await stopped; } finally { clearTimeout(timer); }
}

async function login(launchUrl, hostname) {
  const url = new URL(launchUrl);
  url.hostname = hostname;
  const response = await request(url);
  assert.equal(response.status, 303, 'Harness must exchange its launch token for a browser cookie');
  const cookie = response.headers['set-cookie']?.map(value => value.split(';', 1)[0]).join('; ');
  assert.ok(cookie, 'Harness did not issue a browser cookie');
  return { origin: url.origin, cookie };
}

function rpc(browser, channel = 'feishu', method = 'connection.status', headers = {}, payload = {}) {
  return request(new URL(`/api/dsh-im/${channel}`, browser.origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: browser.origin,
      ...(browser.cookie ? { cookie: browser.cookie } : {}), ...headers },
    body: JSON.stringify({ type: 'client-request', rpcId: 'lan-test',
      method: `dsh-im/${channel}`, payload: { method, payload } }),
  });
}

function expectStatus(name, response, expected, businessOk = false) {
  assert.equal(response.status, expected, `${name}: ${response.body.slice(0, 300)}`);
  if (businessOk) {
    const envelope = JSON.parse(response.body);
    assert.equal(envelope.type, 'server-response', name);
    assert.equal(envelope.rpcId, 'lan-test', name);
    assert.equal(envelope.result.ok, true, `${name}: ${response.body.slice(0, 300)}`);
  }
  results.push({ check: name, status: response.status, result: 'PASS' });
}

try {
  await mkdir(profile, { recursive: true });
  const packages = {
    '@deepseek-ai/dsh-base': resolve(harnessRoot, 'packages/bundle/base'),
    '@deepseek-ai/dsh-web-app': resolve(harnessRoot, 'packages/bundle/web-app'),
    '@xmanrui/dsh-im': pluginRoot,
  };
  for (const [name, path] of Object.entries(packages)) {
    const target = join(profile, 'node_modules', name);
    await mkdir(dirname(target), { recursive: true });
    await symlink(path, target, 'dir');
  }
  await writeFile(join(profile, 'cordis.yml'), '[]\n');
  await writeFile(join(profile, 'package.json'), JSON.stringify({
    name: 'dsh-im-lan-test', private: true,
    dependencies: Object.fromEntries(Object.entries(packages).map(([name, path]) => [name, `link:${path}`])),
    dsh: { profile: { bundles: Object.keys(packages) } },
  }));

  const launchUrl = await start();
  const lanUrl = new URL(launchUrl);
  lanUrl.hostname = lanIp;
  const anonymous = { origin: lanUrl.origin };
  expectStatus('LAN without login', await rpc(anonymous), 401);
  const lan = await login(launchUrl, lanIp);
  expectStatus('LAN authenticated web page', await request(new URL('/', lan.origin), {
    headers: { cookie: lan.cookie },
  }), 200);
  for (const channel of ['feishu', 'weixin', 'dingtalk', 'wecom', 'wecom-app', 'qq',
    'slack', 'telegram', 'discord', 'whatsapp', 'imessage', 'office']) {
    expectStatus(`LAN default: ${channel}`, await rpc(lan, channel), 200, true);
  }
  const delivery = await rpc(lan, 'dsh-im-delivery', 'target.list', {}, { botId: 'bot_missing' });
  expectStatus('LAN delivery reaches business handler', delivery, 200);
  assert.equal(JSON.parse(delivery.body).result.error.code, 'unknown-bot');
  expectStatus('LAN forged cookie', await rpc({ ...lan, cookie: 'invalid=invalid' }), 401);
  expectStatus('Untrusted Host', await rpc(lan, 'feishu', 'connection.status', { host: 'untrusted.invalid' }), 403);
  expectStatus('Cross-origin request', await rpc(lan, 'feishu', 'connection.status', { origin: 'https://untrusted.invalid' }), 403);
  expectStatus('LAN update remains local-only', await rpc(lan, 'dsh-im', 'update.status'), 403);
  expectStatus('LAN TTL remains local-only', await rpc(lan, 'dsh-im-settings', 'settings.inbound-ttl.get'), 403);
  const local = await login(launchUrl, '127.0.0.1');
  expectStatus('Loopback default: feishu', await rpc(local), 200, true);

  await stop();
  await writeFile(join(profile, 'cordis.patch.yml'), '- id: xmanrui-dsh-im\n  config:\n    rpcAuthority: loopback\n');
  const restrictedUrl = await start();
  expectStatus('Explicit loopback rejects LAN', await rpc(await login(restrictedUrl, lanIp)), 403);
  expectStatus('Explicit loopback accepts localhost', await rpc(await login(restrictedUrl, '127.0.0.1')), 200, true);
  console.table(results);
  console.log(`Passed ${results.length} real HTTP checks using LAN Host/Origin ${lanIp}.`);
  console.log('TCP connections stayed on loopback. This checks the original CLI, authentication and built plugin, not a second-device browser.');
  console.log('The temporary profile contains no bot credentials and is removed after the server stops.');
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
