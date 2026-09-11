/** 只在打开和关闭时播放动效，结束后移除对应状态。 */
export function attachDialogMotion(root) {
  let openingAnimation, closingAnimation;
  const reset = () => {
    openingAnimation = null;
    closingAnimation = null;
    root.classList.remove('yakit-panel--opening', 'yakit-panel--closing');
    root.inert = false;
  };
  const close = () => {
    if (!root.open || root.classList.contains('yakit-panel--closing')) return;
    reset();
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
  root.addEventListener('yakit:open', () => {
    reset();
    root.classList.add('yakit-panel--opening');
    const animation = root.getAnimations().find(item => item.animationName === 'yakit-panel-enter');
    if (!animation) {
      reset();
      return;
    }
    openingAnimation = animation;
    animation.finished.catch(() => {}).then(() => {
      if (openingAnimation !== animation) return;
      openingAnimation = null;
      root.classList.remove('yakit-panel--opening');
    });
  });
  return close;
}
