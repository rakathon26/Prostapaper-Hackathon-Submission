import react from "@vitejs/plugin-react";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), Icons({ compiler: "jsx", jsx: "react" })],
  server: { host: "127.0.0.1", port: 5192, strictPort: true },
});
