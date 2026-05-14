module.exports = {
  apps: [
    {
      name: "webjualan-backend",
      cwd: "./server",
      script: "index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DB_HOST: "localhost",
        DB_PORT: 3306,
        DB_USER: "webjualan",
        DB_PASSWORD: "JonatanGirsang",
        DB_NAME: "webjualan",
        ADMIN_KEY: "kasir123",
      },
    },
  ],
};