#!/usr/bin/env bash
# Robustly start the Next.js dev server as a detached daemon so it
# survives the parent Bash tool shell session ending.
set -u
cd /home/z/my-project

# Kill any prior instances to avoid port conflicts
pkill -f "next dev -p 3000" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# Double-fork + setsid to fully detach from controlling terminal/session.
# Run `next dev` DIRECTLY (not via `bun run dev`) so we avoid the
# `| tee dev.log` pipe in package.json which breaks when backgrounded
# (causes SIGPIPE that kills the server). We redirect to dev.log ourselves.
nohup setsid bash -c \
  'exec /usr/local/bin/bun next dev -p 3000' \
  </dev/null >/home/z/my-project/dev.log 2>&1 &

SERVER_PID=$!
disown 2>/dev/null || true

# Give it a moment, then report status
sleep 10
if ss -tln 2>/dev/null | grep -q ':3000 '; then
  echo "OK: dev server listening on :3000 (launcher pid $SERVER_PID)"
else
  echo "WARN: :3000 not listening yet"
fi
