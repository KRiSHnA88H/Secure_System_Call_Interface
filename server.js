import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';

const app = express();
app.use(express.json());
app.use(cors());

const SECRET = "mySecretKey";


// 🔐 LOGIN ROUTE
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "12345") {
        const token = jwt.sign({ username }, SECRET);
        return res.json({ token });
    }

    res.status(401).send("Invalid credentials");
});


// 🔒 AUTH MIDDLEWARE
function authenticate(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) return res.status(403).send("No token");

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).send("Invalid token");
    }
}


// ⚙️ SYSCALL ROUTE
app.post('/syscall', authenticate, (req, res) => {
    const { action, data } = req.body;

    let command = "";

    try {
        switch(action) {

            case "write":
                command = `./secure_syscall write "${data}"`;
                break;

            case "getpid":
                command = `./secure_syscall getpid`;
                break;

            case "create":
                command = `./secure_syscall create ${data}`;
                break;

            case "read":
                command = `./secure_syscall read ${data}`;
                break;

            case "delete":
                command = `./secure_syscall delete ${data}`;
                break;

            // ✅ FIXED APPEND (multi-word support)
            case "append": {
                const parts = data.split(" ");
                const file = parts[0];
                const text = parts.slice(1).join(" ");

                command = `./secure_syscall append ${file} "${text}"`;
                break;
            }

            case "rename": {
                const parts = data.split(" ");
                command = `./secure_syscall rename ${parts[0]} ${parts[1]}`;
                break;
            }

            case "list":
                command = `./secure_syscall list`;
                break;

            case "stat":
                command = `./secure_syscall stat ${data}`;
                break;

            case "chmod": {
                const parts = data.split(" ");
                command = `./secure_syscall chmod ${parts[0]} ${parts[1]}`;
                break;
            }

            case "fork":
                command = `./secure_syscall fork`;
                break;

            case "exec":
                command = `./secure_syscall exec ${data}`;
                break;

            default:
                return res.send("Invalid action");
        }

        // 🚀 EXECUTE C PROGRAM
        exec(command, (err, stdout, stderr) => {
            if (err) return res.send("Execution error");
            res.send(stdout || stderr);
        });

    } catch (error) {
        res.send("Server error");
    }
});


// 📜 LOG VIEW API
app.get('/logs', (req, res) => {
    fs.readFile("syscall.log", "utf8", (err, data) => {
        if (err) return res.send("No logs yet");
        res.send(data);
    });
});


// 🚀 START SERVER
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
