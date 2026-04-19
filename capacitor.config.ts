import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.phasefold.app",
  appName: "Phasefold",
  webDir: "dist",
  server: {
    // local IP so the app loads from Vite's dev server (enables hot-reload on-device).
    // url: 'http://192.168.1.XXX:5173',
  },
  ios: {
    preferredContentMode: "mobile",
  },
};

export default config;
