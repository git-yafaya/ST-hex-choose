import { attachDialogMotion } from '../../shared/ui/dialog-motion.js';
import { createControls } from './controls.js';
import { attachExtensionEntry } from './extension-entry.js';

/** 弹窗放入 Shadow DOM，入口接入酒馆底部扩展菜单。 */
export function createPanel(doc, { css, icons, defaults, onTest, onChange, onCopy }) {
  const host = doc.createElement('div');
  host.id = 'yakit-hex-choose';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = css;
  const shell = doc.createElement('div');
  shell.className = 'yakit-theme-forest';
  const icon = name => `<span class="icon" aria-hidden="true">${icons[name]}</span>`;
  shell.innerHTML = `
    <dialog class="panel" aria-labelledby="panel-title" aria-describedby="panel-description">
      <header class="panel-header">${icon('palette')}<h1 id="panel-title">YaKit-选色</h1><button class="icon-button close-button" type="button" aria-label="关闭">${icon('close')}</button></header>
      <div class="panel-body">
        <p id="panel-description" class="intro">依据当前壁纸和聊天背景，测试适合正文的颜色。</p>
        <div class="workspace">
          <section class="card preview-card" aria-labelledby="preview-title">
            <div class="card-heading"><h2 id="preview-title">结果预览</h2><span class="badge" hidden></span></div>
            <div class="copy-bar"><button class="secondary-button copy-button" type="button" disabled>${icon('copy')}复制配置</button></div>
            <div class="preview-content">
              <div class="empty-state">${icon('test')}<p>选好色区，开始测试</p><span>可用范围和正文样例会显示在这里。</span></div>
              <div class="result-content" hidden>
                <p class="result-summary"></p><p class="result-settings hint"></p>
                <label class="output-label" for="color-output">可复制的色区配置</label>
                <textarea id="color-output" readonly spellcheck="false" aria-label="生成的色区配置"></textarea>
                <div class="result-groups"></div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <footer class="panel-footer"><p class="status" role="status" aria-live="polite">准备就绪</p><button class="primary-button test-button" type="button">${icon('test')}<span>开始测试</span></button></footer>
    </dialog>`;
  shadow.append(style, shell);
  const find = selector => shell.querySelector(selector);
  const dialog = find('dialog');
  const copy = find('.copy-button');
  const test = find('.test-button');
  const output = find('textarea');
  const status = find('.status');
  const controls = createControls(doc, defaults, onChange);
  find('.workspace').prepend(controls.element);
  const close = attachDialogMotion(dialog);
  let previousFocus;
  const open = (returnFocus = shadow.activeElement || doc.activeElement) => {
    previousFocus = returnFocus;
    if (!dialog.open) dialog.showModal();
    dialog.dispatchEvent(new doc.defaultView.Event('yakit:open'));
    find('.close-button').focus();
  };
  const setStatus = message => {
    status.textContent = message;
    status.classList.remove('is-error');
  };
  const clearResult = () => {
    find('.empty-state').hidden = false;
    find('.result-content').hidden = true;
    find('.badge').hidden = true;
    find('.result-groups').replaceChildren();
    output.value = '';
    copy.disabled = true;
  };
  const detachExtensionEntry = attachExtensionEntry(doc, icons.palette, open);
  doc.body.append(host);
  find('.close-button').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    if (previousFocus?.isConnected) previousFocus.focus();
  });
  dialog.addEventListener('click', event => {
    // 只在点击弹窗边界外时关闭，避免内容留白被当作遮罩。
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  test.addEventListener('click', () => onTest(controls.readOptions()));
  copy.addEventListener('click', onCopy);
  return {
    open,
    destroy() { detachExtensionEntry(); dialog.close(); host.remove(); },
    readOptions: controls.readOptions,
    setBusy(busy) {
      // 测试时锁定表单操作，保持控件原有外观。
      controls.element.inert = busy;
      test.disabled = busy;
      dialog.setAttribute('aria-busy', String(busy));
      test.querySelector('span:last-child').textContent = busy ? '正在测试…' : '开始测试';
    },
    clearResult,
    showError(message) { clearResult(); setStatus(message); status.classList.add('is-error'); },
    setStatus,
    selectOutput() { output.focus(); output.select(); },
    showResult(result) {
      find('.empty-state').hidden = true;
      find('.result-content').hidden = false;
      find('.badge').hidden = false;
      find('.badge').textContent = `${result.count} 组可用`;
      find('.result-summary').textContent = result.summary;
      find('.result-settings').textContent = `饱和度 ${result.saturation}% · 亮度 ${result.lightness}% · 对比度要求 ${result.threshold} : 1`;
      const list = find('.result-groups');
      list.replaceChildren();
      for (const group of result.groups) {
        const row = doc.createElement('section');
        row.className = `result-group${group.passed ? ' is-passed' : ''}`;
        row.innerHTML = `<div class="result-group-title"><strong></strong><span class="group-state"></span></div><p class="range-text"></p><p class="color-sample">清风穿过树梢，把故事带向远方。<br>The story continues in color. 0123456789</p>`;
        row.querySelector('strong').textContent = group.name;
        const state = row.querySelector('.group-state');
        if (group.passed) state.innerHTML = icon('check');
        state.append(doc.createTextNode(!group.enabled ? '未选择' : group.passed ? '可用' : '未通过'));
        row.querySelector('.range-text').textContent = !group.enabled ? '本次未检测' : group.ranges.length
          ? `${group.ranges.map(([start, end]) => `${start}°–${end}°`).join('、')} · 最低 ${Number(group.contrast).toFixed(2)} : 1`
          : '当前条件下没有可用范围';
        const sample = row.querySelector('.color-sample');
        sample.hidden = !group.passed;
        sample.style.background = result.backgroundCss;
        sample.style.color = group.css;
        list.append(row);
      }
      output.value = result.text;
      copy.disabled = !result.text;
      setStatus(`测试完成，${result.count} 组颜色可用`);
      // 窄屏直接将结果移到主体顶部，便于查看和复制。
      if (doc.defaultView.innerWidth < 960) {
        const body = find('.panel-body');
        body.scrollTop += find('.preview-card').getBoundingClientRect().top - body.getBoundingClientRect().top;
      }
    },
  };
}
