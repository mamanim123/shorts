PS F:\test\쇼츠대본생성기-v3.5.3> npm run dev

> 쇼츠대본생성기-v3@2.5.2 dev
> concurrently "npm run server" "vite"

[0]
[0] > 쇼츠대본생성기-v3@2.5.2 server
[0] > node server/index.js
[0]
[1] F:\test\쇼츠대본생성기-v3.5.3\node_modules\rollup\dist\native.js:83
[1]             throw new Error(
[1]                   ^
[1]
[1] Error: Cannot find module @rollup/rollup-win32-x64-msvc. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing both package-lock.json and node_modules directory.
[1]     at requireWithFriendlyError (F:\test\쇼츠대본생성기-v3.5.3\node_modules\rollup\dist\native.js:83:9)
[1]     at Object.<anonymous> (F:\test\쇼츠대본생성기-v3.5.3\node_modules\rollup\dist\native.js:92:76)
[1]     at Module._compile (node:internal/modules/cjs/loader:1804:14)
[1]     at Object..js (node:internal/modules/cjs/loader:1936:10)
[1]     at Module.load (node:internal/modules/cjs/loader:1525:32)
[1]     at Module._load (node:internal/modules/cjs/loader:1327:12)
[1]     at TracingChannel.traceSync (node:diagnostics_channel:328:14)
[1]     at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
[1]     at loadCJSModuleWithModuleLoad (node:internal/modules/esm/translators:339:3)
[1]     at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:242:7) {
[1]   [cause]: Error: Cannot find module '@rollup/rollup-win32-x64-msvc'
[1]   Require stack:
[1]   - F:\test\쇼츠대본생성기-v3.5.3\node_modules\rollup\dist\native.js
[1]       at Module._resolveFilename (node:internal/modules/cjs/loader:1448:15)
[1]       at defaultResolveImpl (node:internal/modules/cjs/loader:1059:19)
[1]       at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1064:22)
[1]       at Module._load (node:internal/modules/cjs/loader:1234:25)
[1]       at TracingChannel.traceSync (node:diagnostics_channel:328:14)
[1]       at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
[1]       at Module.require (node:internal/modules/cjs/loader:1548:12)
[1]       at require (node:internal/modules/helpers:152:16)
[1]       at requireWithFriendlyError (F:\test\쇼츠대본생성기-v3.5.3\node_modules\rollup\dist\native.js:65:10)
[1]       at Object.<anonymous> (F:\test\쇼츠대본생성기-v3.5.3\node_modules\rollup\dist\native.js:92:76) {
[1]     code: 'MODULE_NOT_FOUND',
[1]     requireStack: [
[1]       'F:\\test\\쇼츠대본생성기-v3.5.3\\node_modules\\rollup\\dist\\native.js'
[1]     ]
[1]   }
[1] }
[1]
[1] Node.js v24.13.1
[1] vite exited with code 1
[0] F:\test\쇼츠대본생성기-v3.5.3\node_modules\sharp\lib\sharp.js:120
[0]   throw new Error(help.join('\n'));
[0]         ^
[0]
[0] Error: Could not load the "sharp" module using the win32-x64 runtime
[0] Possible solutions:
[0] - Ensure optional dependencies can be installed:
[0]     npm install --include=optional sharp
[0] - Ensure your package manager supports multi-platform installation:
[0]     See https://sharp.pixelplumbing.com/install#cross-platform
[0] - Add platform-specific dependencies:
[0]     npm install --os=win32 --cpu=x64 sharp
[0] - Consult the installation documentation:
[0]     See https://sharp.pixelplumbing.com/install
[0]     at Object.<anonymous> (F:\test\쇼츠대본생성기-v3.5.3\node_modules\sharp\lib\sharp.js:120:9)
[0]     at Module._compile (node:internal/modules/cjs/loader:1804:14)
[0]     at Object..js (node:internal/modules/cjs/loader:1936:10)
[0]     at Module.load (node:internal/modules/cjs/loader:1525:32)
[0]     at Module._load (node:internal/modules/cjs/loader:1327:12)
[0]     at TracingChannel.traceSync (node:diagnostics_channel:328:14)
[0]     at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
[0]     at Module.require (node:internal/modules/cjs/loader:1548:12)
[0]     at require (node:internal/modules/helpers:152:16)
[0]     at Object.<anonymous> (F:\test\쇼츠대본생성기-v3.5.3\node_modules\sharp\lib\constructor.js:10:1)
[0]
[0] Node.js v24.13.1
[0] npm run server exited with code 1
PS F:\test\쇼츠대본생성기-v3.5.3>