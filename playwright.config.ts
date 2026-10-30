import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/ui',
  use:{baseURL:'http://127.0.0.1:1420'},
  projects:[
    {name:'chromium',use:{browserName:'chromium',...(process.platform==='win32'?{channel:'msedge'}:{})}},
    {name:'webkit',use:{browserName:'webkit'}},
  ],
  webServer:{command:'npm run dev',url:'http://127.0.0.1:1420',reuseExistingServer:!process.env.CI},
  workers:1,
});
