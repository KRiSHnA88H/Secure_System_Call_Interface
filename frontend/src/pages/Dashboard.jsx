import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';
import './Dashboard.css';

const TYPE_COLORS = {
  'core-io':      '#00d4ff',
  'core-process': '#f59e0b',
  'core-ipc':     '#a855f7',
  'core-memory':  '#ec4899',
  'core-signal':  '#ef4444',
  filesystem:     '#5865f2',
  disk:           '#8b5cf6',
  system:         '#06b6d4',
  process:        '#f97316',
  network:        '#22c55e',
  memory:         '#db2777',
  cpu:            '#f59e0b',
  logs:           '#6ee7b7',
  blocked:        '#ef4444',
};

const CORE_SYSCALL_DEMOS = [
  { label: 'read()',    cmd: 'syscall:read',   type: 'core-io',      icon: '📖', desc: 'Read bytes from fd' },
  { label: 'write()',   cmd: 'syscall:write',  type: 'core-io',      icon: '✏️',  desc: 'Write bytes to fd' },
  { label: 'open()',    cmd: 'syscall:open',   type: 'core-io',      icon: '📂', desc: 'Open / close fd' },
  { label: 'fork()',    cmd: 'syscall:fork',   type: 'core-process', icon: '🔀', desc: 'Create child process' },
  { label: 'exec()',    cmd: 'syscall:exec',   type: 'core-process', icon: '🚀', desc: 'Replace process image' },
  { label: 'wait()',    cmd: 'syscall:wait',   type: 'core-process', icon: '⏳', desc: 'Wait for child exit' },
  { label: 'getpid()',  cmd: 'syscall:getpid', type: 'core-process', icon: '🆔', desc: 'Get process IDs' },
  { label: 'pipe()',    cmd: 'syscall:pipe',   type: 'core-ipc',     icon: '🔗', desc: 'IPC pipe channel' },
  { label: 'mmap()',    cmd: 'syscall:mmap',   type: 'core-memory',  icon: '🗺️',  desc: 'Map memory/files' },
  { label: 'signal()', cmd: 'syscall:signal', type: 'core-signal',  icon: '📡', desc: 'Send/catch signals' },
  { label: 'stat()',    cmd: 'syscall:stat',   type: 'core-io',      icon: '🔍', desc: 'File metadata' },
];

