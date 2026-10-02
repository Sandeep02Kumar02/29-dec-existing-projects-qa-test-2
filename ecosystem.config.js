module.exports = {
  apps: [
    {
      name: 'hello_world',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '300M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
      },
    },
  ],
};
