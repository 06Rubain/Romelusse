import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// En-têtes de sécurité du site : définis une seule fois dans vercel.json, repris pour `npm run preview`
const securityHeaders: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(resolve(__dirname, 'vercel.json'), 'utf8')).headers[0].headers as { key: string; value: string }[])
    .map((h) => [h.key, h.value]),
)

// Mode hors ligne : liste de tous les fichiers de l'application (pages chargées à la demande comprises)
// pour le service worker, et numéro de version propre à chaque déploiement (mise à jour détectée à coup sûr)
const offlineBuild = (): Plugin => {
  const build = Date.now().toString(36)
  let outDir = 'dist'
  return {
    name: 'omnicom-offline-build',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    generateBundle(_options, bundle) {
      // L'outil d'import PDF (plus d'1 Mo) ne sert qu'en ligne : il n'est pas gardé d'avance
      const files = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f) && !/pdf/i.test(f)).map((f) => `/${f}`)
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
    },
    closeBundle() {
      const sw = resolve(outDir, 'sw.js')
      writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD__', build))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineBuild()],
  // `npm run preview` : la version de production locale parle à l'API locale, comme sur Vercel (même origine)
  // Mêmes en-têtes de sécurité que sur Vercel (vercel.json), pour les vérifier en local
  preview: { proxy: { '/api': 'http://localhost:5000' }, headers: securityHeaders },
})
