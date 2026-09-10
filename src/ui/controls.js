/** 这里只负责表单展示和读值，色区有效性由检测层判断。 */
export function createControls(doc, defaults, onChange) {
  const root = doc.createElement('fieldset');
  root.className = 'controls';
  root.setAttribute('aria-label', '检测选项与色区');
  root.innerHTML = `
    <section class="card">
      <h2 class="card-heading">检测选项</h2>
      <div class="card-content">
        <label class="check-label"><input name="auto" type="checkbox">自动寻找最佳亮度</label>
        <div class="field-grid">
          <label>饱和度 S（%）<input name="saturation" type="number" min="0" max="100" step="1" required></label>
          <label>亮度 L（%）<input name="lightness" type="number" min="0" max="100" step="1" required></label>
        </div>
        <label class="field">正文对比度要求<select name="threshold"><option value="4.5">4.5 : 1 · 标准</option><option value="7">7 : 1 · 更高</option></select></label>
        <p class="hint">自动亮度会为已选色区寻找共同可用的亮度。</p>
      </div>
    </section>
    <section class="card">
      <div class="card-heading"><h2>自定义色区</h2><div class="small-actions"><button type="button" data-action="all">全选</button><button type="button" data-action="reset">恢复默认</button></div></div>
      <div class="card-content">
        <div class="group-heading"><span>色区</span><span>起始 H°</span><span>结束 H°</span></div>
        <div class="group-list"></div>
        <p class="hint">H 为色相角度（0–360°）。起始大于结束时跨过 0°，例如红色 345°–15°。</p>
      </div>
    </section>`;
  const field = name => root.querySelector(`[name="${name}"]`);
  const rows = defaults.groups.map((group, index) => {
    const row = doc.createElement('div');
    row.className = 'group-row';
    row.innerHTML = `<label class="check-label"><input type="checkbox"><span></span></label><input type="number" min="0" max="360" step="1" required><input type="number" min="0" max="360" step="1" required>`;
    row.querySelector('span').textContent = group.name;
    const [enabled, start, end] = row.querySelectorAll('input');
    start.setAttribute('aria-label', `${group.name}色起始色相`);
    end.setAttribute('aria-label', `${group.name}色结束色相`);
    root.querySelector('.group-list').append(row);
    return { enabled, start, end, index };
  });
  const syncLightness = () => { field('lightness').disabled = field('auto').checked; };
  const resetGroups = () => rows.forEach(({ enabled, start, end, index }) => {
    const group = defaults.groups[index];
    enabled.checked = group.enabled;
    start.value = group.start;
    end.value = group.end;
  });
  for (const name of ['saturation', 'lightness', 'threshold']) field(name).value = defaults[name];
  field('auto').checked = defaults.auto;
  resetGroups();
  syncLightness();
  root.addEventListener('input', () => { syncLightness(); onChange(); });
  root.querySelector('[data-action="all"]').addEventListener('click', () => {
    rows.forEach(({ enabled }) => { enabled.checked = true; });
    onChange();
  });
  root.querySelector('[data-action="reset"]').addEventListener('click', () => { resetGroups(); onChange(); });
  return {
    element: root,
    readOptions: () => ({
      saturation: field('saturation').valueAsNumber,
      lightness: field('lightness').valueAsNumber,
      auto: field('auto').checked,
      threshold: Number(field('threshold').value),
      groups: rows.map(({ enabled, start, end, index }) => ({
        name: defaults.groups[index].name,
        start: start.valueAsNumber,
        end: end.valueAsNumber,
        enabled: enabled.checked,
      })),
    }),
  };
}
