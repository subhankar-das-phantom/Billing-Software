import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function dynamicSeoPlugin(env) {
  return {
    name: 'dynamic-seo',
    writeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      const domain = env.VITE_FRONTEND_URL || 'http://localhost:3000'
      
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${domain}/landing</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${domain}/login</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${domain}/register</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${domain}/privacy-policy</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${domain}/terms</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>`

      const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${domain}/sitemap.xml`

      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap)
      fs.writeFileSync(path.join(outDir, 'robots.txt'), robots)
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), dynamicSeoPlugin(env)],
    resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
  }
})
