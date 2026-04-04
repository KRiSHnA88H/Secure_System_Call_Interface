const express = require('express');
const { exec } = require('child_process');
const { protect } = require('../middleware/auth');
const SyscallLog = require('../models/SyscallLog');

const router = express.Router();

// Allowed system calls and their types
const SYSCALL_WHITELIST = {
  // File System
  ls: 'filesystem',
  'ls -la': 'filesystem',
  'ls -l': 'filesystem',
  'ls -a': 'filesystem',
  pwd: 'filesystem',
  cat: 'filesystem',
  'find /tmp': 'filesystem',
  'find /var/log': 'filesystem',
  df: 'disk',
  'df -h': 'disk',
  du: 'disk',

  // System Info
  uname: 'system',
  'uname -a': 'system',
  'uname -r': 'system',
  hostname: 'system',
  date: 'system',
  uptime: 'system',
  whoami: 'system',
  id: 'system',
  env: 'system',

  // Process Management
  ps: 'process',
  'ps aux': 'process',
  'ps -ef': 'process',
  top: 'process',

  // Network
  ifconfig: 'network',
  'ip addr': 'network',
  'ip route': 'network',
  netstat: 'network',
  'netstat -tuln': 'network',
  'ss -tuln': 'network',
  ping: 'network',

  // Memory
  free: 'memory',
  'free -h': 'memory',
  vmstat: 'memory',

  // CPU
  lscpu: 'cpu',
  nproc: 'cpu',

  // Logs & Monitoring
  'cat /proc/cpuinfo': 'system',
  'cat /proc/meminfo': 'system',
  'cat /proc/version': 'system',
  'cat /proc/uptime': 'system',
  'cat /etc/os-release': 'system',
  'cat /etc/hostname': 'system',
  lsblk: 'disk',
  mount: 'filesystem',
  'journalctl -n 20': 'logs',
  dmesg: 'logs',
  w: 'system',
  who: 'system',
  last: 'system',
};

// Blocked patterns (security)
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /sudo/i,
  /chmod\s+777/i,
  /passwd/i,
  /shutdown/i,
  /reboot/i,
  /halt/i,
  /init\s+0/i,
  /mkfs/i,
  /fdisk/i,
  /dd\s+if/i,
  />\s*\/dev\//i,
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
  /nc\s+-e/i,
  /bash\s+-i/i,
  /\/etc\/shadow/i,
  /\/etc\/passwd/i,
  /crontab/i,
  /at\s+now/i,
];

const isCommandAllowed = (command) => {
  const trimmed = command.trim().toLowerCase();

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return { allowed: false, reason: 'Command contains blocked pattern' };
  }

  // Check whitelist (exact or starts with)
  for (const allowed of Object.keys(SYSCALL_WHITELIST)) {
    if (trimmed === allowed || trimmed.startsWith(allowed + ' ')) {
      return { allowed: true, type: SYSCALL_WHITELIST[allowed] };
    }
  }

  return { allowed: false, reason: 'Command not in allowed syscall list' };
};

// Execute system call
router.post('/execute', protect, async (req, res) => {
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ success: false, message: 'Command is required.' });
  }

  const check = isCommandAllowed(command);

  // Log blocked command
  if (!check.allowed) {
    await SyscallLog.create({
      user: req.user._id,
      username: req.user.username,
      command,
      syscallType: 'blocked',
      output: '',
      error: check.reason,
      exitCode: -1,
      status: 'blocked',
      executionTime: 0,
    });

    return res.status(403).json({
      success: false,
      message: `Command blocked: ${check.reason}`,
      status: 'blocked',
    });
  }

  const startTime = Date.now();

  exec(command, { timeout: 10000, maxBuffer: 1024 * 512 }, async (error, stdout, stderr) => {
    const executionTime = Date.now() - startTime;
    const exitCode = error ? error.code || 1 : 0;
    const status = error ? 'error' : 'success';

    // Save log
    await SyscallLog.create({
      user: req.user._id,
      username: req.user.username,
      command,
      syscallType: check.type,
      output: stdout || '',
      error: stderr || (error ? error.message : ''),
      exitCode,
      status,
      executionTime,
    });

    res.status(200).json({
      success: true,
      command,
      output: stdout || '',
      error: stderr || '',
      exitCode,
      status,
      executionTime,
      syscallType: check.type,
    });
  });
});

// Get logs
router.get('/logs', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = req.user.role === 'admin' ? {} : { user: req.user._id };

    const [logs, total] = await Promise.all([
      SyscallLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
      SyscallLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs.' });
  }
});

// Get stats
router.get('/stats', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { user: req.user._id };

    const [total, success, errors, blocked] = await Promise.all([
      SyscallLog.countDocuments(query),
      SyscallLog.countDocuments({ ...query, status: 'success' }),
      SyscallLog.countDocuments({ ...query, status: 'error' }),
      SyscallLog.countDocuments({ ...query, status: 'blocked' }),
    ]);

    const typeStats = await SyscallLog.aggregate([
      { $match: query },
      { $group: { _id: '$syscallType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: { total, success, errors, blocked, typeStats },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// Get allowed commands list
router.get('/allowed-commands', protect, (req, res) => {
  const commands = Object.entries(SYSCALL_WHITELIST).map(([cmd, type]) => ({ command: cmd, type }));
  res.status(200).json({ success: true, commands });
});

module.exports = router;