const QUICK_COMMANDS = [
  { label: 'System Info', cmd: 'uname -a',           type: 'system' },
  { label: 'Memory',      cmd: 'free -h',             type: 'memory' },
  { label: 'Disk',        cmd: 'df -h',               type: 'disk' },
  { label: 'CPU Info',    cmd: 'lscpu',               type: 'cpu' },
  { label: 'Uptime',      cmd: 'uptime',              type: 'system' },
  { label: 'Who am I',   cmd: 'whoami',              type: 'system' },
  { label: 'Processes',   cmd: 'ps aux',              type: 'process' },
  { label: 'Network',     cmd: 'ip addr',             type: 'network' },
  { label: 'OS Info',     cmd: 'cat /etc/os-release', type: 'system' },
  { label: 'CPU Cores',   cmd: 'nproc',               type: 'cpu' },
  { label: 'Hostname',    cmd: 'hostname',             type: 'system' },
  { label: 'List Files',  cmd: 'ls -la',              type: 'filesystem' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]         = useState('terminal');
  const [command, setCommand]             = useState('');
  const [executing, setExecuting]         = useState(false);
  const [history, setHistory]             = useState([]);
  const [historyIdx, setHistoryIdx]       = useState(-1);
  const [logs, setLogs]                   = useState([]);
  const [logsPage, setLogsPage]           = useState(1);
  const [logsMeta, setLogsMeta]           = useState({ total: 0, pages: 1 });
  const [logsLoading, setLogsLoading]     = useState(false);
  const [stats, setStats]                 = useState(null);
  const [allowedCmds, setAllowedCmds]     = useState([]);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [terminalLines, setTerminalLines] = useState([{ type: 'banner', content: '' }]);
  const [execRunning, setExecRunning]     = useState(null); // label of running demo

  const inputRef   = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => { fetchStats(); fetchLogs(1); fetchAllowedCmds(); }, []);

  useEffect(() => {
    if (terminalRef.current)
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  const fetchStats        = async () => { try { const { data } = await API.get('/syscall/stats'); if (data.success) setStats(data.stats); } catch {} };
  const fetchAllowedCmds  = async () => { try { const { data } = await API.get('/syscall/allowed-commands'); if (data.success) setAllowedCmds(data.commands); } catch {} };
  const fetchLogs         = async (page = 1) => {
    setLogsLoading(true);
    try {
      const { data } = await API.get(`/syscall/logs?page=${page}&limit=15`);
      if (data.success) { setLogs(data.logs); setLogsMeta(data.pagination); setLogsPage(page); }
    } catch {}
    setLogsLoading(false);
  };

  const executeCommand = async (cmd = command, label = null) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setTerminalLines(prev => [...prev, { type: 'input', content: trimmed }]);
    setExecuting(true);
    setExecRunning(label);
    setHistory(h => [trimmed, ...h.slice(0, 49)]);
    setHistoryIdx(-1);
    setCommand('');

    // Show compiling notice for core syscalls
    if (trimmed.startsWith('syscall:')) {
      setTerminalLines(prev => [...prev, { type: 'compiling', content: 'Compiling C program with gcc...' }]);
    }

    try {
      const { data } = await API.post('/syscall/execute', { command: trimmed });

      // Remove compiling notice
      setTerminalLines(prev => prev.filter(l => l.type !== 'compiling'));

      const result = {
        type: data.status === 'blocked' ? 'blocked' : data.status === 'error' ? 'error' : 'output',
        content: data.output || data.error || data.message || '',
        meta: {
          cmd: trimmed,
          status: data.status,
          exitCode: data.exitCode,
          time: data.executionTime,
          syscallType: data.syscallType,
          isCoreSyscall: data.isCoreSyscall,
          description: data.description,
        },
      };
      setTerminalLines(prev => [...prev, result]);
      fetchStats();
      if (activeTab === 'logs') fetchLogs(1);
    } catch (err) {
      setTerminalLines(prev => prev.filter(l => l.type !== 'compiling'));
      const msg = err.response?.data?.message || 'Execution failed.';
      const isBlocked = err.response?.data?.status === 'blocked';
      setTerminalLines(prev => [...prev, { type: isBlocked ? 'blocked' : 'error', content: msg }]);
    }

    setExecuting(false);
    setExecRunning(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { executeCommand(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const idx = Math.min(historyIdx + 1, history.length - 1); setHistoryIdx(idx); setCommand(history[idx] || ''); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const idx = Math.max(historyIdx - 1, -1); setHistoryIdx(idx); setCommand(idx === -1 ? '' : history[idx] || ''); }
  };

  const handleLogout  = () => { logout(); navigate('/login'); };
  const clearTerminal = () => { setTerminalLines([{ type: 'banner', content: '' }]); };

  const formatDate = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const groupedCmds = allowedCmds.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  return (
    <div className="dashboard">
      <div className="grid-bg" />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="auth-brand">
            <div className="brand-icon-sm">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="2" width="28" height="28" rx="6" stroke="url(#gs)" strokeWidth="1.5" />
                <path d="M8 16l4 4 8-8" stroke="url(#gs2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="gs" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse"><stop stopColor="#5865f2"/><stop offset="1" stopColor="#a855f7"/></linearGradient>
                  <linearGradient id="gs2" x1="8" y1="12" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#5865f2"/><stop offset="1" stopColor="#00d4ff"/></linearGradient>
                </defs>
              </svg>
            </div>
            {sidebarOpen && <span className="brand-name-sm">SecureSysCall</span>}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? '←' : '→'}</button>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: 'terminal',  icon: '⌨',  label: 'Terminal' },
            { id: 'syscalls',  icon: '⚙️',  label: 'Core Syscalls' },
            { id: 'logs',      icon: '📋', label: 'Audit Logs' },
            { id: 'commands',  icon: '📚', label: 'Commands' },
            { id: 'stats',     icon: '📊', label: 'Statistics' },
          ].map(item => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); if (item.id === 'logs') fetchLogs(1); }}>
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
              {item.id === 'syscalls' && sidebarOpen && <span className="nav-badge">NEW</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-user">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="dash-header">
          <div className="header-left">
            <div className="header-breadcrumb">
              <span className="breadcrumb-root">syscall</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{activeTab}</span>
            </div>
            {stats && (
              <div className="header-stats">
                <span className="stat-pill success">{stats.success} ok</span>
                <span className="stat-pill error">{stats.errors} err</span>
                <span className="stat-pill blocked">{stats.blocked} blocked</span>
              </div>
            )}
          </div>
          <div className="header-right">
            <div className="status-indicator"><div className="status-dot" /><span>Connected</span></div>
            <span className="header-user">
              <span className="header-avatar">{user?.username?.[0]?.toUpperCase()}</span>
              {user?.username}
            </span>
          </div>
        </header>

        {/* ── TAB: TERMINAL ── */}
        {activeTab === 'terminal' && (
          <div className="tab-content terminal-tab">
            <div className="quick-cmds">
              <div className="section-label">Shell Commands</div>
              <div className="quick-grid">
                {QUICK_COMMANDS.map(qc => (
                  <button key={qc.cmd} className="quick-btn" onClick={() => executeCommand(qc.cmd, qc.label)}
                    disabled={executing} style={{ '--type-color': TYPE_COLORS[qc.type] || '#5865f2' }}>
                    <span className="quick-label">{qc.label}</span>
                    <code className="quick-cmd">{qc.cmd}</code>
                  </button>
                ))}
              </div>
            </div>
            <TerminalWindow
              terminalLines={terminalLines} terminalRef={terminalRef}
              command={command} setCommand={setCommand}
              executing={executing} onKeyDown={handleKeyDown}
              onRun={executeCommand} onClear={clearTerminal}
              inputRef={inputRef} user={user}
            />
          </div>
        )}

        {/* ── TAB: CORE SYSCALLS ── */}
        {activeTab === 'syscalls' && (
          <div className="tab-content syscalls-tab animate-fade-in">
            <div className="syscalls-header">
              <div>
                <h2 className="tab-title">Core Linux Syscalls</h2>
                <p className="tab-desc">Real kernel system calls written in C, compiled with gcc, and executed live on the server. Each demo shows the syscall in action with annotated output.</p>
              </div>
              <div className="syscall-legend">
                {[['core-io','I/O'],['core-process','Process'],['core-ipc','IPC'],['core-memory','Memory'],['core-signal','Signal']].map(([t,l]) => (
                  <span key={t} className="legend-pill" style={{ borderColor: TYPE_COLORS[t]+'66', color: TYPE_COLORS[t], background: TYPE_COLORS[t]+'15' }}>{l}</span>
                ))}
              </div>
            </div>

            <div className="syscall-cards">
              {CORE_SYSCALL_DEMOS.map(demo => (
                <div key={demo.cmd} className="syscall-card" style={{ '--sc': TYPE_COLORS[demo.type] }}>
                  <div className="sc-top">
                    <span className="sc-icon">{demo.icon}</span>
                    <div className="sc-info">
                      <div className="sc-name">{demo.label}</div>
                      <div className="sc-desc">{demo.desc}</div>
                    </div>
                    <span className="sc-type-badge" style={{ color: TYPE_COLORS[demo.type], background: TYPE_COLORS[demo.type]+'18', borderColor: TYPE_COLORS[demo.type]+'44' }}>
                      {demo.type.replace('core-', '')}
                    </span>
                  </div>
                  <code className="sc-cmd">{demo.cmd}</code>
                  <button
                    className="sc-run-btn"
                    onClick={() => { executeCommand(demo.cmd, demo.label); setActiveTab('terminal'); }}
                    disabled={executing}
                    style={{ '--sc': TYPE_COLORS[demo.type] }}
                  >
                    {executing && execRunning === demo.label ? (
                      <><span className="spinner" style={{ width: 12, height: 12 }} /> Running...</>
                    ) : (
                      <>'Run Demo →'</>
                    )}
                    {!(executing && execRunning === demo.label) && 'Run Demo →'}
                  </button>
                </div>
              ))}
            </div>

            <div className="syscall-info-box">
              <div className="sib-title">⚙️ How it works</div>
              <div className="sib-body">
                Each syscall demo is a real C program stored on the server. When you click <strong>Run Demo</strong>, the backend:
                writes the C source to a temp file → compiles it with <code>gcc -O2</code> → executes the binary → captures stdout/stderr → logs the result to MongoDB → streams output to your terminal. The compilation typically takes under 500ms.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: LOGS ── */}
        {activeTab === 'logs' && (
          <div className="tab-content logs-tab animate-fade-in">
            <div className="logs-header">
              <h2 className="tab-title">Audit Log</h2>
              <button className="btn-ghost" onClick={() => fetchLogs(logsPage)}>↻ Refresh</button>
            </div>
            {logsLoading ? (
              <div className="loading-state"><span className="spinner" style={{ width: 24, height: 24 }} /></div>
            ) : (
              <>
                <div className="logs-table-wrap">
                  <table className="logs-table">
                    <thead><tr><th>Timestamp</th><th>User</th><th>Command</th><th>Type</th><th>Status</th><th>Time</th></tr></thead>
                    <tbody>
                      {logs.length === 0
                        ? <tr><td colSpan={6} className="empty-row">No logs yet. Execute some commands first.</td></tr>
                        : logs.map(log => <LogRow key={log._id} log={log} formatDate={formatDate} />)
                      }
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span className="page-info">{logsMeta.total} total entries</span>
                  <div className="page-btns">
                    <button className="btn-ghost" disabled={logsPage <= 1} onClick={() => fetchLogs(logsPage - 1)}>← Prev</button>
                    <span className="page-num">Page {logsPage} / {logsMeta.pages}</span>
                    <button className="btn-ghost" disabled={logsPage >= logsMeta.pages} onClick={() => fetchLogs(logsPage + 1)}>Next →</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: COMMANDS ── */}
        {activeTab === 'commands' && (
          <div className="tab-content commands-tab animate-fade-in">
            <h2 className="tab-title">Allowed Commands</h2>
            <p className="tab-desc">Click any command to insert it into the terminal.</p>
            <div className="cmd-groups">
              {Object.entries(groupedCmds).map(([type, cmds]) => (
                <div key={type} className="cmd-group">
                  <div className="cmd-group-header" style={{ '--tc': TYPE_COLORS[type] }}>
                    <span className="cmd-type-dot" />
                    <span>{type.toUpperCase()}</span>
                    <span className="cmd-count">{cmds.length}</span>
                  </div>
                  <div className="cmd-list">
                    {cmds.map(c => (
                      <button key={c.command} className="cmd-item"
                        onClick={() => { setCommand(c.command); setActiveTab('terminal'); setTimeout(() => inputRef.current?.focus(), 100); }}>
                        <code>{c.command}</code>
                        {c.isCoreSyscall && <span className="cmd-core-tag">C</span>}
                        <span className="cmd-use">→ use</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: STATS ── */}
        {activeTab === 'stats' && (
          <div className="tab-content stats-tab animate-fade-in">
            <h2 className="tab-title">Statistics</h2>
            {stats ? (
              <>
                <div className="stat-cards">
                  <StatCard label="Total Executed" value={stats.total}   color="#5865f2" icon="⚡" />
                  <StatCard label="Successful"     value={stats.success} color="#22c55e" icon="✓" />
                  <StatCard label="Errors"         value={stats.errors}  color="#ef4444" icon="✗" />
                  <StatCard label="Blocked"        value={stats.blocked} color="#f59e0b" icon="🛡" />
                </div>
                <div className="type-breakdown">
                  <h3 className="breakdown-title">By Command Type</h3>
                  <div className="breakdown-bars">
                    {stats.typeStats.map(ts => {
                      const pct = stats.total ? Math.round((ts.count / stats.total) * 100) : 0;
                      return (
                        <div key={ts._id} className="breakdown-row">
                          <span className="breakdown-label">{ts._id}</span>
                          <div className="breakdown-bar-wrap">
                            <div className="breakdown-bar-fill" style={{ width: `${pct}%`, background: TYPE_COLORS[ts._id] || '#5865f2' }} />
                          </div>
                          <span className="breakdown-count">{ts.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="loading-state"><span className="spinner" style={{ width: 24, height: 24 }} /></div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Terminal Window Component ──────────────────────────────────────
function TerminalWindow({ terminalLines, terminalRef, command, setCommand, executing, onKeyDown, onRun, onClear, inputRef, user }) {
  return (
    <div className="terminal-window">
      <div className="terminal-titlebar">
        <div className="terminal-dots">
          <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
        </div>
        <span className="terminal-host">root@secure-syscall:~$</span>
        <div className="terminal-actions">
          <button className="btn-ghost" onClick={onClear}>Clear</button>
        </div>
      </div>

      <div className="terminal-output" ref={terminalRef}>
        {terminalLines.map((line, i) => <TerminalLine key={i} line={line} user={user} />)}
        {executing && (
          <div className="term-executing">
            <span className="exec-spinner" />
            <span>Executing...</span>
          </div>
        )}
      </div>

      <div className="terminal-input-row">
        <span className="input-prompt">
          <span className="prompt-user">{user?.username}</span>
          <span className="prompt-at">@</span>
          <span className="prompt-host">secure</span>
          <span className="prompt-colon">:</span>
          <span className="prompt-tilde">~$</span>
        </span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command or syscall:read, syscall:fork... (↑↓ history)"
          disabled={executing}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <button className="exec-btn" onClick={() => onRun()} disabled={executing || !command.trim()}>
          {executing ? <span className="spinner" /> : '⏎ Run'}
        </button>
      </div>
    </div>
  );
}

// ── Terminal Line Component ────────────────────────────────────────
function TerminalLine({ line, user }) {
  if (line.type === 'banner') return (
    <div className="term-banner">
      <pre className="ascii-art">{`  ____                           ____            ____      _ _ 
 / ___|  ___  ___ _   _ _ __ ___/ ___| _   _ ___ / ___|__ _| | |
 \\___ \\ / _ \\/ __| | | | '__/ _ \\___ \\| | | / __| |   / _\` | | |
  ___) |  __/ (__| |_| | | |  __/___) | |_| \\__ \\ |__| (_| | | |
 |____/ \\___|\\___|\\__,_|_|  \\___|____/ \\__, |___/\\____\\__,_|_|_|
                                        |___/`}</pre>
      <div className="banner-info">
        <span className="banner-tag success">● SECURE</span>
        <span className="banner-tag info">Linux Syscall Executor v2.0</span>
        <span className="banner-tag">Core syscalls: read write fork exec pipe mmap signal</span>
      </div>
      <div className="banner-sep">─────────────────────────────────────────────────────────────</div>
    </div>
  );

  if (line.type === 'compiling') return (
    <div className="term-compiling">
      <span className="exec-spinner" />
      <span style={{ color: '#f59e0b' }}>{line.content}</span>
    </div>
  );

  if (line.type === 'input') return (
    <div className="term-input-line">
      <span className="term-ps1">{user?.username}@secure:~$</span>
      <span className="term-cmd">{line.content}</span>
    </div>
  );

  if (line.type === 'output') return (
    <div className="term-result">
      {line.meta && (
        <div className="term-meta">
          <span className="badge badge-success">exit {line.meta.exitCode}</span>
          {line.meta.isCoreSyscall && <span className="badge badge-core">⚙ C compiled</span>}
          <span className="meta-type" style={{ color: TYPE_COLORS[line.meta.syscallType] }}>
            {line.meta.syscallType}
          </span>
          {line.meta.description && <span className="meta-desc">{line.meta.description}</span>}
          <span className="meta-time">{line.meta.time}ms</span>
        </div>
      )}
      <pre className="term-pre">{line.content}</pre>
    </div>
  );

  if (line.type === 'error') return (
    <div className="term-error-line">
      <span className="badge badge-error">error</span>
      <pre className="term-pre error">{line.content}</pre>
    </div>
  );

  if (line.type === 'blocked') return (
    <div className="term-blocked-line">
      <span className="badge badge-blocked">🛡 BLOCKED</span>
      <span className="blocked-msg">{line.content}</span>
    </div>
  );

  return null;
}

// ── Log Row Component ─────────────────────────────────────────────
function LogRow({ log, formatDate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className={`log-row ${log.status}`} onClick={() => setExpanded(!expanded)}>
        <td className="log-time">{formatDate(log.timestamp)}</td>
        <td className="log-user">{log.username}</td>
        <td className="log-cmd"><code>{log.command.length > 40 ? log.command.slice(0,40)+'…' : log.command}</code></td>
        <td>
          <span className="badge badge-info" style={{ color: TYPE_COLORS[log.syscallType], borderColor: TYPE_COLORS[log.syscallType]+'44', background: TYPE_COLORS[log.syscallType]+'15' }}>
            {log.syscallType}
          </span>
        </td>
        <td>
          <span className={`badge badge-${log.status === 'success' ? 'success' : log.status === 'blocked' ? 'blocked' : 'error'}`}>{log.status}</span>
        </td>
        <td className="log-time">{log.executionTime}ms</td>
      </tr>
      {expanded && (
        <tr className="log-expand-row">
          <td colSpan={6}>
            <div className="log-detail">
              {log.output && <><div className="detail-label">Output:</div><pre className="detail-pre">{log.output.slice(0,600)}{log.output.length > 600 ? '…' : ''}</pre></>}
              {log.error  && <><div className="detail-label error">Error:</div><pre className="detail-pre error">{log.error}</pre></>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  return (
    <div className="stat-card" style={{ '--card-color': color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
