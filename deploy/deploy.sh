#!/bin/bash

# Universal deployment script for Raspberry Pi Todo App
# Supports both local development and production deployment scenarios
# Usage: ./deploy.sh [method] [environment]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🍓 Raspberry Pi Todo App - Universal Deployment${NC}"
echo "======================================================="

# Configuration
REPO_URL="https://github.com/friden-zhang/raspi-todo.git"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="/opt/todo-app"
SERVICE_NAME="todo-app"
DOCKER_IMAGE_NAME="todo-app"
GITHUB_REGISTRY="ghcr.io/friden-zhang/raspi-todo:latest"

# Script arguments
DEPLOY_METHOD=${1:-""}
ENVIRONMENT=${2:-"production"}

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")    echo -e "${BLUE}ℹ️  $message${NC}";;
        "SUCCESS") echo -e "${GREEN}✅ $message${NC}";;
        "WARN")    echo -e "${YELLOW}⚠️  $message${NC}";;
        "ERROR")   echo -e "${RED}❌ $message${NC}";;
        "STEP")    echo -e "${CYAN}🚀 $message${NC}";;
    esac
}

# Check if running as root for system operations
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        print_status "ERROR" "This script needs to be run with sudo for system deployment"
        echo "Usage: sudo $0 [method] [environment]"
        exit 1
    fi
}

# Detect deployment mode based on context
detect_deployment_mode() {
    # If we're in a Git repository with source code, use local mode
    if [ -f "$PROJECT_ROOT/server-rs/Cargo.toml" ] && [ -f "$PROJECT_ROOT/web/package.json" ]; then
        echo "local"
    # If we're running from /opt/todo-app or similar, use remote mode
    elif [ "$PWD" = "/opt/todo-app" ] || [[ "$PWD" == */opt/todo-app* ]]; then
        echo "remote"
    # Default to remote mode for production deployments
    else
        echo "remote"
    fi
}

# Update/get code from git repository (remote mode)
update_code_remote() {
    print_status "STEP" "Getting latest code from Git repository..."

    if [ -d "$DEPLOY_DIR" ]; then
        cd "$DEPLOY_DIR"
        if [ -d ".git" ]; then
            print_status "INFO" "Updating existing repository..."
            git fetch origin
            git reset --hard origin/main
            print_status "SUCCESS" "Code updated from Git"
        else
            print_status "WARN" "Deploy directory exists but is not a Git repository"
            print_status "INFO" "Backing up and re-cloning..."
            mv "$DEPLOY_DIR" "${DEPLOY_DIR}.backup.$(date +%s)"
            git clone "$REPO_URL" "$DEPLOY_DIR"
            cd "$DEPLOY_DIR"
            print_status "SUCCESS" "Repository cloned"
        fi
    else
        print_status "INFO" "Cloning repository for the first time..."
        git clone "$REPO_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
        print_status "SUCCESS" "Repository cloned"
    fi
}

# Use local code (local mode)
use_local_code() {
    print_status "STEP" "Using local project code..."

    if [ "$PROJECT_ROOT" != "$DEPLOY_DIR" ]; then
        print_status "INFO" "Copying local code to deployment directory..."
        mkdir -p "$DEPLOY_DIR"
        rsync -av --exclude='.git' --exclude='target' --exclude='node_modules' --exclude='dist' \
            "$PROJECT_ROOT/" "$DEPLOY_DIR/"
        print_status "SUCCESS" "Local code copied to deployment directory"
    else
        print_status "INFO" "Already in deployment directory"
    fi

    cd "$DEPLOY_DIR"
}

# Build application locally
build_local() {
    print_status "STEP" "Building application locally..."

    cd "$DEPLOY_DIR"

    # Build Rust backend
    print_status "INFO" "Building Rust backend..."
    cd server-rs
    if ! cargo build --release; then
        print_status "ERROR" "Failed to build Rust backend"
        exit 1
    fi
    cd ..

    # Build React frontend
    print_status "INFO" "Building React frontend..."
    cd web
    if ! npm ci --production; then
        print_status "ERROR" "Failed to install frontend dependencies"
        exit 1
    fi
    if ! npm run build; then
        print_status "ERROR" "Failed to build frontend"
        exit 1
    fi
    cd ..

    print_status "SUCCESS" "Local build completed"
}

