import { createApp } from "vue";
import "./assets/colors.css";
import "./assets/typography.css";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import "@fontsource-variable/figtree";

createApp(App).use(router).use(i18n).mount("#app");
