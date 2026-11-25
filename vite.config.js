import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Base path '/' – CraveCart deploys to Vercel with SPA fallback.
   The app has no server-side API: every feature (discovery, pantry
   matching, favourites, collections, ratings) runs on the static build
   plus TheMealDB, so no environment variable is required to use it. */
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist'
  }
});