# Deploy using systemd service
deploy_systemd() {
    print_status "STEP" "Deploying as systemd service..."

    # Create deployment directories
    mkdir -p "$DEPLOY_DIR"/{data,static}

    # Copy built files
    if [ -f "$DEPLOY_DIR/server-rs/target/release/server-rs" ]; then
        cp "$DEPLOY_DIR/server-rs/target/release/server-rs" "$DEPLOY_DIR/server"
    else
        print_status "ERROR" "Backend binary not found. Please build first."
        exit 1
    fi

    if [ -d "$DEPLOY_DIR/web/dist" ]; then
        cp -r "$DEPLOY_DIR/web/dist/"* "$DEPLOY_DIR/static/"
    else
        print_status "ERROR" "Frontend build not found. Please build first."
        exit 1
    fi

    # Create app user if it doesn't exist
    if ! id "app" &>/dev/null; then
        useradd -r -s /bin/false app
        print_status "INFO" "Created app user"
    fi

    # Set permissions
    chown -R app:app "$DEPLOY_DIR"
    chmod +x "$DEPLOY_DIR/server"

    # Install systemd service
    if [ -f "$DEPLOY_DIR/deploy/todo-app.service" ]; then
        cp "$DEPLOY_DIR/deploy/todo-app.service" /etc/systemd/system/
        systemctl daemon-reload
        print_status "INFO" "Systemd service installed"
    else
        print_status "ERROR" "Systemd service file not found"
        exit 1
    fi

    # Stop existing service if running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        print_status "INFO" "Stopped existing service"
    fi

    # Start and enable service
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"

    # Check if service started successfully
    sleep 3
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "SUCCESS" "Service deployed and started successfully"
        systemctl status "$SERVICE_NAME" --no-pager -l | head -10
    else
        print_status "ERROR" "Failed to start service"
        journalctl -u "$SERVICE_NAME" --no-pager -l | tail -20
        exit 1
    fi
}

# Deploy using Docker with pre-built image from GitHub
deploy_docker_prebuilt() {
    print_status "STEP" "Deploying using pre-built Docker image from GitHub..."

    # Pull latest image from GitHub Container Registry
    print_status "INFO" "Pulling Docker image from GitHub..."
    if docker pull "$GITHUB_REGISTRY"; then
        print_status "SUCCESS" "Successfully pulled image from GitHub"
    else
        print_status "ERROR" "Failed to pull image from GitHub"
        print_status "INFO" "Falling back to local Docker build..."
        deploy_docker_local
        return
    fi

    # Stop and remove existing container
    docker stop "$DOCKER_IMAGE_NAME" 2>/dev/null || true
    docker rm "$DOCKER_IMAGE_NAME" 2>/dev/null || true

    # Run new container
    docker run -d \
        --name "$DOCKER_IMAGE_NAME" \
        --restart unless-stopped \
        -p 8000:8000 \
        -v todo_data:/home/app/data \
        "$GITHUB_REGISTRY"

    print_status "SUCCESS" "Docker deployment completed"
}

# Deploy using Docker with local build
deploy_docker_local() {
    print_status "STEP" "Building and deploying Docker image locally..."

    cd "$DEPLOY_DIR"

    # Build Docker image
    print_status "INFO" "Building Docker image..."
    if ! docker build --network=host -t "$DOCKER_IMAGE_NAME" .; then
        print_status "ERROR" "Failed to build Docker image"
        exit 1
    fi

    # Stop and remove existing container
    docker stop "$DOCKER_IMAGE_NAME" 2>/dev/null || true
    docker rm "$DOCKER_IMAGE_NAME" 2>/dev/null || true

    # Run new container
    docker run -d \
        --name "$DOCKER_IMAGE_NAME" \
        --restart unless-stopped \
        -p 8000:8000 \
        -v todo_data:/home/app/data \
        "$DOCKER_IMAGE_NAME"

    print_status "SUCCESS" "Docker deployment completed"
}

