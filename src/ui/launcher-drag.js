/** 拖动悬浮按钮，短按和键盘操作仍按普通点击处理。 */
export function attachLauncherDrag(launcher) {
  const view = launcher.ownerDocument.defaultView;
  let drag;
  let suppressClick = false;
  const place = (left, top) => {
    launcher.style.left = `${Math.max(0, Math.min(left, view.innerWidth - launcher.offsetWidth))}px`;
    launcher.style.top = `${Math.max(0, Math.min(top, view.innerHeight - launcher.offsetHeight))}px`;
    launcher.style.right = 'auto';
  };
  const down = event => {
    if (drag || event.button !== 0 || event.isPrimary === false) return;
    const box = launcher.getBoundingClientRect();
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top, moved: false };
    launcher.setPointerCapture(event.pointerId);
  };
  const move = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.x;
    const y = event.clientY - drag.y;
    // 留出短按时的手部抖动距离，避免点开按钮时误移位置。
    if (!drag.moved && Math.hypot(x, y) < 5) return;
    drag.moved = true;
    place(drag.left + x, drag.top + y);
  };
  const end = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { id, moved } = drag;
    drag = null;
    suppressClick = moved;
    if (launcher.hasPointerCapture(id)) launcher.releasePointerCapture(id);
  };
  const click = event => {
    // 拖动结束后的鼠标或触屏点击不打开面板，键盘点击不受影响。
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const resize = () => {
    if (launcher.style.left) place(parseFloat(launcher.style.left), parseFloat(launcher.style.top));
  };
  const events = { pointerdown: down, pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end };
  for (const [type, listener] of Object.entries(events)) launcher.addEventListener(type, listener);
  launcher.addEventListener('click', click, true);
  view.addEventListener('resize', resize);
  return () => {
    if (drag) end({ pointerId: drag.id });
    for (const [type, listener] of Object.entries(events)) launcher.removeEventListener(type, listener);
    launcher.removeEventListener('click', click, true);
    view.removeEventListener('resize', resize);
  };
}
