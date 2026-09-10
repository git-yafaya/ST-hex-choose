export const DEFAULTS = {
  saturation: 70, lightness: 50, auto: true, threshold: 4.5,
  groups: [
    ['红', 345, 15], ['橙', 15, 40], ['金黄', 40, 65], ['绿', 65, 165],
    ['青', 165, 200], ['蓝', 200, 260], ['紫', 260, 300], ['粉', 300, 345],
  ].map(([name, start, end]) => ({ name, start, end, enabled: true })),
};

/** 固定饱和度、亮度，把色相转换成浏览器使用的 RGB。 */
export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => {
    const k = (n + ((h % 360 + 360) % 360) / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  });
}

/** WCAG 相对亮度，不能直接用 RGB 平均值代替。 */
export function luminance(rgb) {
  return rgb.reduce((sum, value, index) => {
    const c = value / 255;
    return sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

export function contrast(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 两个亮度区间重叠时，不能把亮暗两端都达标误判成中间也达标。 */
export function intervalContrast(low, high, background) {
  if (high < background.min) return contrast(high, background.min);
  if (low > background.max) return contrast(low, background.max);
  return 1;
}

export function validateOptions(input) {
  for (const key of ['saturation', 'lightness']) {
    if (key === 'lightness' && input.auto) continue;
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 100) {
      throw new Error(`${key === 'saturation' ? '饱和度' : '亮度'}须为 0–100 的数字。`);
    }
  }
  if (![4.5, 7].includes(input.threshold)) throw new Error('请选择 4.5:1 或 7:1 对比度。');
  if (!Array.isArray(input.groups) || input.groups.length !== 8) throw new Error('色区设置不完整，请恢复默认。');
  if (!input.groups.some(group => group.enabled)) throw new Error('请至少勾选一个色区。');
  const groups = input.groups.map((group, i) => {
    if (group.enabled && (![group.start, group.end].every(v => Number.isInteger(v) && v >= 0 && v <= 360)
      || group.start === group.end || (group.start === 360 && group.end === 0))) {
      throw new Error(`${DEFAULTS.groups[i].name}色区须填写 0–360 的整数，起止不能相同。`);
    }
    return { ...group, name: DEFAULTS.groups[i].name };
  });
  return { ...input, lightness: input.auto ? 50 : input.lightness, auto: Boolean(input.auto), groups };
}

export function splitRange(start, end) {
  return start < end ? [[start, end]] : [[start, 360], [0, end]].filter(([a, b]) => a < b);
}

/** 每一度都检查两端；HSL 在每个 60 度段内的亮度单调，保证不会漏掉段内低点。 */
function scan(options, background, lightness) {
  const values = Array.from({ length: 361 }, (_, h) => luminance(hslToRgb(h, options.saturation, lightness)));
  let coverage = 0;
  const groups = options.groups.map(group => {
    const ranges = [];
    let minimum = Infinity;
    if (group.enabled) {
      for (const [start, end] of splitRange(group.start, group.end)) {
        for (let h = start; h < end; h++) {
          const ratio = intervalContrast(Math.min(values[h], values[h + 1]), Math.max(values[h], values[h + 1]), background);
          if (ratio < options.threshold) continue;
          minimum = Math.min(minimum, ratio);
          coverage++;
          const last = ranges.at(-1);
          if (last && last[1] === h) last[1] = h + 1;
          else ranges.push([h, h + 1]);
        }
      }
    }
    const hue = ranges.length ? (ranges[0][0] + ranges[0][1]) / 2 : group.start;
    return { ...group, ranges, passed: ranges.length > 0, contrast: Number.isFinite(minimum) ? minimum : 0,
      css: `hsl(${hue} ${options.saturation}% ${lightness}%)` };
  });
  return { groups, coverage, lightness };
}

export function analyzePalette(input, background) {
  const options = validateOptions(input);
  if (!Number.isFinite(background.min) || !Number.isFinite(background.max)
    || background.min < 0 || background.max > 1 || background.min > background.max) {
    throw new Error('背景采样无效，请重新测试。');
  }
  let best = scan(options, background, options.lightness);
  if (options.auto) {
    best = null;
    // 自动亮度保留颜色辨识度；并列时选最接近 50% 的亮度。
    for (let l = 10; l <= 90; l++) {
      const current = scan(options, background, l);
      if (!best || current.coverage > best.coverage
        || (current.coverage === best.coverage && Math.abs(l - 50) < Math.abs(best.lightness - 50))) best = current;
    }
  }
  const passed = best.groups.filter(group => group.passed);
  const text = passed.length
    ? `选色（HSL色相）：${passed.map(group => group.name + group.ranges.map(([a, b]) => `${a}–${b}`).join('或')).join('、')}。使用条件：饱和度${options.saturation}%、亮度${best.lightness}%；当前可见聊天区采样对比度≥${options.threshold}:1。`
    : '';
  return { ...best, text, count: passed.length, saturation: options.saturation, threshold: options.threshold,
    backgroundCss: background.preview, summary: background.summary };
}