# Health check
health_check() {
    print_status "STEP" "Running health check..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
            print_status "SUCCESS" "Health check passed! Application is running."
            echo ""
            echo -e "${GREEN}🌐 Application is available at:${NC}"
            echo "   http://localhost:8000"
            local ip
            ip=$(hostname -I | awk '{print $1}')
            if [ -n "$ip" ]; then
                echo "   http://$ip:8000"
            fi
            echo ""
            return 0
        fi

        print_status "INFO" "Attempt $attempt/$max_attempts failed, retrying in 2s..."
        sleep 2
        ((attempt++))
    done

    print_status "ERROR" "Health check failed after $max_attempts attempts"
    return 1
}

# Auto-detect current deployment and update
auto_update() {
    print_status "STEP" "Auto-detecting current deployment method..."

    # Check for systemd service
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "INFO" "Detected systemd deployment, updating..."
        deploy_systemd_flow
        return
    fi

    # Check for Docker container
    if docker ps --format "{{.Names}}" | grep -q "$DOCKER_IMAGE_NAME"; then
        print_status "INFO" "Detected Docker deployment, updating..."
        deploy_docker_prebuilt
        return
    fi

    print_status "WARN" "No existing deployment detected"
    print_status "INFO" "Available deployment methods:"
    show_usage
    exit 1
}

# Complete systemd deployment flow
deploy_systemd_flow() {
    local mode
    mode=$(detect_deployment_mode)

    if [ "$mode" = "local" ]; then
        use_local_code
    else
        update_code_remote
    fi

    build_local
    deploy_systemd
}

# Complete Docker deployment flow
deploy_docker_flow() {
    local mode
    mode=$(detect_deployment_mode)

    if [ "$mode" = "local" ]; then
        use_local_code
    else
        update_code_remote
    fi

    deploy_docker_prebuilt
}

# Complete local Docker build flow
deploy_docker_local_flow() {
    local mode
    mode=$(detect_deployment_mode)

    if [ "$mode" = "local" ]; then
        use_local_code
    else
        update_code_remote
    fi

    deploy_docker_local
}

# Show usage information
show_usage() {
    echo -e "${CYAN}Usage: sudo \$0 [method] [environment]${NC}"
    echo ""
    echo -e "${YELLOW}Available deployment methods:${NC}"
    echo "  systemd       - Deploy as systemd service"
    echo "  docker        - Deploy using Docker with GitHub pre-built image"
    echo "  docker-local  - Deploy using Docker with local build"
    echo "  docker-compose- Deploy using docker-compose"
    echo "  monitoring    - Start monitoring stack for systemd deployment"
    echo "  full-stack    - Deploy application + monitoring (Docker Compose)"
    echo "  update        - Auto-detect and update existing deployment"
    echo "  dev           - Start development servers"
    echo "  dev-clean     - Stop all deployments and start development servers"
    echo ""
    echo -e "${YELLOW}Available environments:${NC}"
    echo "  production    - Production deployment (default)"
    echo "  staging       - Staging deployment"
    echo "  development   - Development deployment"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  sudo $0 systemd production     # Deploy as system service"
    echo "  sudo $0 docker                 # Use pre-built Docker image"
    echo "  sudo $0 docker-local staging   # Build Docker image locally for staging"
    echo "  sudo $0 update                 # Update existing deployment"
    echo "  $0 dev                         # Start development servers (no sudo needed)"
    echo "  $0 dev-clean                   # Stop all services and start dev mode"
}

