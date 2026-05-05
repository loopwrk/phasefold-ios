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
      path: "/synthesizer",
      name: "synthesizer",
      component: () => import("../views/SynthesizerView.vue"),
    },
  ],
});

export default router;
