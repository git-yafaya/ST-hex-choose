import assert from 'node:assert/strict';
import { attachLauncherDrag } from '../src/ui/launcher-drag.js';

// 只检查事件和位置状态；真实布局、鼠标与触屏操作仍由人工验收。
const view = Object.assign(new EventTarget(), { innerWidth: 800, innerHeight: 600 });
const launcher = Object.assign(new EventTarget(), {
  ownerDocument: { defaultView: view }, style: {}, offsetWidth: 44, offsetHeight: 44,
  captured: null,
  getBoundingClientRect() {
    return { left: parseFloat(this.style.left ?? 700), top: parseFloat(this.style.top ?? 200) };
  },
  setPointerCapture(id) { this.captured = id; },
  hasPointerCapture(id) { return this.captured === id; },
  releasePointerCapture(id) { if (this.captured === id) this.captured = null; },
});
const emit = (type, data = {}) => {
  const event = Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, isPrimary: true, button: 0, clientX: 710, clientY: 210, ...data,
  });
  launcher.dispatchEvent(event);
  return event;
};
const detach = attachLauncherDrag(launcher);
let clicks = 0;
launcher.addEventListener('click', () => clicks++);

// 小幅晃动仍是点击；右键不会开始拖动。
emit('pointerdown', { button: 2 });
assert.equal(launcher.captured, null);
emit('pointerdown');
assert.equal(launcher.captured, 1);
emit('pointermove', { clientX: 712 });
emit('pointerup');
assert.equal(launcher.style.left, undefined);
assert.equal(launcher.captured, null);
assert.equal(emit('click', { detail: 1 }).defaultPrevented, false);
assert.equal(clicks, 1);

// 鼠标拖动保留抓取偏移，忽略其他指针，松手后的点击不会打开窗口。
emit('pointerdown');
emit('pointermove', { pointerId: 2, clientX: 400 });
assert.equal(launcher.style.left, undefined);
emit('pointermove', { clientX: 610, clientY: 260 });
assert.deepEqual(launcher.style, { left: '600px', top: '250px', right: 'auto' });
emit('pointerup');
assert.equal(emit('click', { detail: 0 }).defaultPrevented, false);
assert.equal(clicks, 2);
assert.equal(emit('click', { detail: 1 }).defaultPrevented, true);
assert.equal(clicks, 2);

// 触屏可拖到边界，取消后停止移动；窗口缩小后按钮仍在可见范围内。
emit('pointerdown', { pointerType: 'touch' });
emit('pointermove', { pointerType: 'touch', clientX: -1000, clientY: 2000 });
assert.equal(launcher.style.left, '0px');
assert.equal(launcher.style.top, '556px');
emit('pointercancel', { pointerType: 'touch' });
assert.equal(launcher.captured, null);
emit('pointermove', { clientX: 400, clientY: 400 });
assert.equal(launcher.style.top, '556px');
view.innerHeight = 300;
view.dispatchEvent(new Event('resize'));
assert.equal(launcher.style.top, '256px');
emit('pointerdown');
emit('pointerup');
assert.equal(emit('click', { detail: 1 }).defaultPrevented, false);

// 解绑中途的拖动会释放捕获，之后的指针与尺寸变化不再改写位置。
emit('pointerdown');
detach();
assert.equal(launcher.captured, null);
const position = { ...launcher.style };
emit('pointermove', { clientX: 400 });
emit('pointerdown');
view.innerHeight = 100;
view.dispatchEvent(new Event('resize'));
assert.deepEqual(launcher.style, position);
assert.equal(launcher.captured, null);
console.log('检查通过：悬浮按钮拖动、点击区分、边界限制与事件解绑；实际交互待人工验收。');
