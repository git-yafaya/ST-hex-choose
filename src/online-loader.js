// 先确认最新提交，再按固定提交地址获取脚本，避免分支地址缓存旧版本。
const url = new URL('https://api.github.com/repos/git-yafaya/ST-hex-choose/git/ref/heads/main');
url.searchParams.set('t', String(Date.now()));
const reference = await fetch(url, { cache: 'no-store' });
if (!reference.ok) throw new Error(`YaKit-选色版本查询失败：HTTP ${reference.status}`);
const sha = (await reference.json())?.object?.sha;
if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) throw new Error('YaKit-选色版本查询失败：提交编号无效');
const response = await fetch(`https://raw.githubusercontent.com/git-yafaya/ST-hex-choose/${sha}/dist/yakit-hex-choose.js`, { cache: 'no-store' });
if (!response.ok) throw new Error(`YaKit-选色加载失败：HTTP ${response.status}`);

// 用独立的模块地址在当前助手 iframe 执行，加载结束后释放地址。
const moduleUrl = URL.createObjectURL(new Blob([await response.text()], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
