import { defineConfig } from 'vite';
export default defineConfig({clearScreen:false,define:{__VUE_OPTIONS_API__:true,__VUE_PROD_DEVTOOLS__:false,__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:false},server:{port:1420,strictPort:true},build:{target:'es2022',reportCompressedSize:false}});