# Development mode (no sudo required)
start_dev() {
    print_status "STEP" "Starting development servers..."

    # Check for port conflicts first
    if netstat -tulpn 2>/dev/null | grep -q ":8000 "; then
        print_status "ERROR" "Port 8000 is already in use!"
        echo ""
        echo "Possible conflicts:"

        # Check systemd service
        if systemctl is-active --quiet todo-app 2>/dev/null; then
            print_status "WARN" "systemd service 'todo-app' is running"
            echo "  Stop it with: sudo systemctl stop todo-app"
        fi

        # Check Docker container
        if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^todo-app$"; then
            print_status "WARN" "Docker container 'todo-app' is running"
            echo "  Stop it with: docker stop todo-app"
        fi

        echo ""
        echo "Current process using port 8000:"
        netstat -tulpn 2>/dev/null | grep ":8000 " | head -1
        exit 1
    fi

    cd "$PROJECT_ROOT"

    # Check if we're in the right directory
    if [ ! -f "server-rs/Cargo.toml" ] || [ ! -f "web/package.json" ]; then
        print_status "ERROR" "Not in a valid project directory"
        exit 1
    fi

    print_status "INFO" "Backend will be available at: http://localhost:8000"
    print_status "INFO" "Frontend will be available at: http://localhost:5173"
    print_status "INFO" "Press Ctrl+C to stop both servers"
    echo ""

    # Start both servers in background
    (cd server-rs && cargo run) &
    backend_pid=$!

    (cd web && npm run dev) &
    frontend_pid=$!

    # Wait for either to exit
    wait $backend_pid $frontend_pid
}

# Clean development mode - stop all services first
start_dev_clean() {
    print_status "STEP" "Stopping all services and starting development mode..."

    # Stop systemd service if running
    if systemctl is-active --quiet todo-app 2>/dev/null; then
        print_status "INFO" "Stopping systemd service..."
        if [[ $EUID -eq 0 ]]; then
            systemctl stop todo-app
        else
            sudo systemctl stop todo-app
        fi
        print_status "SUCCESS" "Systemd service stopped"
    fi

    # Stop Docker containers
    if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^todo-app$"; then
        print_status "INFO" "Stopping Docker container..."
        docker stop todo-app >/dev/null 2>&1
        print_status "SUCCESS" "Docker container stopped"
    fi

    # Stop monitoring stacks
    if [ -f "$PROJECT_ROOT/deploy/docker-compose.monitoring.yml" ]; then
        docker-compose -f "$PROJECT_ROOT/deploy/docker-compose.monitoring.yml" down >/dev/null 2>&1
    fi
    if [ -f "$PROJECT_ROOT/deploy/docker-compose.monitoring-only.yml" ]; then
        docker-compose -f "$PROJECT_ROOT/deploy/docker-compose.monitoring-only.yml" down >/dev/null 2>&1
    fi

    print_status "SUCCESS" "All services stopped, starting development mode..."
    echo ""

    # Now start development mode
    start_dev
}

# Deploy monitoring stack for systemd deployment
deploy_monitoring() {
    print_status "STEP" "Deploying monitoring stack for systemd deployment..."

    local mode
    mode=$(detect_deployment_mode)

    if [ "$mode" = "local" ]; then
        cd "$PROJECT_ROOT"
    else
        update_code_remote
        cd "$DEPLOY_DIR"
    fi

    # Check if systemd service is running
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "ERROR" "systemd service is not running. Deploy it first:"
        print_status "INFO" "sudo $0 systemd"
        exit 1
    fi

    if [ ! -f "deploy/docker-compose.monitoring-only.yml" ]; then
        print_status "ERROR" "docker-compose.monitoring-only.yml not found"
        exit 1
    fi

    # Create logs directory for systemd service
    mkdir -p /opt/todo-app/logs
    chown app:app /opt/todo-app/logs

    # Stop existing monitoring containers
    docker-compose -f deploy/docker-compose.monitoring-only.yml down 2>/dev/null || true

    # Start monitoring stack
    if docker-compose -f deploy/docker-compose.monitoring-only.yml up -d; then
        print_status "SUCCESS" "Monitoring stack deployed successfully"
        echo ""
        echo -e "${GREEN}📊 Monitoring URLs:${NC}"
        echo "   Grafana:    http://localhost:3000 (admin/admin)"
        echo "   Prometheus: http://localhost:9090"
        echo "   Application: http://localhost:8000"
    else
        print_status "ERROR" "Monitoring stack deployment failed"
        exit 1
    fi
}

