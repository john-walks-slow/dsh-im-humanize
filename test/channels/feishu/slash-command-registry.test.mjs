import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listSlashCommands,
  registerSlashCommands,
  SLASH_COMMAND_MANIFEST,
} from '../../../src/channels/feishu/slash-command-registry.mjs';

function fakeHttpInstance(handlers) {
  const requests = [];
  return {
    requests,
    http: {
      async request(options) {
        requests.push(options);
        const { method, url } = options;
        const key = method + ' ' + url.split('/open-apis/')[1];
        const handler = handlers[key];
        if (typeof handler !== 'function') {
          throw new Error(`no fake handler for ${key}`);
        }
        return handler(options);
      },
    },
  };
}

const AUTH_KEY = 'POST auth/v3/tenant_access_token/internal';
const LIST_KEY = 'GET application/v7/app_slash_commands';

test('SLASH_COMMAND_MANIFEST is non-empty and has no leading slash', () => {
  assert.ok(Array.isArray(SLASH_COMMAND_MANIFEST));
  assert.ok(SLASH_COMMAND_MANIFEST.length > 0);
  for (const entry of SLASH_COMMAND_MANIFEST) {
    assert.equal(typeof entry.command, 'string');
    assert.ok(entry.command.length > 0);
    assert.equal(entry.command.startsWith('/'), false, `command ${entry.command} must not start with /`);
    assert.equal(typeof entry.default, 'string');
  }
});

test('listSlashCommands returns the registered command items', async () => {
  const { http, requests } = fakeHttpInstance({
    [AUTH_KEY]: () => ({ code: 0, tenant_access_token: 'tenant-token' }),
    [LIST_KEY]: () => ({ code: 0, data: { items: [{ command: 'menu', command_id: '1' }] } }),
  });
  const items = await listSlashCommands({ appId: 'a', appSecret: 's', httpInstance: http });
  assert.deepEqual(items, [{ command: 'menu', command_id: '1' }]);
  assert.equal(requests[1].headers.authorization, 'Bearer tenant-token');
});

test('registerSlashCommands creates missing and skips existing commands', async () => {
  const createdBodies = [];
  const existing = new Set(['menu', 'help']);
  const { http } = fakeHttpInstance({
    [AUTH_KEY]: () => ({ code: 0, tenant_access_token: 'tenant-token' }),
    [LIST_KEY]: () => ({ code: 0, data: { items: [{ command: 'menu' }, { command: 'help' }] } }),
    'POST application/v7/app_slash_commands': (options) => {
      createdBodies.push(options.data);
      return { code: 0, data: { command_id: `id-${options.data.command}` } };
    },
  });

  const manifest = [
    { command: 'menu', default: '打开菜单', en_us: 'Open menu' },
    { command: 'status', default: '状态', en_us: 'Status' },
    { command: 'watch', default: '监听', en_us: 'Watch' },
  ];
  const result = await registerSlashCommands({
    appId: 'a', appSecret: 's', httpInstance: http, manifest,
  });

  // menu exists -> skipped; status & watch created
  assert.equal(result.created.length, 2);
  assert.ok(result.created.some((c) => c.command === 'status'));
  assert.ok(result.created.some((c) => c.command === 'watch'));
  assert.ok(result.existing.includes('menu'));
  assert.ok(result.existing.includes('help'));
  assert.equal(result.failed.length, 0);
  assert.equal(createdBodies.length, 2);
  for (const body of createdBodies) {
    assert.equal(body.command.startsWith('/'), false);
    assert.ok(body.description.default_value);
    assert.ok(body.description.i18n.zh_cn);
    assert.ok(body.description.icon.icon_key);
  }
});

test('registerSlashCommands aborts batch on missing permission', async () => {
  const { http } = fakeHttpInstance({
    [AUTH_KEY]: () => ({ code: 0, tenant_access_token: 'tenant-token' }),
    [LIST_KEY]: () => ({ code: 0, data: { items: [] } }),
    'POST application/v7/app_slash_commands': () => ({ code: 99991640, msg: 'lacks permission' }),
  });
  const manifest = [
    { command: 'menu', default: 'x', en_us: 'x' },
    { command: 'status', default: 'x', en_us: 'x' },
  ];
  const result = await registerSlashCommands({
    appId: 'a', appSecret: 's', httpInstance: http, manifest,
  });
  assert.equal(result.created.length, 0);
  assert.equal(result.failed.length, 1);
});

test('registerSlashCommands treats duplicate-create as already-existing', async () => {
  const { http } = fakeHttpInstance({
    [AUTH_KEY]: () => ({ code: 0, tenant_access_token: 'tenant-token' }),
    [LIST_KEY]: () => ({ code: 0, data: { items: [] } }),
    'POST application/v7/app_slash_commands': () => ({ code: 40000000, msg: 'command already exists' }),
  });
  const result = await registerSlashCommands({
    appId: 'a', appSecret: 's', httpInstance: http,
    manifest: [{ command: 'menu', default: 'x', en_us: 'x' }],
  });
  assert.equal(result.created.length, 0);
  assert.equal(result.failed.length, 0);
});
