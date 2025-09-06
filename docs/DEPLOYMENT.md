# 🚢 Deployment Guide

This guide covers various deployment options for the Raspberry Pi Todo Application.

## 📋 Prerequisites

- Raspberry Pi (recommended: Pi 4 with 4GB+ RAM)
- Raspberry Pi OS (64-bit) or compatible Linux distribution
- Docker (for containerized deployment)
- Git for cloning the repository

## 🚀 Quick Deployment Options

### Option 1: Docker Compose (Recommended)

The easiest way to deploy the application:

```bash
# Clone the repository
git clone https://github.com/friden-zhang/raspi-todo.git
cd raspi-todo

# Start the application
docker-compose up -d
```

Access the application at: http://localhost:8000

### Option 2: Local Network Deployment (Raspberry Pi)

For production deployment on Raspberry Pi:

```bash
# Systemd service deployment (recommended for production)
sudo ./deploy/local-deploy.sh systemd

# Docker deployment with GitHub pre-built image
sudo ./deploy/local-deploy.sh docker

# Docker deployment with local build
sudo ./deploy/local-deploy.sh docker-local

# Update existing deployment
sudo ./deploy/local-deploy.sh update
```

### Option 3: Makefile Commands (Simplified)

Use the provided Makefile for easier deployment:

```bash
# Local systemd deployment
make deploy-local

# Docker deployment
make deploy-docker

# Update deployment
make deploy-update

# Stop Docker containers
make docker-stop
```

## ⚙️ Configuration

### Environment Variables

Copy and configure the environment file:

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

Key configuration options:

```bash
# Application settings
PORT=8000
RUST_LOG=info
DATABASE_URL=sqlite:./data/todos.db
STATIC_DIR=./static

# Docker settings
COMPOSE_PROJECT_NAME=raspi-todo
```

### Custom Port Configuration

To change the default port (8000):

1. Update `.env` file:

   ```bash
   PORT=3000
   ```

2. Update `docker-compose.yml` ports mapping:
   ```yaml
   ports:
     - '3000:3000'
   ```

## 🏗️ Deployment Methods in Detail

### Systemd Service Deployment

This method runs the application as a native system service:

```bash
# Deploy as systemd service
sudo ./deploy/local-deploy.sh systemd

# Check service status
sudo systemctl status todo-app

# View service logs
sudo journalctl -u todo-app -f

# Restart service
sudo systemctl restart todo-app

# Stop service
sudo systemctl stop todo-app
```

**Advantages:**

- Native performance
- Automatic startup on boot
- System integration
- Lower resource usage

**Files created:**

- `/opt/todo-app/` - Application directory
- `/etc/systemd/system/todo-app.service` - Service definition
- `/opt/todo-app/logs/` - Log files

### Docker Deployment

#### Using Pre-built Image

```bash
# Deploy using GitHub Container Registry image
sudo ./deploy/local-deploy.sh docker
```

#### Building Locally

```bash
# Build and deploy locally
sudo ./deploy/local-deploy.sh docker-local

# Or using make
make docker-build
make docker-run
```

#### Docker Commands

```bash
# Build the image
docker build -t todo-app .

# Run the container
docker run -d \
  --name todo-app \
  --restart unless-stopped \
  -p 8000:8000 \
  -v todo_data:/home/app/data \
  todo-app

# View logs
docker logs todo-app -f

# Stop and remove
docker stop todo-app
docker rm todo-app
```

### Docker Compose Deployment

For full stack with monitoring:

```bash
# Basic deployment
docker-compose up -d

# With monitoring stack
docker-compose -f deploy/docker-compose.monitoring.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📊 Monitoring Setup

### Enable Monitoring Stack

Deploy with Grafana and Prometheus monitoring:

```bash
# Start monitoring stack
docker-compose -f deploy/docker-compose.monitoring.yml up -d
```

Access monitoring dashboards:

- **Grafana**: http://your-pi-ip:3001 (admin/admin)
- **Prometheus**: http://your-pi-ip:9090

### Monitoring-only Stack

To monitor an existing systemd deployment:

```bash
# Start monitoring for systemd deployment
docker-compose -f deploy/docker-compose.monitoring-only.yml up -d
```

### Health Checks

```bash
# Application health endpoint
curl http://localhost:8000/api/health

