// PM2 进程守护配置
//
// 用法（在 /opt/ecolink 下）：
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup        # 按提示执行输出的那条命令，实现开机自启
//
// P2 加了登录后，再在这里补 JWT_SECRET 等环境变量（不要写进 git）。

module.exports = {
  apps: [
    {
      name: "ecolink",
      script: "/opt/ecolink/server.cjs",
      cwd: "/opt/ecolink",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      out_file: "/opt/ecolink/logs/out.log",
      error_file: "/opt/ecolink/logs/error.log",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        ECOLINK_DATA_DIR: "/opt/ecolink/data",
        ECOLINK_STATIC_DIR: "/opt/ecolink/dist",
        // 开启账号密码登录（云端必开）。本地开发 / Electron 不设置此项。
        ECOLINK_AUTH: "1",
      },
    },
  ],
};
