import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
    main: {
        entry: 'src/main/index.js',
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                '@': resolve('src')
            }
        }
    },
    renderer: {
        root: 'src/renderer',
        publicDir: resolve('public'),
        build: {
            outDir: resolve('out/renderer'),
            emptyOutDir: true,
            rollupOptions: {
                input: resolve('src/renderer/index.html')
            }
        },
        resolve: {
            alias: {
                // Resolve Electron/@electron/remote ESM imports to runtime shims so bare
                // specifiers don't leak into the browser ESM loader (see src/renderer/shims).
                electron: resolve('src/renderer/shims/electron.js'),
                '@electron/remote': resolve('src/renderer/shims/electron-remote.js'),
                // Native addon used at runtime by the renderer (hotkey capture); load the real
                // module via window.require instead of letting Vite bundle/stub it.
                'uiohook-napi': resolve('src/renderer/shims/uiohook-napi.js'),
                '@': resolve('src')
            },
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
        },
        plugins: [
            vue({
                template: {
                    compilerOptions: {
                        // <webview> is an Electron built-in tag, not a Vue component.
                        isCustomElement: tag => tag === 'webview'
                    }
                }
            })
        ],
        optimizeDeps: {
            // html-docx-js (a CJS dep using `with{}`) is required at the top of the main-only
            // AIManager, which the renderer pulls in transitively for constants but never calls.
            // Exclude it so esbuild doesn't fail pre-bundling it under ESM strict mode.
            exclude: ['html-docx-js']
        },
        css: {
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true
                }
            }
        }
    }
})