# Container health check
docker ps --format "table {{.Names}}\t{{.Status}}"

# Service status (systemd)
sudo systemctl is-active todo-app
```

## 🔧 Maintenance and Updates

### Updating the Application

#### Docker Deployment

```bash
# Pull latest image and restart
docker-compose pull
docker-compose up -d

# Or using deployment script
sudo ./deploy/local-deploy.sh update
```

#### Systemd Deployment

```bash
# Update systemd deployment
sudo ./deploy/local-deploy.sh update
```

### Backup and Restore

#### Backup Data

```bash
# Docker volume backup
docker run --rm -v todo_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/todo-backup.tar.gz -C /data .

# Systemd backup
sudo tar czf todo-backup.tar.gz -C /opt/todo-app/data .
```

#### Restore Data

```bash
# Docker volume restore
docker run --rm -v todo_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/todo-backup.tar.gz -C /data

# Systemd restore
sudo tar xzf todo-backup.tar.gz -C /opt/todo-app/data
sudo systemctl restart todo-app
```

### Log Management

#### Docker Logs

```bash
# View logs
docker logs todo-app -f

# Rotate logs (automatic with docker-compose)
docker-compose logs --tail=100 -f
```

#### Systemd Logs

```bash
# View logs
sudo journalctl -u todo-app -f

# View last 100 lines
sudo journalctl -u todo-app -n 100

# Clean old logs
sudo journalctl --vacuum-time=7d
```

## 🛡️ Security Considerations

### Firewall Configuration

```bash
# Allow HTTP traffic
sudo ufw allow 8000/tcp

# For monitoring (optional)
sudo ufw allow 3001/tcp  # Grafana
sudo ufw allow 9090/tcp  # Prometheus
```

### SSL/TLS Setup

For production deployment, consider using a reverse proxy:

```bash
# Install nginx
sudo apt update && sudo apt install nginx

# Copy provided nginx configuration
sudo cp deploy/nginx.conf /etc/nginx/sites-available/todo-app
sudo ln -s /etc/nginx/sites-available/todo-app /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### Network Access

The application is designed for local network access. To expose it externally:

1. Configure router port forwarding
2. Set up dynamic DNS (if needed)
3. Consider using a VPN for secure remote access

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill process if needed
sudo kill -9 <PID>
```

#### Permission Errors

```bash
# Fix ownership (systemd)
sudo chown -R app:app /opt/todo-app

# Fix Docker volume permissions
docker run --rm -v todo_data:/data alpine chown -R 1000:1000 /data
```

#### Database Issues

```bash
# Check database file (systemd)
sudo ls -la /opt/todo-app/data/

# Reset database (WARNING: destroys data)
sudo rm /opt/todo-app/data/todos.db
sudo systemctl restart todo-app
```

#### Service Won't Start

```bash
# Check service status
sudo systemctl status todo-app

# Check logs for errors
sudo journalctl -u todo-app --no-pager

# Verify binary exists and is executable
sudo ls -la /opt/todo-app/server-rs
```

### Performance Optimization

#### For Raspberry Pi 3 or limited memory:

```yaml
# docker-compose.yml - Add memory limits
services:
  todo-app:
    mem_limit: 256m
    mem_reservation: 128m
```

#### For better performance:

```bash
# Enable memory cgroup (add to /boot/cmdline.txt)
cgroup_enable=memory cgroup_memory=1

# Reboot after editing
sudo reboot
```

## 📞 Support

If you encounter issues:

1. Check the [main README](../README.md) for basic setup
2. Review the logs using commands above
3. Check [GitHub Issues](https://github.com/friden-zhang/raspi-todo/issues)
4. Create a new issue with:
   - Pi model and OS version
   - Deployment method used
   - Error logs
   - Steps to reproduce

## 🔄 Rollback

### Docker Rollback

```bash
# Use specific version
docker-compose down
docker pull ghcr.io/friden-zhang/raspi-todo:v1.0.0
docker-compose up -d
```

### Systemd Rollback

```bash
# Keep backup of working binary
sudo cp /opt/todo-app/server-rs /opt/todo-app/server-rs.backup

# Restore if needed
sudo cp /opt/todo-app/server-rs.backup /opt/todo-app/server-rs
sudo systemctl restart todo-app
```
