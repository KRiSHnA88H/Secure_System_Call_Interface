const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { protect } = require('../middleware/auth');
const SyscallLog = require('../models/SyscallLog');

const router = express.Router();

// Temp directory for compiled C demos
const SYSCALL_TMP = path.join(os.tmpdir(), 'secure_syscall_demos');
if (!fs.existsSync(SYSCALL_TMP)) fs.mkdirSync(SYSCALL_TMP, { recursive: true });

// ─── Core Linux Syscall C Demos ───────────────────────────────────
const CORE_SYSCALLS = {

  'syscall:read': {
    type: 'core-io',
    description: 'read() — reads bytes from a file descriptor into a buffer',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <errno.h>
int main() {
    const char *tmpfile = "/tmp/syscall_read_demo.txt";
    const char *content = "Hello from SecureSysCall!\\nread() syscall demo.\\n";
    int fd = open(tmpfile, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) { perror("open"); return 1; }
    ssize_t written = write(fd, content, strlen(content));
    close(fd);
    printf("[write()] Wrote %zd bytes to '%s'\\n", written, tmpfile);
    fd = open(tmpfile, O_RDONLY);
    if (fd < 0) { perror("open read"); return 1; }
    printf("[read() ] Reading from fd=%d:\\n", fd);
    printf("---------------------------------\\n");
    char buf[256];
    ssize_t n;
    while ((n = read(fd, buf, sizeof(buf) - 1)) > 0) {
        buf[n] = '\\0';
        printf("%s", buf);
    }
    close(fd);
    printf("---------------------------------\\n");
    printf("[close()] File descriptor closed.\\n");
    printf("[getpid()] This process PID = %d\\n", (int)getpid());
    unlink(tmpfile);
    printf("[unlink()] Temp file removed.\\n");
    return 0;
}`
  },

  'syscall:write': {
    type: 'core-io',
    description: 'write() — writes bytes from a buffer to a file descriptor',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
int main() {
    const char *hdr = "=== write() Syscall Demo ===\\n";
    write(STDOUT_FILENO, hdr, strlen(hdr));
    const char *tmpfile = "/tmp/syscall_write_demo.txt";
    int fd = open(tmpfile, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) { perror("open"); return 1; }
    const char *lines[] = {
        "Line 1: write() demo\\n",
        "Line 2: each write() is one syscall\\n",
        "Line 3: fd=1=stdout, fd=2=stderr\\n",
    };
    ssize_t total = 0;
    for (int i = 0; i < 3; i++) {
        ssize_t n = write(fd, lines[i], strlen(lines[i]));
        printf("[write() call %d] wrote %zd bytes\\n", i + 1, n);
        total += n;
    }
    close(fd);
    printf("\\n[summary] File: %s  |  Total bytes: %zd\\n", tmpfile, total);
    printf("[PID   ] This process PID=%d  PPID=%d\\n", (int)getpid(), (int)getppid());
    const char *note = "[write to stderr] fd=2 is standard error\\n";
    write(STDERR_FILENO, note, strlen(note));
    unlink(tmpfile);
    return 0;
}`
  },

  'syscall:fork': {
    type: 'core-process',
    description: 'fork() — creates a new child process as a copy of the parent',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <stdlib.h>
int main() {
    printf("=== fork() Syscall Demo ===\\n");
    printf("[parent] PID=%d  PPID=%d\\n", (int)getpid(), (int)getppid());
    printf("[parent] Calling fork()...\\n\\n");
    pid_t pid = fork();
    if (pid < 0) { perror("fork() failed"); return 1; }
    if (pid == 0) {
        printf("[child ] fork() returned 0 -- I am the child!\\n");
        printf("[child ] My PID  = %d\\n", (int)getpid());
        printf("[child ] My PPID = %d  (parent PID)\\n", (int)getppid());
        printf("[child ] Doing work for 1 second...\\n");
        sleep(1);
        printf("[child ] Done. Exiting with code 42.\\n");
        exit(42);
    } else {
        printf("[parent] fork() returned %d -- that is child PID\\n", (int)pid);
        printf("[parent] Calling wait() to reap child...\\n");
        int status;
        pid_t w = wait(&status);
        printf("\\n[parent] wait() returned, child PID=%d\\n", (int)w);
        if (WIFEXITED(status))
            printf("[parent] Child exit code = %d\\n", WEXITSTATUS(status));
        printf("[parent] My PID=%d -- still alive after child exit!\\n", (int)getpid());
    }
    return 0;
}`
  },

  'syscall:exec': {
    type: 'core-process',
    description: 'exec() — replaces the current process image with a new program',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <stdlib.h>
int main() {
    printf("=== exec() Syscall Demo ===\\n");
    printf("[parent] PID=%d  Forking a child to exec uname...\\n\\n", (int)getpid());
    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {
        printf("[child ] PID=%d before exec()\\n", (int)getpid());
        printf("[child ] Calling execl('/bin/uname','uname','-a')...\\n");
        printf("[child ] Code below this line is REPLACED by uname:\\n");
        printf("--------------------------------------------------\\n");
        execl("/bin/uname", "uname", "-a", (char *)NULL);
        perror("execl failed");
        exit(1);
    } else {
        int status;
        wait(&status);
        printf("--------------------------------------------------\\n");
        printf("\\n[parent] exec'd child (uname) finished.\\n");
        printf("[parent] exec() replaces process image but PID stays same!\\n");
        printf("[parent] Parent PID=%d is unaffected.\\n", (int)getpid());
    }
    return 0;
}`
  },

  'syscall:open': {
    type: 'core-io',
    description: 'open() / close() — obtain and release file descriptors',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <sys/stat.h>
int main() {
    printf("=== open() / close() Syscall Demo ===\\n\\n");
    const char *path = "/tmp/syscall_open_demo.txt";
    int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, S_IRUSR|S_IWUSR|S_IRGRP|S_IROTH);
    printf("[open() ] path='%s'  flags=O_WRONLY|O_CREAT|O_TRUNC\\n", path);
    if (fd < 0) { perror("open"); return 1; }
    printf("[open() ] Success! file descriptor = %d\\n", fd);
    const char *msg = "SecureSysCall open() demo\\n";
    write(fd, msg, strlen(msg));
    printf("[write()] Wrote %zu bytes to fd=%d\\n", strlen(msg), fd);
    close(fd);
    printf("[close()] fd=%d closed.\\n\\n", fd);
    fd = open(path, O_RDONLY);
    printf("[open() ] Re-opened for reading, new fd = %d\\n", fd);
    char buf[128] = {0};
    read(fd, buf, sizeof(buf) - 1);
    printf("[read() ] Content: %s", buf);
    close(fd);
    printf("[close()] fd=%d closed.\\n\\n", fd);
    printf("[info   ] Standard file descriptors:\\n");
    printf("           fd 0 = stdin (STDIN_FILENO)\\n");
    printf("           fd 1 = stdout (STDOUT_FILENO)\\n");
    printf("           fd 2 = stderr (STDERR_FILENO)\\n");
    printf("           fd 3+ = user-opened files\\n\\n");
    struct stat st;
    stat(path, &st);
    printf("[stat() ] File size=%lld bytes  inode=%llu\\n",
           (long long)st.st_size, (unsigned long long)st.st_ino);
    unlink(path);
    printf("[unlink()] File removed.\\n");
    return 0;
}`
  },

  'syscall:pipe': {
    type: 'core-ipc',
    description: 'pipe() — creates a unidirectional IPC channel between processes',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <string.h>
#include <stdlib.h>
int main() {
    printf("=== pipe() Syscall Demo ===\\n");
    printf("[info  ] pipe() creates two fds: [0]=read end, [1]=write end\\n\\n");
    int pipefd[2];
    if (pipe(pipefd) == -1) { perror("pipe"); return 1; }
    printf("[pipe()] Created! read_fd=%d  write_fd=%d\\n\\n", pipefd[0], pipefd[1]);
    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {
        close(pipefd[0]);
        const char *messages[] = {
            "Message 1: Hello from child!",
            "Message 2: pipe() enables IPC",
            "Message 3: one-way data channel",
        };
        for (int i = 0; i < 3; i++) {
            printf("[child ] Writing: '%s'\\n", messages[i]);
            write(pipefd[1], messages[i], strlen(messages[i]) + 1);
        }
        close(pipefd[1]);
        printf("[child ] Write end closed. Exiting.\\n");
        exit(0);
    } else {
        close(pipefd[1]);
        printf("[parent] Reading from pipe...\\n\\n");
        char buf[256];
        ssize_t n;
        int count = 0;
        while ((n = read(pipefd[0], buf, sizeof(buf))) > 0) {
            printf("[parent] Received: '%s'\\n", buf);
            count++;
        }
        close(pipefd[0]);
        int status;
        wait(&status);
        printf("\\n[parent] %d message(s) passed through the pipe.\\n", count);
        printf("[parent] Child exit code=%d\\n", WEXITSTATUS(status));
    }
    return 0;
}`
  },

  'syscall:wait': {
    type: 'core-process',
    description: 'wait() / waitpid() — parent waits for child process termination',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <stdlib.h>
int main() {
    printf("=== wait() / waitpid() Syscall Demo ===\\n\\n");
    pid_t pids[3];
    int exit_codes[3] = {0, 1, 42};
    for (int i = 0; i < 3; i++) {
        pids[i] = fork();
        if (pids[i] < 0) { perror("fork"); return 1; }
        if (pids[i] == 0) {
            printf("[child %d] PID=%d  will exit(%d)\\n", i+1, (int)getpid(), exit_codes[i]);
            sleep(i);
            exit(exit_codes[i]);
        } else {
            printf("[parent ] Spawned child %d  PID=%d\\n", i+1, (int)pids[i]);
        }
    }
    printf("\\n[parent ] Calling wait() in a loop...\\n\\n");
    int collected = 0;
    while (collected < 3) {
        int status;
        pid_t done = wait(&status);
        if (done < 0) break;
        printf("[wait() ] Child PID=%d finished\\n", (int)done);
        if (WIFEXITED(status))
            printf("          Exit code  : %d\\n", WEXITSTATUS(status));
        if (WIFSIGNALED(status))
            printf("          Killed by  : signal %d\\n", WTERMSIG(status));
        printf("\\n");
        collected++;
    }
    printf("[parent ] All %d children collected. No zombies left!\\n", collected);
    return 0;
}`
  },

  'syscall:getpid': {
    type: 'core-process',
    description: 'getpid() / getppid() — retrieve current and parent process IDs',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <stdlib.h>
int main() {
    printf("=== getpid() / getppid() Demo ===\\n\\n");
    printf("[parent] getpid()  = %d   (this process)\\n", (int)getpid());
    printf("[parent] getppid() = %d   (shell/node parent)\\n\\n", (int)getppid());
    printf("[parent] Forking to show PID inheritance...\\n\\n");
    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {
        printf("[child ] getpid()  = %d   (new unique PID)\\n", (int)getpid());
        printf("[child ] getppid() = %d   (matches parent getpid!)\\n", (int)getppid());
        exit(0);
    } else {
        int status; wait(&status);
        printf("[parent] getpid() still = %d -- unchanged.\\n\\n", (int)getpid());
        printf("[info  ] getuid()  = %d  (user ID)\\n",  (int)getuid());
        printf("[info  ] getgid()  = %d  (group ID)\\n", (int)getgid());
        printf("[info  ] geteuid() = %d  (effective UID)\\n", (int)geteuid());
    }
    return 0;
}`
  },

  'syscall:mmap': {
    type: 'core-memory',
    description: 'mmap() — maps files or anonymous memory into the process address space',
    code: `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/mman.h>
#include <fcntl.h>
int main() {
    printf("=== mmap() Syscall Demo ===\\n\\n");
    long page_size = sysconf(_SC_PAGESIZE);
    printf("[sysconf] Page size = %ld bytes\\n\\n", page_size);
    printf("[mmap() ] Creating anonymous mapping (PROT_READ|WRITE, MAP_PRIVATE|ANONYMOUS)...\\n");
    char *anon = mmap(NULL, page_size, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
    if (anon == MAP_FAILED) { perror("mmap"); return 1; }
    printf("[mmap() ] Mapped at address: %p\\n", (void *)anon);
    strcpy(anon, "Written directly to mmap'd memory via pointer!");
    printf("[read   ] Read back: '%s'\\n\\n", anon);
    munmap(anon, page_size);
    printf("[munmap()] Anonymous mapping released.\\n\\n");
    const char *tmpfile = "/tmp/syscall_mmap_demo.txt";
    int fd = open(tmpfile, O_RDWR|O_CREAT|O_TRUNC, 0644);
    const char *fcontent = "File content mapped via mmap!\\n";
    write(fd, fcontent, strlen(fcontent));
    char *fmap = mmap(NULL, strlen(fcontent), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0);
    close(fd);
    if (fmap == MAP_FAILED) { perror("mmap file"); return 1; }
    printf("[mmap() ] File-backed mapping at: %p\\n", (void *)fmap);
    printf("[read   ] Content via pointer: '%s'", fmap);
    fmap[0] = 'f';
    printf("[write  ] Modified byte 0 to 'f' via pointer -- written back to file!\\n");
    munmap(fmap, strlen(fcontent));
    printf("[munmap()] File mapping released.\\n");
    unlink(tmpfile);
    return 0;
}`
  },

  'syscall:signal': {
    type: 'core-signal',
    description: 'signal() / kill() — send and handle POSIX signals between processes',
    code: `
#include <stdio.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>
#include <stdlib.h>
static volatile int signal_count = 0;
void sigusr1_handler(int sig) {
    signal_count++;
    const char *msg = "[handler] SIGUSR1 caught!\\n";
    write(STDOUT_FILENO, msg, 27);
}
int main() {
    printf("=== signal() / kill() Syscall Demo ===\\n\\n");
    if (signal(SIGUSR1, sigusr1_handler) == SIG_ERR) { perror("signal"); return 1; }
    printf("[signal()] Registered SIGUSR1 handler (signal %d)\\n\\n", SIGUSR1);
    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {
        pid_t parent = getppid();
        printf("[child ] PID=%d  Sending SIGUSR1 to parent PID=%d\\n\\n", (int)getpid(), (int)parent);
        for (int i = 0; i < 3; i++) {
            printf("[child ] kill(%d, SIGUSR1) send #%d\\n", (int)parent, i+1);
            kill(parent, SIGUSR1);
            usleep(100000);
        }
        printf("[child ] Done sending.\\n");
        exit(0);
    } else {
        sleep(1);
        int status; wait(&status);
        printf("\\n[parent] Total SIGUSR1 received = %d\\n", signal_count);
        printf("[info  ] Common signals: SIGINT=2 SIGKILL=9 SIGTERM=15 SIGUSR1=%d\\n", SIGUSR1);
        printf("[info  ] SIGKILL and SIGSTOP cannot be caught or ignored.\\n");
    }
    return 0;
}`
  },

  'syscall:stat': {
    type: 'core-io',
    description: 'stat() — retrieve file metadata: inode, size, permissions, timestamps',
    code: `
#include <stdio.h>
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <time.h>
void print_perms(mode_t mode) {
    printf("[stat() ] Permissions: %c%c%c%c%c%c%c%c%c%c\\n",
        S_ISREG(mode)?'-':S_ISDIR(mode)?'d':'l',
        (mode&S_IRUSR)?'r':'-',(mode&S_IWUSR)?'w':'-',(mode&S_IXUSR)?'x':'-',
        (mode&S_IRGRP)?'r':'-',(mode&S_IWGRP)?'w':'-',(mode&S_IXGRP)?'x':'-',
        (mode&S_IROTH)?'r':'-',(mode&S_IWOTH)?'w':'-',(mode&S_IXOTH)?'x':'-');
}
int main() {
    printf("=== stat() Syscall Demo ===\\n\\n");
    const char *path = "/tmp/syscall_stat_demo.txt";
    int fd = open(path, O_WRONLY|O_CREAT|O_TRUNC, 0644);
    const char *data = "stat() demo content";
    write(fd, data, strlen(data));
    close(fd);
    struct stat st;
    if (stat(path, &st) < 0) { perror("stat"); return 1; }
    printf("[stat() ] File: %s\\n", path);
    printf("[stat() ] Inode       : %llu\\n", (unsigned long long)st.st_ino);
    printf("[stat() ] Size        : %lld bytes\\n", (long long)st.st_size);
    printf("[stat() ] Hard links  : %lu\\n", (unsigned long)st.st_nlink);
    printf("[stat() ] UID / GID   : %d / %d\\n", (int)st.st_uid, (int)st.st_gid);
    printf("[stat() ] Block size  : %ld bytes\\n", (long)st.st_blksize);
    printf("[stat() ] Blocks alloc: %lld\\n", (long long)st.st_blocks);
    print_perms(st.st_mode);
    char timebuf[64];
    struct tm *tm_info = localtime(&st.st_mtime);
    strftime(timebuf, sizeof(timebuf), "%Y-%m-%d %H:%M:%S", tm_info);
    printf("[stat() ] Modified    : %s\\n\\n", timebuf);
    fd = open(path, O_RDONLY);
    struct stat fst; fstat(fd, &fst); close(fd);
    printf("[fstat()] fstat() on fd gives same inode: %llu\\n",
           (unsigned long long)fst.st_ino);
    unlink(path);
    printf("[unlink()] File removed.\\n");
    return 0;
}`
  },
};

