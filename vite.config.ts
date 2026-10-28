import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { ffmpegExportPlugin } from './server/ffmpegPlugin';
import { mcpBridgePlugin } from './server/mcpBridgePlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), ffmpegExportPlugin(), mcpBridgePlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
