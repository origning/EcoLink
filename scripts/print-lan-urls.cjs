const os = require("node:os");

try {
  const urls = [];
  for (const addrs of Object.values(os.networkInterfaces() || {})) {
    for (const addr of addrs || []) {
      const ipv4 = addr.family === "IPv4" || addr.family === 4;
      if (ipv4 && !addr.internal) {
        urls.push(`http://${addr.address}:5173`);
      }
    }
  }

  if (urls.length === 0) {
    console.log("  （未检测到局域网地址，请确认电脑已连接 Wi-Fi）");
  } else {
    for (const url of urls) console.log(`  ${url}`);
  }
} catch {
  console.log("  （无法读取网卡地址。电脑浏览器用 http://localhost:5173）");
}
