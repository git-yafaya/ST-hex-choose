import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const key = Symbol.for('YaKit-app-check');
const originalHooks = Object.getOwnPropertyDescriptor(globalThis, key);
const doc = Object.assign(new EventTarget(), {
  documentElement: {}, body: {}, head: {}, querySelectorAll: () => [], querySelector: () => null,
});
let callbacks, resolveSample, rejectSample, visible, scene = 0, clears = 0, copies = 0, busy = false, error;
const panel = {
  clearResult() { clears++; visible = null; },
  showResult(result) { visible = result; },
  showError(message) { this.clearResult(); error = message; },
  setBusy(value) { busy = value; },
  setStatus() {}, selectOutput() {}, destroy() {},
};
const host = Object.assign(new EventTarget(), {
  document: doc, Event, clearTimeout,
  MutationObserver: class { observe() {} disconnect() {} },
  Function: () => () => { copies++; return true; },
});
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
// 只替换宿主、面板和异步采样；真实入口与颜色计算照常运行。
const hooks = dataUrl(`export const { createPanel, sampleBackground, backgroundState } = globalThis[Symbol.for('YaKit-app-check')];`);
const source = (await readFile(new URL('../src/app.js', import.meta.url), 'utf8'))
  .replace("'./color.js'", JSON.stringify(new URL('../src/color.js', import.meta.url).href))
  .replace("'./background.js'", JSON.stringify(hooks))
  .replace("'./ui/panel.js'", JSON.stringify(hooks));
const background = { min: 0, max: 0, preview: '#000', summary: '检查背景' };
const succeed = async () => {
  const pending = callbacks.onTest(callbacks.defaults);
  resolveSample(background);
  await pending;
  assert.ok(visible?.text, '成功结果应包含可复制的配置');
};
const assertNoCopy = async () => {
  const previous = copies;
  await callbacks.onCopy();
  assert.equal(copies, previous, '失效或失败后不能继续复制旧结果');
};

try {
  globalThis.window = Object.assign(new EventTarget(), { parent: host });
  globalThis[key] = {
    createPanel: (_doc, options) => { callbacks = options; return panel; },
    sampleBackground: () => new Promise((resolve, reject) => { resolveSample = resolve; rejectSample = reject; }),
    backgroundState: () => scene,
  };
  const { start } = await import(dataUrl(source));
  start({});
  await succeed();
  const first = visible, previousClears = clears;

  // 重测挂起时保留完整旧结果，采样成功后才替换。
  const retest = callbacks.onTest(callbacks.defaults);
  assert.ok(busy);
  assert.equal(clears, previousClears, '重测等待期间不能清空预览');
  assert.equal(visible, first);
  await callbacks.onCopy();
  assert.equal(copies, 1);
  resolveSample({ ...background, summary: '新背景' });
  await retest;
  assert.notEqual(visible, first);
  assert.equal(visible.summary, '新背景');
  assert.equal(busy, false);

  // 输入变化立即作废结果；背景变化也会阻止旧采样重新写回。
  callbacks.onChange();
  assert.equal(visible, null);
  await assertNoCopy();
  await succeed();
  const stale = callbacks.onTest(callbacks.defaults);
  scene++;
  host.dispatchEvent(new Event('resize'));
  assert.equal(visible, null);
  await assertNoCopy();
  resolveSample(background);
  await stale;
  assert.equal(visible, null);
  assert.match(error, /背景发生变化/);

  // 采样失败和输入校验失败都必须清除旧结果及复制入口。
  await succeed();
  const failed = callbacks.onTest(callbacks.defaults);
  rejectSample(new Error('采样失败'));
  await failed;
  assert.equal(visible, null);
  assert.equal(error, '采样失败');
  assert.equal(busy, false);
  await assertNoCopy();
  await succeed();
  await callbacks.onTest({ ...callbacks.defaults, threshold: 0 });
  assert.equal(visible, null);
  await assertNoCopy();
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
  if (originalHooks) Object.defineProperty(globalThis, key, originalHooks);
  else delete globalThis[key];
}
console.log('检查通过：重测保留预览、成功替换、输入与背景失效、失败后禁用旧结果复制；实际交互待人工验收。');
