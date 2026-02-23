module.exports = {
  apps: [
    {
      name: "ulip-gateway-service",
      script: "dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

