// Download the pinned runtime builds, the map atlas, and their original notices. No build step at deploy time.
import { mkdir, writeFile } from 'node:fs/promises';
import { LIBRARIES } from '../js/studio/cdn.js';

const root = new URL('../', import.meta.url);
await mkdir(new URL('lib/licenses/', root), { recursive: true });
for (const key of ['matrix', 'treemap', 'topojson', 'boxplot', 'arquero', 'echarts', 'worldAtlas']) {
  const lib = LIBRARIES[key];
  // Everything up to `@<version>/` — also right for scoped names like `@sgratzl/…`.
  const packageRoot = lib.url.match(/^.*?@\d[^/]*\//)[0];
  const files = [[lib.url, lib.local], [packageRoot + 'LICENSE', `lib/licenses/${key}-LICENSE`]];
  if (key === 'echarts') files.push(
    [packageRoot + 'NOTICE', 'lib/licenses/echarts-NOTICE'],
    [packageRoot + 'licenses/LICENSE-d3', 'lib/licenses/echarts-LICENSE-d3'],
  );
  for (const [url, path] of files) {
    const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(new URL(path, root), bytes);
    console.log(`${path}: ${bytes.length} bytes`);
  }
}
