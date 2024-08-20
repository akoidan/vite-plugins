import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';


async function listAllFiles(imgPath: string, subDisr: string[]): Promise<string[]> {
  const files = await fs.readdir(path.join(imgPath, ...subDisr));
  const res: string[] = [];
  for (let f of files) {
    const filePath = path.join(imgPath, ...subDisr, f);
    const stat = await fs.lstat(filePath);
    if (stat.isDirectory()) {
      res.push(...(await listAllFiles(imgPath, [...subDisr, f])));
    } else {
      res.push([...subDisr, f].join('/'));
    }
  }
  return res;
}


/**
 * sourceDir: the directory to watch which changes will trigger the reload
 * componentPathToReload: component which source code would be modified, a full path should be provided. you can use fs.resolve
 * reloadFunction: a function that will be called when the sourceDir changes, it should return the new code for the component, it receives the current code and a list of all files in the sourceDir
 * filterFiles: each file in sourceDir will be passed to this function, if it returns true the file will be included in the list of files to be passed to reloadFunction
 * debug: if true, will log some debug information
 *
 * Vite config example:
 * ```ts
 * import { resolve } from "path";
 *   {
 *     plugins:  [
 *        watchFsTransform({
 *         sourceDir: resolve(__dirname, '..', 'src', 'assets', 'img'),
 *         componentPathToReload: resolve(__dirname, '..', 'src', 'component-depending-on-source-files.ts'),
 *         filterFiles: (f) => f.endsWith('.txt'),
 *         debug: true,
 *         reloadFunction(code, allFiles) {
 *           const resCode = allFiles.map(f => `'${f}': new URL('@/assets/img/${f}', import.meta.url).href,`).join('\n');
 *           return code + '\n' + `console.log('`${JSON.stringify(allFiles)}`')`;
 *         },
 *       }),
 *     ]
 *   }
 *
 * ```
 * */
export function watchFsTransform(config: {
  sourceDir: string;
  componentPathToReload: string;
  reloadFunction: (code: string, filesList: string[]) => string;
  filterFiles?: (f: string) => boolean;
  debug?: boolean;
}) {
  let watcher: any = null;
  let logger: any = null;
  if (!config.sourceDir || !config.componentPathToReload || !config.reloadFunction) {
    throw Error("Invalid configuration for watchFsTransform ak-vite-plugins plugin");
  }
  return {
    name: 'vite-watch-fs-transform',
    enforce: 'pre',
    configureServer(server: any) {
      logger = server.config.logger;
      const reloadComponent = () => {
        const module = server.moduleGraph.getModuleById(config.componentPathToReload);
        if (module) {
          if (config.debug) {
            logger?.info(`FS changed, reloading ${config.componentPathToReload}`);
          }
          server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        } else {
          if (config.debug) {
            logger?.info(`Cannot find module ${config.componentPathToReload}`);
          }
        }
      }

      watcher = chokidar.watch(config.sourceDir, {
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('add', () => {
        reloadComponent();
      });

      watcher.on('unlink', () => {
        reloadComponent();
      });

    },

    // Ensure watcher is closed when the server stops
    closeBundle
    () {
      if (watcher) {
        watcher.close();
      }
    },
    async transform(code: string, id: string) {
      if (id.startsWith(config.componentPathToReload)) {
        let allFiles = await listAllFiles(config.sourceDir, [])
        if (config.filterFiles) {
          allFiles = allFiles.filter(config.filterFiles);
        }
        if (config.debug) {
          logger?.info(`Modifying source code for ${config.componentPathToReload}`);
        }
        code = config.reloadFunction(code, allFiles);
        return {
          code
        };
      }
    }
  }
}
