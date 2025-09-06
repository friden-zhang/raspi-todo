#!/bin/bash

# Status check script for Todo App
echo "🍓 Todo App Status Check"
echo "========================"

# Check systemd service
echo "🔧 Systemd Service:"
if systemctl is-active --quiet todo-app 2>/dev/null; then
    echo "   ✅ RUNNING"
else
    echo "   ❌ NOT RUNNING"
fi

# Check Docker container
echo "🐳 Docker Container:"
if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^todo-app$"; then
    echo "   ✅ RUNNING"
else
    echo "   ❌ NOT RUNNING"
fi

# Check application health
echo "🏥 Application Health:"
if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
    echo "   ✅ HEALTHY"
    echo "   📍 http://localhost:8000"
else
    echo "   ❌ UNHEALTHY"
fi

echo ""
echo "🎯 Quick Actions:"
echo "   Update:  sudo ./deploy/deploy.sh update"
echo "   Restart: sudo systemctl restart todo-app"
echo "   Logs:    sudo journalctl -u todo-app -f"
