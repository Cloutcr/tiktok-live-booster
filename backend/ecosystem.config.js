module.exports = {
  apps: [
    {
      name: "tiktok-booster-api",
      script: "server.js",
      cwd: "/opt/tiktok-live-booster/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        BACKEND_PORT: 3005,
        PYTHON_PATH: "python3"
      }
    }
  ]
};
