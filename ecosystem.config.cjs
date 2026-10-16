// PM2 on the VPS (user `deploy`), next to Vibely. Releases live in /var/www/firtech/releases/<id>;
// `current` points to the live one (scripts/deploy/activate.sh). Nginx proxies firtech.pro to
// 127.0.0.1:3001.
//
// One process in fork mode on purpose: the lead store (src/lib/store.ts) serializes writes inside
// the process, and the in-memory rate limit counts per process.
module.exports = {
  apps: [
    {
      name: 'firtech',
      cwd: '/var/www/firtech/current',
      script: '/var/www/firtech/current/server.js',
      exec_mode: 'fork',
      instances: 1,
      // Runtime secrets stay on the server, outside any release directory.
      node_args: '--env-file=/var/www/firtech/shared/.env.production --max-old-space-size=384',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOSTNAME: '127.0.0.1',
        // Leads must survive deploys: keep them next to the env file, not in a release.
        DATA_DIR: '/var/www/firtech/shared/data',
      },
      max_memory_restart: '600M',
      kill_timeout: 10000,
      time: true,
    },
  ],
}
