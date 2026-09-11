import { DEFAULTS, analyzePalette, validateOptions } from './color.js';
import { sampleBackground, backgroundState } from './background.js';
import { createPanel } from './ui/panel.js';

/** 脚本在助手 iframe 运行，界面与采样都使用酒馆所在的父文档。 */
export function start(assets) {
  const host = window.parent;
  const doc = host.document;
  doc.dispatchEvent(new host.Event('yakit-hex-dispose'));
  let result = null, revision = 0, disposed = false, busy = false;
  const panel = createPanel(doc, {
    ...assets, defaults: structuredClone(DEFAULTS),
    onChange: () => invalidate('选项已改变，请重新测试。'),
    onTest: run,
    onCopy: copy,
  });

  function invalidate(message = '主题、壁纸或聊天区已改变，请重新测试。') {
    revision++;
    if (!result && !busy) return;
    result = null;
    panel.clearResult();
    panel.setStatus(message);
  }

  async function run(input) {
    if (busy || disposed) return;
    // 重测时保留仍有效的结果，完成后再替换，避免预览闪回占位内容。
    busy = true;
    panel.setBusy(true);
    panel.setStatus('正在读取壁纸与聊天背景…');
    const version = revision;
    try {
      const options = validateOptions(input);
      const background = await sampleBackground(doc);
      if (disposed) return;
      if (version !== revision) throw new Error('检测期间背景发生变化，请再点一次测试。');
      result = analyzePalette(options, background);
      panel.showResult(result);
      panel.setStatus(result.count ? `${result.count} 个色区可用 · 可复制结果` : '没有共同达标的色区，请调整亮度或聊天底色后重测。');
    } catch (error) {
      result = null;
      if (!disposed) panel.showError(error.message || '测试失败，请重试。');
    } finally {
      busy = false;
      if (!disposed) panel.setBusy(false);
    }
  }

  async function copy() {
    if (!result?.text) return;
    const text = result.text;
    let timer;
    try {
      // 剪贴板调用必须在宿主窗口执行，避免助手 iframe 写入错误的上下文。
      panel.selectOutput();
      const copied = host.Function('return document.execCommand("copy");')();
      if (!copied) await Promise.race([
        host.Function('text', 'return navigator.clipboard.writeText(text);')(text),
        new Promise((_, reject) => { timer = host.setTimeout(() => reject(new Error('复制超时')), 1500); }),
      ]);
      if (!disposed) panel.setStatus('已复制色域文字。');
    } catch {
      // 权限受限时保留可选中的文本，让用户按系统复制快捷键。
      panel.selectOutput();
      panel.setStatus('自动复制不可用，结果已选中，请长按或按 Ctrl/Cmd+C 复制。');
    } finally {
      host.clearTimeout(timer);
    }
  }

  // 只监听决定背景的节点；不读取聊天文字，也不监视本脚本的界面。
  let scene = backgroundState(doc);
  const changed = () => {
    const next = backgroundState(doc);
    if (next === scene) return;
    scene = next;
    invalidate();
  };
  const observer = new host.MutationObserver(changed);
  const attributes = { attributes: true, attributeFilter: ['style', 'class'] };
  for (const element of [doc.documentElement, doc.body, ...doc.querySelectorAll('#bg1, #bg2, #sheld')]) observer.observe(element, attributes);
  const chat = doc.querySelector('#chat');
  if (chat) observer.observe(chat, { ...attributes, childList: true, subtree: true });
  observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  host.addEventListener('resize', changed);
  chat?.addEventListener('scroll', changed, { passive: true });
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    host.removeEventListener('resize', changed);
    chat?.removeEventListener('scroll', changed);
    doc.removeEventListener('yakit-hex-dispose', dispose);
    window.removeEventListener('pagehide', dispose);
    panel.destroy();
  }
  doc.addEventListener('yakit-hex-dispose', dispose);
  window.addEventListener('pagehide', dispose, { once: true });
}
