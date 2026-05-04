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
      path: "/onboarding",
      name: "onboarding",
      component: () => import("../views/OnboardingView.vue"),
    },
    {
      path: "/guidance/:intent",
      name: "guidance",
      component: () => import("../views/IntentGuidanceView.vue"),
    },
    {
      path: "/",
      name: "synthesizer",
      component: () => import("../views/SynthesizerView.vue"),
    },
  ],
});

export default router;
