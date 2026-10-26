import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PRD D28: Vite + React + PWA. 서버 렌더링 없는 정적 배포.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
      },
      manifest: {
        name: '가족방패',
        short_name: '가족방패',
        description: '의심 문자를 AI로 분석하고 가족에게 알립니다',
        theme_color: '#1a56db',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'ko',
        // 임시 SVG 아이콘. 아이폰 홈 화면용 PNG(192/512)는 Figma 시안 뒤에 추가
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  build: { outDir: 'dist', sourcemap: false },
})
