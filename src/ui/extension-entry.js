/** 使用酒馆底部扩展菜单的样式和点击收起行为。 */
export function attachExtensionEntry(doc, paletteSvg, onOpen) {
  const menu = doc.getElementById('extensionsMenu');
  const toggle = doc.getElementById('extensionsMenuButton');
  if (!menu || !toggle) throw new Error('未找到酒馆底部扩展菜单，无法添加 YaKit-选色入口。');

  const entry = doc.createElement('div');
  entry.id = 'yakit-hex-choose-entry';
  entry.className = 'list-group-item flex-container flexGap5';
  entry.setAttribute('role', 'button');
  entry.tabIndex = 0;
  entry.innerHTML = `<span class="extensionsMenuExtensionButton" aria-hidden="true">${paletteSvg}</span><span>YaKit-选色</span>`;
  const svg = entry.querySelector('svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  // 点击继续冒泡，让酒馆自行收起菜单；关闭弹窗后焦点回到底部菜单开关。
  const click = () => onOpen(toggle);
  const keydown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    entry.click();
  };
  entry.addEventListener('click', click);
  entry.addEventListener('keydown', keydown);
  menu.append(entry);
  return () => {
    entry.removeEventListener('click', click);
    entry.removeEventListener('keydown', keydown);
    entry.remove();
  };
}
