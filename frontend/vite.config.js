import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function dynamicSeoPlugin(env) {
  const getDomain = () => {
    return (
      env.VITE_FRONTEND_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://billing-software-sigma.vercel.app')
    ).replace(/\/+$/, '')
  }

  return {
    name: 'dynamic-seo',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/llms.txt' || req.url === '/llms-full.txt') {
          const filePath = path.resolve(__dirname, 'public', req.url.slice(1))
          if (fs.existsSync(filePath)) {
            const domain = env.VITE_FRONTEND_URL || 'http://localhost:3000'
            const content = fs.readFileSync(filePath, 'utf8').replace(/%DOMAIN%/g, domain)
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(content)
            return
          }
        }
        next()
      })
    },
    writeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      const domain = getDomain()
      
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

      // Replace %DOMAIN% placeholder in copied llms.txt and llms-full.txt
      const llmsFiles = ['llms.txt', 'llms-full.txt']
      for (const file of llmsFiles) {
        const filePath = path.join(outDir, file)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')
          fs.writeFileSync(filePath, content.replace(/%DOMAIN%/g, domain))
        }
      }
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
