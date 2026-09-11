import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
const { version } = JSON.parse(await read('package.json'));
const modules = new Map();

/** 将本项目的静态相对导入转为内嵌模块，直接使用浏览器原生模块加载器。 */
async function embed(path) {
  if (modules.has(path)) return modules.get(path);
  let source = await readFile(path, 'utf8');
  const imports = [...source.matchAll(/^import\s+[^;\n]+?\s+from\s+(['"])(\.[^'"]+)\1;/gm)];
  for (const match of imports) {
    const url = await embed(resolve(dirname(path), match[2]));
    source = source.replace(match[0], match[0].replace(match[2], url));
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  modules.set(path, url);
  return url;
}

const css = (await Promise.all(['shared/theme/tokens.css', 'src/ui/panel.css', 'src/ui/motion.css'].map(read))).join('\n');
const names = ['palette', 'close', 'test', 'copy', 'check'];
const icons = Object.fromEntries(await Promise.all(names.map(async name => [name, await read(`icons/${name}.svg`)])));
const entry = await embed(resolve(root, 'src/app.js'));
const content = `// YaKit-选色：由 npm run build 生成。\nimport { start } from ${JSON.stringify(entry)};\nstart(${JSON.stringify({ css, icons })});`;
const script = {
  type: 'script', enabled: false, name: 'YaKit-选色',
  id: 'f1f7b5e0-a191-4c6f-bc70-5998b890a47d', content,
  info: `v${version} · 根据当前酒馆主题和壁纸筛选清晰的正文色域。启用后点击右侧悬浮按钮，再点击开始测试。`,
  button: { enabled: false, buttons: [] }, data: {}, export_with: { data: false, button: false },
};
// 在线包只负责在启用时加载仓库发布的脚本，实际内容由线上文件提供。
const onlineScript = {
  ...script,
  content: "import 'https://cdn.jsdelivr.net/gh/git-yafaya/ST-hex-choose@main/dist/yakit-hex-choose.js';",
  info: '在线加载版 · 启用时从线上加载 YaKit-选色，需要联网。加载完成后点击右侧悬浮按钮，再点击开始测试。',
};
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/YaKit-选色.json'), JSON.stringify(script, null, 2) + '\n');
await writeFile(resolve(root, 'dist/yakit-hex-choose.js'), content + '\n');
await writeFile(resolve(root, 'dist/YaKit-选色-自动更新.json'), JSON.stringify(onlineScript, null, 2) + '\n');
console.log('已生成 dist/YaKit-选色.json、dist/yakit-hex-choose.js、dist/YaKit-选色-自动更新.json');
