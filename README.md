# Focus Flow

A minimal Pomodoro-style focus timer, built with plain HTML, CSS, and JavaScript — no build step, no dependencies.

## Features

- Focus / short break / long break timer modes, with automatic long-break cycling every 4 focus sessions
- Task list — add tasks, mark one as active, track completed pomodoros per task
- Configurable durations for each mode
- Session stats (sessions completed today, total focus time)
- Sound and browser notification when a session ends
- Progress saved locally in the browser (`localStorage`) — no account or server needed

## Running locally

The app is static, so any local web server works. A ready-made one is included:

```powershell
./serve.ps1
```

This serves the app at [http://localhost:8934](http://localhost:8934).

Alternatively, just open `index.html` directly in a browser.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App markup |
| `style.css` | Styling |
| `script.js` | Timer logic, task list, stats, notifications |
| `serve.ps1` | Simple PowerShell static file server for local dev |