// ─── Shell command whitelist ──────────────────────────────────────
const SYSCALL_WHITELIST = {
  ls: 'filesystem', 'ls -la': 'filesystem', 'ls -l': 'filesystem',
  'ls -a': 'filesystem', pwd: 'filesystem', 'find /tmp': 'filesystem',
  'find /var/log': 'filesystem', df: 'disk', 'df -h': 'disk', du: 'disk',
  uname: 'system', 'uname -a': 'system', 'uname -r': 'system',
  hostname: 'system', date: 'system', uptime: 'system',
  whoami: 'system', id: 'system', env: 'system',
  w: 'system', who: 'system', last: 'system',
  ps: 'process', 'ps aux': 'process', 'ps -ef': 'process',
  'ip addr': 'network', 'ip route': 'network',
  'netstat -tuln': 'network', 'ss -tuln': 'network',
  'free -h': 'memory', free: 'memory', vmstat: 'memory',
  lscpu: 'cpu', nproc: 'cpu', lsblk: 'disk', mount: 'filesystem',
  'cat /proc/cpuinfo': 'system', 'cat /proc/meminfo': 'system',
  'cat /proc/version': 'system', 'cat /proc/uptime': 'system',
  'cat /etc/os-release': 'system', 'cat /etc/hostname': 'system',
  'journalctl -n 20': 'logs', dmesg: 'logs',
};

