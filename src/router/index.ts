import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
} from "vue-router";

// Use hash history for Capacitor native (no server to handle HTML5 fallbacks)
const isNative =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).Capacitor !== undefined;

const router = createRouter({
  history: isNative ? createWebHashHistory() : createWebHistory(),
  routes: [
    {
      path: "/",
      name: "onboarding",
      component: () => import("../views/OnboardingView.vue"),
    },
    {
      path: "/guidance/:intent",
      name: "guidance",
      component: () => import("../views/IntentGuidanceView.vue"),
    },
    {
      path: "/playback/:preset",
      name: "playback",
      component: () => import("../views/PlaybackView.vue"),
    },
    {
      path: "/synth",
      name: "synth",
      component: () => import("../views/SynthView.vue"),
    },
    {
      path: "/about",
      name: "about",
      component: () => import("../views/AboutView.vue"),
    },
    {
      // Dev benchmark harness: unlinked from the app UI
      path: "/bench",
      name: "bench",
      component: () => import("../views/BenchView.vue"),
    },
  ],
});

export default router;
