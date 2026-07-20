// pm2 process file. Start with:  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "ranvo-signaling",
      script: "index.js",
      cwd: __dirname,
      instances: 1, // Socket.IO needs sticky sessions for >1 instance — keep at 1 unless you set that up.
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        // Set this to your site's origin(s) in production:
        CORS_ORIGIN: "https://chat.example.com",
      },
      max_memory_restart: "512M",
      restart_delay: 2000,
    },
  ],
};
