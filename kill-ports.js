const { execSync } = require('child_process');

const PORTS = [4001, 4002];

console.log('Cleaning up ports...');

PORTS.forEach(port => {
  try {
    // netstatでポートを使用しているプロセスを検索
    const netstatOutput = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });

    // 出力をパースしてPIDを抽出
    const lines = netstatOutput.split('\n');
    const pids = new Set();

    lines.forEach(line => {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match) {
        pids.add(match[1]);
      }
    });

    // 各PIDをkill
    pids.forEach(pid => {
      try {
        console.log(`Killing PID ${pid} using port ${port}...`);
        execSync(`taskkill /PID ${pid} /F /T`, { encoding: 'utf8' });
      } catch (err) {
        // プロセスが既に終了している場合など
        console.log(`  Could not kill PID ${pid} (may already be terminated)`);
      }
    });

    if (pids.size === 0) {
      console.log(`Port ${port} is free`);
    }
  } catch (err) {
    // netstatで何も見つからなかった場合
    console.log(`Port ${port} is free`);
  }
});

console.log('Port cleanup complete!');