// ─── Blocked patterns ─────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i, /sudo/i, /chmod\s+777/i, /passwd/i,
  /shutdown/i, /reboot/i, /halt/i, /init\s+0/i,
  /mkfs/i, /fdisk/i, /dd\s+if/i, />\s*\/dev\//i,
  /curl.*\|.*sh/i, /wget.*\|.*sh/i, /nc\s+-e/i,
  /bash\s+-i/i, /\/etc\/shadow/i, /\/etc\/passwd/i,
  /crontab/i, /at\s+now/i,
];

// ─── Compile and run a C program ──────────────────────────────────
const compileAndRun = (key, cCode) =>
  new Promise((resolve) => {
    const slug = key.replace('syscall:', '');
    const src  = path.join(SYSCALL_TMP, `${slug}.c`);
    const isWin = process.platform === 'win32';
    const bin  = path.join(SYSCALL_TMP, isWin ? `${slug}.exe` : slug);
    fs.writeFileSync(src, cCode.trim());
    exec(`gcc -O2 -Wall -o "${bin}" "${src}"`, { timeout: 15000 }, (compErr, _, compStderr) => {
      if (compErr) {
        return resolve({ stdout: '', stderr: `Compilation error:\n${compStderr}`, exitCode: 1 });
      }
      exec(`"${bin}"`, { timeout: 10000, maxBuffer: 1024 * 512 }, (runErr, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || (runErr ? runErr.message : ''),
          exitCode: runErr ? (runErr.code || 1) : 0,
        });
      });
    });
  });

