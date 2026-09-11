import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULTS, hslToRgb, luminance, contrast, intervalContrast, analyzePalette } from '../src/color.js';

const options = patch => ({ ...structuredClone(DEFAULTS), ...patch });
const background = (min, max = min) => ({ min, max, preview: '#222', summary: '检查背景' });
assert.equal(contrast(0, 1), 21);
assert.equal(contrast(0.5, 0.5), 1);
assert.deepEqual(hslToRgb(0, 100, 50), [255, 0, 0]);
assert.deepEqual(hslToRgb(360, 100, 50), [255, 0, 0]);
assert.equal(luminance([0, 0, 0]), 0);
assert.equal(luminance([255, 255, 255]), 1);

// 黑白两端分别达标不代表混合壁纸中间的灰色也达标。
assert.equal(intervalContrast(0.4, 0.6, background(0, 1)), 1);
assert.equal(analyzePalette(options(), background(0, 1)).count, 0);
assert.equal(analyzePalette(options(), background(0, 1)).text, '');

const dark = analyzePalette(options(), background(0.02));
const light = analyzePalette(options(), background(0.95));
assert.equal(dark.count, 8);
assert.equal(light.count, 8);
assert.ok(dark.lightness > light.lightness);
assert.deepEqual(dark.groups[0].ranges, [[345, 360], [0, 15]]);
assert.equal(dark.text, '选色（HSL色相）：红345–360或0–15、橙15–40、金黄40–65、绿65–165、青165–200、蓝200–260、紫260–300、粉300–345。');

const partial = analyzePalette(options({ auto: false }), background(0.02, 0.04));
assert.ok(partial.count > 0 && partial.count < 8);
// 对输出区间再次用细于一度的点验证，能发现拼接范围漏检和阈值舍入错误。
for (const result of [dark, light, partial]) {
  const bg = result === light ? background(0.95) : result === dark ? background(0.02) : background(0.02, 0.04);
  for (const group of result.groups) {
    for (const [start, end] of group.ranges) {
      for (let h = start; h <= end; h += 0.25) {
        const value = luminance(hslToRgb(h, result.saturation, result.lightness));
        assert.ok(intervalContrast(value, value, bg) >= result.threshold);
      }
    }
  }
}
const custom = options();
custom.groups.forEach((group, i) => { group.enabled = i === 0; });
custom.groups[0].start = 350;
custom.groups[0].end = 5;
assert.deepEqual(analyzePalette(custom, background(0)).groups[0].ranges, [[350, 360], [0, 5]]);
assert.equal(analyzePalette(custom, background(0)).count, 1);
assert.throws(() => analyzePalette(options({ saturation: NaN }), background(0)), /饱和度/);
assert.throws(() => analyzePalette(options({ auto: false, lightness: 101 }), background(0)), /亮度/);
assert.equal(analyzePalette(options({ lightness: NaN }), background(0)).count, 8);
assert.throws(() => analyzePalette(options({ threshold: 3 }), background(0)), /对比度/);
assert.throws(() => analyzePalette(options({ groups: DEFAULTS.groups.map(g => ({ ...g, enabled: false })) }), background(0)), /至少/);
custom.groups[0].end = 350;
assert.throws(() => analyzePalette(custom, background(0)), /起止/);

// 导入产物必须完整自包含，不带本机路径或外部脚本地址。
const script = JSON.parse(await readFile(new URL('../dist/YaKit-选色.json', import.meta.url), 'utf8'));
assert.equal(script.type, 'script');
assert.equal(script.enabled, false);
assert.equal(script.button.enabled, false);
assert.ok(script.content.includes('data:text/javascript;base64,'));
assert.ok(!script.content.includes('/home/'));

// 在线入口与离线包共用脚本身份，发布模块必须和离线内容完全一致。
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(script.info.startsWith(`v${pkg.version} ·`));
const module = await readFile(new URL('../dist/yakit-hex-choose.js', import.meta.url), 'utf8');
assert.equal(module, script.content + '\n');
const online = JSON.parse(await readFile(new URL('../dist/YaKit-选色-在线.json', import.meta.url), 'utf8'));
for (const key of ['id', 'name', 'type', 'enabled', 'button', 'data', 'export_with']) {
  assert.deepEqual(online[key], script[key]);
}
// 允许说明注释，实际执行内容只能加载这一个发布模块。
assert.equal(online.content.replace(/^\s*\/\/.*$/gm, '').trim(),
  "import 'https://cdn.jsdelivr.net/gh/git-yafaya/ST-hex-choose@main/dist/yakit-hex-choose.js';");
console.log('检查通过：对比度、跨零色区、自动亮度、自定义区间、无结果与离线/在线分发格式。');
