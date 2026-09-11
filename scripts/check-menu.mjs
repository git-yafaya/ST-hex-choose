import assert from 'node:assert/strict';
import { attachExtensionEntry } from '../src/ui/extension-entry.js';

// 只检查菜单事件与清理，酒馆中的显示和焦点由人工验收。
const menu = { children: [], append(entry) { this.children.push(entry); } };
const toggle = {};
const nodes = { extensionsMenu: menu, extensionsMenuButton: toggle };
const doc = {
  getElementById: id => nodes[id],
  createElement: () => Object.assign(new EventTarget(), {
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    querySelector: () => ({ setAttribute() {} }),
    click() { this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); },
    remove() { menu.children.splice(menu.children.indexOf(this), 1); },
  }),
};
const opened = [];
const detach = attachExtensionEntry(doc, '<svg></svg>', focus => opened.push(focus));
assert.equal(menu.children.length, 1);
const [entry] = menu.children;
assert.equal(entry.attributes.get('role'), 'button');
assert.equal(entry.tabIndex, 0);

// 点击保留事件传播，打开后把宿主菜单开关作为焦点归位目标。
let clicks = 0;
entry.addEventListener('click', event => {
  clicks++;
  assert.equal(event.cancelBubble, false);
  assert.equal(event.defaultPrevented, false);
});
entry.click();
const press = key => {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key });
  entry.dispatchEvent(event);
  return event.defaultPrevented;
};
assert.equal(press('Enter'), true);
assert.equal(press(' '), true);
assert.equal(press('Tab'), false);
assert.deepEqual(opened, [toggle, toggle, toggle]);
assert.equal(clicks, 3);

// 停用后入口和激活事件都移除，重新启用时只出现一个菜单项。
detach();
assert.equal(menu.children.length, 0);
entry.click();
press('Enter');
assert.equal(opened.length, 3);
const detachAgain = attachExtensionEntry(doc, '<svg></svg>', () => {});
assert.equal(menu.children.length, 1);
detachAgain();
for (const missing of ['extensionsMenu', 'extensionsMenuButton']) {
  assert.throws(() => attachExtensionEntry({ ...doc, getElementById: id => id === missing ? null : nodes[id] }, '<svg></svg>', () => {}), /底部扩展菜单/);
  assert.equal(menu.children.length, 0);
}
console.log('检查通过：扩展菜单入口、点击与键盘激活、缺失菜单和事件清理；实际交互待人工验收。');
