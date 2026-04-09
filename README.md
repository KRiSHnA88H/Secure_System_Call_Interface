# 🔐 SecureSysCall — Linux System Call Executor

A full-stack web application that provides a **secure, authenticated terminal** for executing whitelisted Linux system calls with complete audit logging, real-time output, and beautiful UI.

---

## ✨ Features

- **🔐 JWT Authentication** — Secure login & registration with bcrypt-hashed passwords
- **⌨️ Interactive Terminal** — Browser-based terminal with command history (↑↓ arrows)
- **🛡️ Command Whitelist** — Only pre-approved safe system calls are allowed
- **🚫 Blocked Commands** — Dangerous commands (rm -rf, sudo, shutdown, etc.) are blocked and logged
- **📋 Audit Logging** — Every executed command is logged in MongoDB with timestamp, output, exit code, and execution time
- **📊 Statistics Dashboard** — Real-time stats on commands executed, errors, and blocked attempts
- **⚡ Quick Commands** — One-click shortcuts for common syscalls
- **📚 Command Reference** — Browse all allowed commands by category

---

## 🗂️ Project Structure

```
secure-syscall/
├── backend/
│   ├── models/
│   │   ├── User.js          # Mongoose user schema
│   │   └── SyscallLog.js    # Mongoose syscall log schema
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js          # Register, login, /me endpoints
│   │   └── syscall.js       # Execute, logs, stats, allowed-commands
│   ├── server.js            # Express app + MongoDB connection
│   ├── .env.example         # Environment variables template
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.jsx   # Auth state + API client
    │   ├── pages/
    │   │   ├── Login.jsx         # Login page
    │   │   ├── Register.jsx      # Register page
    │   │   ├── Dashboard.jsx     # Main terminal dashboard
    │   │   ├── Auth.css          # Auth pages styles
    │   │   └── Dashboard.css     # Dashboard styles
    │   ├── App.jsx               # Routing
    │   ├── main.jsx              # Entry point
    │   └── index.css             # Global design system
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or MongoDB Atlas)

---

### 1. Clone & Setup

```bash
git clone <repo-url>
cd secure-syscall
```

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secure_syscall
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
```

Start the backend:
```bash
npm run dev        # Development (with nodemon)
# or
npm start          # Production
```

The API will run on `http://localhost:5000`

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will open at `http://localhost:3000`

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current user (auth required) |

### Syscall (all require Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/syscall/execute` | Execute a whitelisted command |
| GET | `/api/syscall/logs` | Fetch audit logs (paginated) |
| GET | `/api/syscall/stats` | Get execution statistics |
| GET | `/api/syscall/allowed-commands` | List all allowed commands |

---

## ✅ Allowed Commands

| Category | Commands |
|----------|---------|
| **System** | `uname -a`, `hostname`, `date`, `uptime`, `whoami`, `id`, `env`, `w`, `who` |
| **Memory** | `free -h`, `vmstat`, `cat /proc/meminfo` |
| **CPU** | `lscpu`, `nproc`, `cat /proc/cpuinfo` |
| **Disk** | `df -h`, `du`, `lsblk` |
| **Filesystem** | `ls -la`, `pwd`, `mount` |
| **Process** | `ps aux`, `ps -ef` |
| **Network** | `ifconfig`, `ip addr`, `ip route`, `netstat -tuln`, `ss -tuln` |
| **Logs** | `journalctl -n 20`, `dmesg` |

---

## 🚫 Blocked Patterns

These are always blocked regardless of framing:

- `rm -rf`, `sudo`, `shutdown`, `reboot`, `halt`
- `chmod 777`, `mkfs`, `fdisk`, `dd if=`
- `passwd`, `/etc/shadow`, `/etc/passwd`
- `curl | sh`, `wget | sh`, `bash -i`, `nc -e`
- `crontab`, `at now`

---

## 🗄️ MongoDB Schemas

### User
```js
{
  username: String (unique),
  email:    String (unique),
  password: String (bcrypt hashed),
  role:     'user' | 'admin',
  createdAt: Date,
  lastLogin: Date
}
```

### SyscallLog
```js
{
  user:          ObjectId (ref: User),
  username:      String,
  command:       String,
  syscallType:   String,
  output:        String,
  error:         String,
  exitCode:      Number,
  status:        'success' | 'error' | 'blocked',
  executionTime: Number (ms),
  timestamp:     Date
}
```

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + React Router v6 |
| Styling | Custom CSS Design System (no UI library) |
| Fonts | JetBrains Mono + Syne (Google Fonts) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| HTTP Client | Axios |

---

## 🔒 Security Notes

- Passwords are hashed with bcrypt (12 salt rounds)
- JWT tokens expire after 7 days
- Command execution uses `child_process.exec` with a 10s timeout and 512KB output buffer
- All commands checked against whitelist AND blocked-pattern list before execution
- Every execution (including blocked ones) is logged to MongoDB

---

## 📸 Pages

1. **Login** — Split layout with animated terminal preview on left, login form on right
2. **Register** — Same split layout with password strength indicator
3. **Dashboard / Terminal** — Full IDE-like terminal with quick command buttons
4. **Audit Logs** — Paginated, expandable log table with status badges
5. **Command Reference** — Browse all allowed commands by category
6. **Statistics** — Stat cards + command type breakdown bars
