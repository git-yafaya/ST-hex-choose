import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
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
  info: 'v0.1.0 · 根据当前酒馆主题和壁纸筛选清晰的正文色域。启用后点击右侧悬浮按钮，再点击开始测试。',
  button: { enabled: false, buttons: [] }, data: {}, export_with: { data: false, button: false },
};
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/YaKit-选色.json'), JSON.stringify(script, null, 2) + '\n');
console.log(`已生成 dist/YaKit-选色.json（${Buffer.byteLength(JSON.stringify(script))} 字节）`);
