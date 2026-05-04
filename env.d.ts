/// <reference types="vite/client" />

declare module "@fontsource-variable/figtree";

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
