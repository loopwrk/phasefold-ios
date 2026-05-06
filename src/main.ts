import { createApp } from "vue";
import "./assets/colors.css";
import "./assets/typography.css";
import App from "./App.vue";
import router from "./router";
import "@fontsource-variable/figtree";

createApp(App).use(router).mount("#app");
