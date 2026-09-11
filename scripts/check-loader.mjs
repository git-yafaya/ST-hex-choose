import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const online = JSON.parse(await readFile(new URL('../dist/YaKit-选色-自动更新.json', import.meta.url), 'utf8'));
const original = { fetch: globalThis.fetch, Blob: globalThis.Blob, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
const resultKey = Symbol.for('YaKit-loader-check');
const previousResult = Object.getOwnPropertyDescriptor(globalThis, resultKey);
const created = [], revoked = [], versions = [];
const started = Date.now();
let source, sha, apiStatus = 200, scriptStatus = 200, requests = 0, runs = 0;
const dataUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
// 每次启用都执行真实生成的入口；只替换网络和 Node 不支持的 Blob 模块地址。
const enable = () => import(`${dataUrl(online.content)}#enable-${++runs}`);

try {
  globalThis[resultKey] = versions;
  globalThis.fetch = async (input, options) => {
    requests++;
    const url = new URL(input);
    assert.equal(options.cache, 'no-store');
    if (url.hostname === 'api.github.com') {
      assert.equal(url.origin + url.pathname, 'https://api.github.com/repos/git-yafaya/ST-hex-choose/git/ref/heads/main');
      const timestamp = Number(url.searchParams.get('t'));
      assert.ok(timestamp >= started && timestamp <= Date.now());
      return {
        ok: apiStatus === 200, status: apiStatus,
        json: async () => {
          assert.equal(apiStatus, 200, 'API 失败时不能继续读取响应');
          return { object: { sha } };
        },
      };
    }
    assert.equal(url.href, `https://raw.githubusercontent.com/git-yafaya/ST-hex-choose/${sha}/dist/yakit-hex-choose.js`);
    return {
      ok: scriptStatus === 200, status: scriptStatus,
      text: async () => {
        assert.equal(scriptStatus, 200, '脚本请求失败时不能继续读取并执行响应');
        return source;
      },
    };
  };
  globalThis.Blob = class {
    constructor(parts, options) {
      this.source = parts.join('');
      assert.equal(options.type, 'text/javascript');
    }
  };
  URL.createObjectURL = blob => {
    const url = `${dataUrl(blob.source)}#blob-${created.length}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = url => revoked.push(url);

  for (const version of [1, 2]) {
    sha = String(version).repeat(40);
    source = `globalThis[Symbol.for('YaKit-loader-check')].push(${version});`;
    await enable();
  }
  assert.equal(requests, 4);
  assert.deepEqual(versions, [1, 2], '重新启用必须获取并执行新版本');
  assert.deepEqual(revoked, created);

  apiStatus = 503;
  await assert.rejects(enable(), /503/);
  assert.equal(requests, 5, 'API 失败后不能请求脚本');
  apiStatus = 200;
  scriptStatus = 404;
  await assert.rejects(enable(), /404/);
  assert.equal(requests, 7);
  assert.equal(created.length, 2, 'HTTP 失败时不能创建可执行模块');
  assert.deepEqual(versions, [1, 2]);

  scriptStatus = 200;
  sha = '../main';
  await assert.rejects(enable());
  assert.equal(requests, 8, '非法提交号不能用于请求脚本');
  assert.equal(created.length, 2);

  sha = '3'.repeat(40);
  source = "throw new Error('加载器检查：模块执行失败');";
  await assert.rejects(enable(), /模块执行失败/);
  assert.equal(created.length, 3);
  assert.deepEqual(revoked, created, '模块执行失败也必须释放临时地址');
  assert.equal(requests, 10);
} finally {
  globalThis.fetch = original.fetch;
  globalThis.Blob = original.Blob;
  URL.createObjectURL = original.create;
  URL.revokeObjectURL = original.revoke;
  if (previousResult) Object.defineProperty(globalThis, resultKey, previousResult);
  else delete globalThis[resultKey];
}
console.log('检查通过：自动更新按最新提交执行新版本、请求绕过缓存、HTTP 失败、非法提交号与临时地址释放。');
