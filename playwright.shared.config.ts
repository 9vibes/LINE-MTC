import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests-shared',use:{baseURL:'http://127.0.0.1:3077',headless:true},webServer:{command:'node scripts/shared-test-server.mjs',url:'http://127.0.0.1:3077/api/health',reuseExistingServer:false},reporter:'list'});
