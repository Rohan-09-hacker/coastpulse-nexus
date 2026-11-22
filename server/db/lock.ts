import fs from 'node:fs';
import path from 'node:path';

export class DirectoryLock {
  public directoryPath: string;
  private lockFilePath: string;
  private isHeldByMe: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(directoryPath: string) {
    this.directoryPath = directoryPath;
    this.lockFilePath = path.join(directoryPath, '.coastpulse_engine.lock');
  }

  /**
   * Tries to acquire exclusive directory lock.
   * If an active lock is held by a live process, throws an error and refuses to corrupt the database.
   */
  acquire(): void {
    if (!fs.existsSync(this.directoryPath)) {
      fs.mkdirSync(this.directoryPath, { recursive: true });
    }

    if (fs.existsSync(this.lockFilePath)) {
      try {
        const content = fs.readFileSync(this.lockFilePath, 'utf8');
        const data = JSON.parse(content);
        const ownerPid = data.pid;
        const timestamp = data.timestamp;

        // Check if the holding process is actively alive
        let processAlive = false;
        if (typeof ownerPid === 'number' && ownerPid > 0 && ownerPid !== process.pid) {
          try {
            process.kill(ownerPid, 0); // throws if process is dead
            processAlive = true;
          } catch {
            processAlive = false;
          }
        }

        if (processAlive) {
          throw new Error(
            `Database directory "${this.directoryPath}" is locked by active PID ${ownerPid} (started at ${new Date(
              timestamp
            ).toISOString()}). Concurrent access is forbidden to prevent database corruption.`
          );
        }

        // Previous process crashed or terminated without cleaning up
        fs.unlinkSync(this.lockFilePath);
      } catch (err: any) {
        if (err.message.includes('locked by active PID')) {
          throw err;
        }
        // Stale or corrupted lock payload - unlink
        try { fs.unlinkSync(this.lockFilePath); } catch {}
      }
    }

    // Write lockfile exclusively (wx flag fails if file was created concurrently)
    const lockPayload = JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
      hostname: process.env.HOSTNAME || 'localhost',
    });

    try {
      fs.writeFileSync(this.lockFilePath, lockPayload, { flag: 'wx' });
      this.isHeldByMe = true;
    } catch {
      throw new Error(`Concurrent access collision: Failed to acquire lock on "${this.directoryPath}".`);
    }

    // Keep heartbeat to renew timestamp
    this.heartbeatInterval = setInterval(() => {
      if (this.isHeldByMe && fs.existsSync(this.lockFilePath)) {
        try {
          fs.writeFileSync(
            this.lockFilePath,
            JSON.stringify({
              pid: process.pid,
              timestamp: Date.now(),
              hostname: process.env.HOSTNAME || 'localhost',
            })
          );
        } catch {}
      }
    }, 5000);
    this.heartbeatInterval.unref();
  }

  release(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.isHeldByMe) {
      try {
        if (fs.existsSync(this.lockFilePath)) {
          const content = fs.readFileSync(this.lockFilePath, 'utf8');
          const data = JSON.parse(content);
          if (data.pid === process.pid) {
            fs.unlinkSync(this.lockFilePath);
          }
        }
      } catch {}
      this.isHeldByMe = false;
    }
  }
}
