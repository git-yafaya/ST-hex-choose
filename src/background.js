import { luminance } from './color.js';

/** 只比较真正影响采样的样式和位置，忽略其他扩展刷新按钮的操作。 */
export function backgroundState(doc) {
  const win = doc.defaultView;
  const nodes = new Set([doc.documentElement, doc.body, ...doc.querySelectorAll('#bg1, #bg2, #sheld, #chat')]);
  for (const target of doc.querySelectorAll('#chat .mes_text')) {
    const r = target.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > win.innerHeight) continue;
    for (let element = target; element && element !== doc.body; element = element.parentElement) nodes.add(element);
  }
  return JSON.stringify([...nodes].map(element => {
    const s = win.getComputedStyle(element), r = element.getBoundingClientRect();
    return [s.backgroundColor, s.backgroundImage, s.backgroundSize, s.backgroundPosition, s.backgroundRepeat,
      s.backgroundAttachment, s.filter, s.backdropFilter, s.opacity, s.mixBlendMode, s.backgroundBlendMode,
      s.display, s.visibility, r.x, r.y, r.width, r.height,
      ...['::before', '::after'].map(pseudo => { const p = win.getComputedStyle(element, pseudo); return [p.content, p.background]; })];
  }));
}

/** 用浏览器自己的颜色解析和 Canvas 合成，读取标准酒馆的壁纸与聊天底色。 */
export async function sampleBackground(doc) {
  const win = doc.defaultView;
  const chat = doc.querySelector('#chat');
  if (!chat) throw new Error('未找到酒馆聊天区，请在酒馆助手的脚本库中运行。');
  const width = win.innerWidth, height = win.innerHeight;
  // ponytail: 将视口最长边缩到 480 像素估算；若需逐像素认证，再增加原尺寸采样。
  const scale = Math.min(1, 480 / Math.max(width, height));
  const canvas = doc.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  let hasWallpaper = false;
  const viewport = { x: 0, y: 0, width, height };

  function copyCanvas(source) {
    const copy = doc.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d').drawImage(source, 0, 0);
    return copy;
  }

  function loadImage(url) {
    if (!cache.has(url)) cache.set(url, new Promise((resolve, reject) => {
      const image = new win.Image();
      // 同源图片正常携带身份；跨域图片必须允许 Canvas 读取。
      image.crossOrigin = 'anonymous';
      const timer = win.setTimeout(() => { image.src = ''; reject(new Error('壁纸读取超时，请稍后重试。')); }, 8000);
      image.onload = () => { win.clearTimeout(timer); resolve(image); };
      image.onerror = () => { win.clearTimeout(timer); reject(new Error('无法读取当前壁纸，请换用酒馆本地壁纸后重试。')); };
      image.src = new URL(url, doc.baseURI).href;
    }));
    return cache.get(url);
  }

  function length(value, total) {
    if (/^-?[\d.]+%$/.test(value)) return parseFloat(value) / 100 * total;
    if (/^-?[\d.]+px$/.test(value) || value === '0') return parseFloat(value);
    throw new Error('当前壁纸使用了暂不支持的定位方式，请使用酒馆的填充或适应模式。');
  }

  async function paint(element, wallpaper = false) {
    const s = win.getComputedStyle(element);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return;
    if (s.mixBlendMode !== 'normal' || s.backgroundBlendMode.split(',').some(v => v.trim() !== 'normal')
      || (!wallpaper && Number(s.opacity) !== 1) || (!wallpaper && s.filter !== 'none')) {
      throw new Error('当前聊天背景含混合或整体滤镜，无法可靠测试。请使用标准酒馆主题后重试。');
    }
    const r = element === doc.body || element === doc.documentElement ? viewport : element.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let image;
    if (s.backgroundImage !== 'none') {
      const match = /^url\(["']?(.+?)["']?\)$/.exec(s.backgroundImage);
      if (!match || /["']\),\s*url\(/.test(s.backgroundImage)) throw new Error('暂不支持渐变或多层背景图片，请换用单张壁纸后重试。');
      image = await loadImage(match[1]);
      if (wallpaper) hasWallpaper = true;
    }
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
    ctx.clip();
    if (s.backdropFilter && s.backdropFilter !== 'none') {
      const copy = copyCanvas(canvas);
      // 缩小画布时，模糊半径也按相同比例缩放。
      ctx.filter = s.backdropFilter.replace(/blur\(([\d.]+)px\)/g, (_, radius) => `blur(${Number(radius) * scale}px)`);
      ctx.drawImage(copy, 0, 0, width, height);
      ctx.filter = 'none';
    }
    ctx.globalAlpha = Number(s.opacity);
    if (wallpaper) ctx.filter = s.filter;
    ctx.fillStyle = s.backgroundColor;
    ctx.fillRect(r.x, r.y, r.width, r.height);
    if (image) {
      const box = s.backgroundAttachment === 'fixed' ? viewport : r;
      let w, h;
      if (['cover', 'contain'].includes(s.backgroundSize)) {
        const factor = Math[s.backgroundSize === 'cover' ? 'max' : 'min'](box.width / image.naturalWidth, box.height / image.naturalHeight);
        w = image.naturalWidth * factor;
        h = image.naturalHeight * factor;
      } else {
        const [a, b = 'auto'] = s.backgroundSize.split(' ');
        w = a === 'auto' ? null : length(a, box.width);
        h = b === 'auto' ? null : length(b, box.height);
        if (w === null && h === null) { w = image.naturalWidth; h = image.naturalHeight; }
        else if (w === null) w = h * image.naturalWidth / image.naturalHeight;
        else if (h === null) h = w * image.naturalHeight / image.naturalWidth;
      }
      const position = s.backgroundPosition.split(' ');
      if (position.length > 2 || w <= 0 || h <= 0) throw new Error('壁纸尺寸或位置无法读取，请使用酒馆的填充模式。');
      const x = box.x + length(position[0], box.width - w);
      const y = box.y + length(position[1] || '50%', box.height - h);
      const repeat = s.backgroundRepeat.split(' ');
      const repeatX = ['repeat', 'repeat-x'].includes(repeat[0]);
      const repeatY = repeat[0] === 'repeat-y' || (repeat[1] || repeat[0]) === 'repeat';
      if (repeat.some(value => !['repeat', 'repeat-x', 'repeat-y', 'no-repeat'].includes(value))) throw new Error('暂不支持当前壁纸的平铺方式。');
      // 平铺时从可见左上角开始绘制，不遍历视口外的图片。
      const firstX = repeatX ? x + Math.floor((r.x - x) / w) * w : x;
      const firstY = repeatY ? y + Math.floor((r.y - y) / h) * h : y;
      for (let yy = firstY; yy < (repeatY ? r.y + r.height : firstY + 1); yy += h) {
        for (let xx = firstX; xx < (repeatX ? r.x + r.width : firstX + 1); xx += w) ctx.drawImage(image, xx, yy, w, h);
      }
    }
    ctx.restore();
  }

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await paint(doc.documentElement);
  await paint(doc.body);
  for (const element of doc.querySelectorAll('#bg1, #bg2')) await paint(element, true);
  const base = copyCanvas(canvas);
  const chatRect = chat.getBoundingClientRect();
  const intersect = rect => ({
    left: Math.max(0, chatRect.left, rect.left), right: Math.min(width, chatRect.right, rect.right),
    top: Math.max(0, chatRect.top, rect.top), bottom: Math.min(height, chatRect.bottom, rect.bottom),
  });
  const visible = [...chat.querySelectorAll('.mes_text')].filter(element => {
    const r = intersect(element.getBoundingClientRect());
    const s = win.getComputedStyle(element);
    return r.right - r.left > 4 && r.bottom - r.top > 4 && s.visibility !== 'hidden' && s.display !== 'none';
  });
  const targets = visible.length ? visible : [chat];
  let min = Infinity, max = -Infinity, preview = '#fff', pixels = 0;
  for (const target of targets) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    const chain = [];
    for (let element = target; element && element !== doc.body; element = element.parentElement) chain.unshift(element);
    for (const element of chain) {
      for (const pseudo of ['::before', '::after']) {
        const s = win.getComputedStyle(element, pseudo);
        if (!['none', 'normal'].includes(s.content) && s.display !== 'none'
          && (s.backgroundImage !== 'none' || !['rgba(0, 0, 0, 0)', 'transparent'].includes(s.backgroundColor))) {
          throw new Error('聊天区含自定义伪元素背景，请使用标准酒馆主题后重试。');
        }
      }
      await paint(element);
    }
    const rect = intersect(target.getBoundingClientRect());
    const x = Math.ceil((rect.left + 2) * scale), y = Math.ceil((rect.top + 2) * scale);
    const w = Math.floor((rect.right - 2) * scale) - x, h = Math.floor((rect.bottom - 2) * scale) - y;
    if (w < 1 || h < 1) continue;
    let data;
    try { data = ctx.getImageData(x, y, w, h).data; }
    catch { throw new Error('浏览器不允许读取此壁纸，请换用酒馆本地壁纸后重试。'); }
    for (let i = 0; i < data.length; i += 4) {
      const rgb = [data[i], data[i + 1], data[i + 2]];
      const value = luminance(rgb);
      if (value < min) { min = value; preview = `rgb(${rgb.join(' ')})`; }
      max = Math.max(max, value);
      pixels++;
    }
  }
  if (!pixels) throw new Error('聊天区当前不可见，请展开聊天区后重新测试。');
  return { min, max, preview,
    summary: `${hasWallpaper ? '当前壁纸' : '纯色背景'} + ${visible.length ? '可见消息底色' : '空聊天区底色'} · ${pixels} 个采样点 · 换主题、壁纸或滚动后请重测` };
}
