/** 关闭按钮、遮罩和 Esc 共用退场动画，结束后再退出原生弹窗。 */
export function attachDialogMotion(root) {
  let closingAnimation;
  const reset = () => {
    closingAnimation = null;
    root.classList.remove('yakit-panel--closing');
    root.inert = false;
  };
  const close = () => {
    if (!root.open || root.classList.contains('yakit-panel--closing')) return;
    root.classList.add('yakit-panel--closing');
    root.inert = true;
    const animation = root.getAnimations().find(item => item.animationName === 'yakit-panel-exit');
    // 减少动态效果或样式尚未加载时，直接关闭，不人为等待。
    if (!animation) {
      reset();
      root.close();
      return;
    }
    closingAnimation = animation;
    animation.finished.catch(() => {}).then(() => {
      if (closingAnimation !== animation) return;
      reset();
      root.close();
    });
  };
  root.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  root.addEventListener('close', reset);
  root.addEventListener('yakit:open', reset);
  return close;
}
