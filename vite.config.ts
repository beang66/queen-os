import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * 이 프로젝트의 정식 실행 방법은 `npm run dev` 입니다.
 * server.ts 가 Express(API) + Vite(미들웨어 모드)를 함께 :3000 으로 띄웁니다.
 *
 * 아래 설정은 누군가 `vite` 를 단독 실행(:5173)했을 때를 위한 안전장치입니다.
 * /api 요청을 :3000 의 API 서버로 프록시하므로, API 서버만 함께 켜져 있으면 정상 동작합니다.
 */
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // server.ts 의 미들웨어 모드에서는 이 프록시가 자기 자신(:3000)을 가리키게 되므로 비활성화한다.
      // `vite` 를 단독 실행(:5173)했을 때만 :3000 API 서버로 프록시한다.
      proxy:
        process.env.QUEEN_MIDDLEWARE_MODE === 'true'
          ? undefined
          : {
              '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
              },
            },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