# Deploy full stack with monitoring (Docker Compose)
deploy_full_stack() {
    print_status "STEP" "Deploying full stack with monitoring using Docker Compose..."

    local mode
    mode=$(detect_deployment_mode)

    if [ "$mode" = "local" ]; then
        cd "$PROJECT_ROOT"
    else
        update_code_remote
        cd "$DEPLOY_DIR"
    fi

    if [ ! -f "deploy/docker-compose.monitoring.yml" ]; then
        print_status "ERROR" "docker-compose.monitoring.yml not found"
        exit 1
    fi

    # Stop existing containers
    docker-compose -f deploy/docker-compose.monitoring.yml down 2>/dev/null || true

    # Start full stack
    if docker-compose -f deploy/docker-compose.monitoring.yml up -d; then
        print_status "SUCCESS" "Full stack deployment completed"
        echo ""
        echo -e "${GREEN}📊 Full Stack URLs:${NC}"
        echo "   Application: http://localhost:8000"
        echo "   Grafana:     http://localhost:3001 (admin/admin)"
        echo "   Prometheus:  http://localhost:9090"
    else
        print_status "ERROR" "Full stack deployment failed"
        exit 1
    fi
}

# Deploy using docker-compose
deploy_compose() {
    print_status "STEP" "Deploying using docker-compose..."

    local mode
    mode=$(detect_deployment_mode)

    if [ "$mode" = "local" ]; then
        cd "$PROJECT_ROOT"
    else
        update_code_remote
        cd "$DEPLOY_DIR"
    fi

    if [ ! -f "docker-compose.yml" ]; then
        print_status "ERROR" "docker-compose.yml not found"
        exit 1
    fi

    # Stop existing containers
    docker-compose down 2>/dev/null || true

    # Start new containers
    if docker-compose up -d; then
        print_status "SUCCESS" "Docker Compose deployment completed"
    else
        print_status "ERROR" "Docker Compose deployment failed"
        exit 1
    fi
}

# Main deployment logic
main() {
    case "$DEPLOY_METHOD" in
        "systemd")
            check_permissions
            deploy_systemd_flow
            health_check
            ;;
        "docker")
            deploy_docker_flow
            health_check
            ;;
        "docker-local")
            deploy_docker_local_flow
            health_check
            ;;
        "docker-compose")
            check_permissions
            deploy_compose
            health_check
            ;;
        "monitoring")
            check_permissions
            deploy_monitoring
            ;;
        "full-stack")
            check_permissions
            deploy_full_stack
            health_check
            ;;
        "update")
            check_permissions
            auto_update
            health_check
            ;;
        "dev")
            # Development mode doesn't need sudo
            start_dev
            ;;
        "dev-clean")
            # Clean development mode
            start_dev_clean
            ;;
        "")
            show_usage
            ;;
        *)
            print_status "ERROR" "Unknown deployment method: $DEPLOY_METHOD"
            show_usage
            exit 1
            ;;
    esac

    if [ "$DEPLOY_METHOD" != "dev" ] && [ "$DEPLOY_METHOD" != "" ]; then
        print_status "SUCCESS" "Deployment completed successfully! 🎉"
        echo ""
        echo -e "${GREEN}🎯 Quick Actions:${NC}"
        echo "  - Check status: ./deploy/status.sh"
        echo "  - View logs: sudo journalctl -u todo-app -f"
        echo "  - Update: sudo $0 update"
        echo "  - Restart: sudo systemctl restart todo-app"
    fi
}

# Trap to cleanup on error
trap 'print_status "ERROR" "Deployment failed at line $LINENO"' ERR

main "$@"
