import { defineConfig } from 'vite';
export default defineConfig(({mode})=>({base:'./',define:{__LINE_MTC_SERVER__:JSON.stringify(mode==='companion'?(process.env.LINE_MTC_COMPANION_ORIGIN||'https://mtc.kunas.pro'):'')},build:{target:'es2022'},server:{port:5173,strictPort:true}}));
