A handy list of vite plugins


### Watch-fs transform
E.g. load all files during building into vite and fetch them dynamically during runtime.

**svg-illustration.ts**:
```ts
const filesList: Record<string, string> = {
  'KEY': 'TRANSFORM_REPLACE_VALUE',
};
const result = await fetch(filesList['myfile.txt']);
console.log(result.text());
```
**vite.config.ts**:
```ts
import {watchFsTransform} from 'ak-vite-plugins';

plugins: [
  watchFsTransform({
    sourceDir: resolve(__dirname, '..', 'src', 'assets', 'img'),
    componentPathToReload: resolve(__dirname, '..', 'src', 'load-files.ts'),
    filterFiles: (f) => f.endsWith('.svg'),
    debug: true,
    reloadFunction(code, allFiles) {
      const resCode = allFiles.map(f => `'${f}': new URL('@/assets/img/${f}', import.meta.url).href,`).join('\n');
      return code.replace("'KEY': 'TRANSFORM_REPLACE_VALUE',", resCode)
    },
  }),
]
```
