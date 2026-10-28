import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// PRD D28: Vite + React + PWA. 서버 렌더링 없는 정적 배포.
// @core → packages/core/src: 신호 문구 표(9-9)를 복사하지 않고 같은 파일을 쓴다(스킬 서버와 동일).
const coreSrc = fileURLToPath(new URL('../packages/core/src', import.meta.url))

export default defineConfig({
  resolve: { alias: { '@core': coreSrc } },
  server: {
    fs: { allow: ['..'] },
    // 개발: /api(1회용 결과 조회)는 로컬 스킬 서버로. 운영에서는 Nginx가 같은 경로를 넘긴다.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        importScripts: ['/push-worker.js'],
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
        // 임시 SVG 아이콘. 아이폰 홈 화면용 PNG(192/512)는 화면 확정 뒤 추가(D31)
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        // F4-2: 안드로이드 문자 앱 공유 버튼으로 텍스트를 받는다(GET).
        // 아이폰은 Web Share Target 미지원이므로 안드로이드 전용.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { text: 'text', title: 'title', url: 'url' },
        },
      },
    }),
  ],
  build: { outDir: 'dist', sourcemap: false },
})
