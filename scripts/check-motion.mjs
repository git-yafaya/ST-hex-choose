import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachDialogMotion } from '../shared/ui/dialog-motion.js';

// 只检查动效状态，不模拟浏览器布局或背景绘制。
const root = new EventTarget();
const classes = new Set();
Object.assign(root, {
  open: false, inert: false, animations: [], attributes: new Map(),
  classList: {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    contains: name => classes.has(name),
  },
  getAnimations() { return this.animations; },
  setAttribute(name, value) { this.attributes.set(name, value); },
  close() { this.open = false; this.dispatchEvent(new Event('close')); },
});
const close = attachDialogMotion(root);
const animation = name => {
  let finish, cancel;
  const finished = new Promise((resolve, reject) => { finish = resolve; cancel = reject; });
  return { animationName: `yakit-panel-${name}`, finished, finish, cancel };
};
const open = (...animations) => {
  root.open = true;
  root.animations = animations;
  root.dispatchEvent(new Event('yakit:open'));
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const opening = () => classes.has('yakit-panel--opening');

// 入场结束后，内容与忙碌状态变化不会重新挂上入场动画。
const first = animation('enter');
open(first);
assert.ok(opening());
first.finish();
await flush();
assert.ok(!opening());
root.setAttribute('aria-busy', 'true');
root.textContent = '测试完成';
assert.ok(!opening());

// 关闭后重新打开，旧入场的取消回调和旧退场的完成回调都不能影响新窗口。
const staleEntry = animation('enter');
open(staleEntry);
const staleExit = animation('exit');
root.animations = [staleExit];
close();
assert.ok(!opening() && root.inert && root.open);
root.close();
const current = animation('enter');
open(current);
staleEntry.cancel();
staleExit.finish();
await flush();
assert.ok(opening() && root.open && !root.inert);
current.finish();
await flush();
assert.ok(!opening());

// 正常关闭等待退场结束；没有动画时立即完成状态清理与关闭。
const exit = animation('exit');
root.animations = [exit];
const cancelEvent = new Event('cancel', { cancelable: true });
root.dispatchEvent(cancelEvent);
assert.ok(cancelEvent.defaultPrevented && root.open && root.inert);
exit.finish();
await flush();
assert.ok(!root.open && !root.inert && classes.size === 0);
open();
assert.ok(root.open && !opening());
close();
assert.ok(!root.open && !root.inert && classes.size === 0);

// 样式只对打开阶段绑定入场，并在减少动态效果时覆盖背景伪元素。
const css = await readFile(new URL('../src/ui/motion.css', import.meta.url), 'utf8');
assert.ok(!/\.panel\[open\][^{]*\{[^}]*yakit-(?:panel|backdrop)-enter/.test(css));
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.panel::backdrop[^}]*animation:\s*none/);
console.log('检查通过：弹窗动效状态、旧回调清理、无动画关闭与背景样式约定；实际交互待人工验收。');