// ─── isCommandAllowed ─────────────────────────────────────────────
const isCommandAllowed = (command) => {
  const trimmed = command.trim().toLowerCase();
  if (trimmed.startsWith('syscall:')) {
    if (CORE_SYSCALLS[trimmed]) return { allowed: true, type: CORE_SYSCALLS[trimmed].type, isSyscall: true };
    return { allowed: false, reason: `Unknown core syscall demo: ${trimmed}` };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return { allowed: false, reason: 'Command contains blocked pattern' };
  }
  for (const allowed of Object.keys(SYSCALL_WHITELIST)) {
    if (trimmed === allowed || trimmed.startsWith(allowed + ' ')) {
      return { allowed: true, type: SYSCALL_WHITELIST[allowed], isSyscall: false };
    }
  }
  return { allowed: false, reason: 'Command not in allowed list' };
};

// ─── POST /execute ────────────────────────────────────────────────
router.post('/execute', protect, async (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ success: false, message: 'Command is required.' });
  }

  const check = isCommandAllowed(command.trim());

  if (!check.allowed) {
    try {
      await SyscallLog.create({
        user: req.user._id, username: req.user.username,
        command, syscallType: 'blocked', output: '',
        error: check.reason, exitCode: -1, status: 'blocked', executionTime: 0,
      });
      return res.status(403).json({ success: false, message: `Command blocked: ${check.reason}`, status: 'blocked' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Server error saving log.' });
    }
  }

  const startTime = Date.now();

  // Core syscall demo path (C compile + run)
  if (check.isSyscall) {
    const key  = command.trim().toLowerCase();
    const demo = CORE_SYSCALLS[key];
    const { stdout, stderr, exitCode } = await compileAndRun(key, demo.code);
    const executionTime = Date.now() - startTime;
    const status = exitCode === 0 ? 'success' : 'error';
    try {
      await SyscallLog.create({
        user: req.user._id, username: req.user.username,
        command: `${key}  [${demo.description}]`,
        syscallType: check.type, output: stdout, error: stderr,
        exitCode, status, executionTime,
      });
      return res.status(200).json({
        success: true, command, output: stdout, error: stderr,
        exitCode, status, executionTime, syscallType: check.type,
        description: demo.description, isCoreSyscall: true,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Server error saving log.' });
    }
  }

  // Shell command path
  exec(command, { timeout: 10000, maxBuffer: 1024 * 512 }, async (error, stdout, stderr) => {
    const executionTime = Date.now() - startTime;
    const exitCode = error ? error.code || 1 : 0;
    const status   = error ? 'error' : 'success';
    try {
      await SyscallLog.create({
        user: req.user._id, username: req.user.username,
        command, syscallType: check.type,
        output: stdout || '', error: stderr || (error ? error.message : ''),
        exitCode, status, executionTime,
      });
      res.status(200).json({
        success: true, command, output: stdout || '', error: stderr || '',
        exitCode, status, executionTime, syscallType: check.type,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error saving log.' });
    }
  });
});

// ─── GET /logs ────────────────────────────────────────────────────
router.get('/logs', protect, async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;
    const query = req.user.role === 'admin' ? {} : { user: req.user._id };
    const [logs, total] = await Promise.all([
      SyscallLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
      SyscallLog.countDocuments(query),
    ]);
    res.status(200).json({
      success: true, logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch logs.' });
  }
});

// ─── GET /stats ───────────────────────────────────────────────────
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
    res.status(200).json({ success: true, stats: { total, success, errors, blocked, typeStats } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ─── GET /allowed-commands ────────────────────────────────────────
router.get('/allowed-commands', protect, (req, res) => {
  const shellCmds = Object.entries(SYSCALL_WHITELIST).map(([cmd, type]) => ({
    command: cmd, type, isCoreSyscall: false,
  }));
  const coreCmds = Object.entries(CORE_SYSCALLS).map(([cmd, { type, description }]) => ({
    command: cmd, type, isCoreSyscall: true, description,
  }));
  res.status(200).json({ success: true, commands: [...coreCmds, ...shellCmds] });
});

module.exports = router;
