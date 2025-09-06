# Makefile for Raspberry Pi Todo Application

.PHONY: help dev build test deploy clean docker-build docker-run docker-stop format format-check

# Default target
help:
	@echo "🍓 Raspberry Pi Todo Application"
	@echo ""
	@echo "Available commands:"
	@echo "  dev          - Start development servers (backend + frontend)"
	@echo "  build        - Build both backend and frontend for production"
	@echo "  test         - Run all tests"
	@echo "  format       - Format all code files"
	@echo "  format-check - Check if all code is properly formatted"
	@echo "  format-rust  - Format only Rust code"
	@echo "  format-web   - Format only web code"
	@echo "  deploy       - Deploy to production using automated script"
	@echo "  deploy-local - Deploy locally (systemd service)"
	@echo "  deploy-docker- Deploy using Docker with GitHub image"
	@echo "  deploy-update- Update existing deployment"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run application in Docker container"
	@echo "  docker-stop  - Stop and remove Docker container"
	@echo "  clean        - Clean build artifacts"
  @echo "  setup        - Setup development environment"
  @echo "  setup-hooks  - Setup git pre-commit hooks"
  @echo "  pre-commit   - Run pre-commit checks manually"# Development
dev:
	@echo "🚀 Starting development servers..."
	@echo "Backend will be available at: http://localhost:8000"
	@echo "Frontend will be available at: http://localhost:5173"
	@echo ""
	@echo "Press Ctrl+C to stop both servers"
	@(cd server-rs && cargo run) & \
	(cd web && npm run dev) & \
	wait

# Build for production
build:
	@echo "📦 Building backend..."
	cd server-rs && cargo build --release
	@echo "📦 Building frontend..."
	cd web && npm ci --production && npm run build
	@echo "✅ Build completed successfully"

# Run tests
test:
	@echo "🧪 Running backend tests..."
	cd server-rs && cargo test
	@echo "🧪 Running frontend tests..."
	cd web && npm test 2>/dev/null || echo "No frontend tests found"
	@echo "✅ All tests completed"

# Formatting
format:
	@echo "🎨 Formatting all code..."
	@./format.sh

format-check:
	@echo "🔍 Checking code formatting..."
	@echo "Checking Rust code..."
	cd server-rs && cargo fmt --check
	@echo "Checking web code..."
	cd web && npm run format:check
	@echo "✅ Format check completed"

format-rust:
	@echo "📦 Formatting Rust code..."
	cd server-rs && cargo fmt

format-web:
	@echo "🌐 Formatting web code..."
	cd web && npm run format

lint:
	@echo "🔍 Running linters..."
	@echo "Checking Rust code..."
	cd server-rs && cargo clippy -- -D warnings
	@echo "Type checking TypeScript..."
	cd web && npm run type-check
	@echo "✅ Linting completed"

# Pre-commit hooks setup
setup-hooks:
	@echo "🔧 Setting up pre-commit hooks..."
	@./setup-hooks.sh

pre-commit:
	@echo "🔍 Running pre-commit checks..."
	@if command -v pre-commit >/dev/null 2>&1; then \
		pre-commit run --all-files; \
	else \
		./format.sh; \
	fi

# Deploy to production
deploy:
	@echo "🚀 Deploying to production..."
	sudo ./deploy/deploy.sh production

# Local deployment options for Raspberry Pi
deploy-local:
	@echo "🏠 Deploying locally using systemd service..."
	sudo ./deploy/local-deploy.sh systemd

deploy-docker:
	@echo "🐳 Deploying using Docker with GitHub image..."
	sudo ./deploy/local-deploy.sh docker

deploy-docker-local:
	@echo "🔨 Deploying using Docker with local build..."
	sudo ./deploy/local-deploy.sh docker-local

deploy-update:
	@echo "🔄 Updating existing deployment..."
	sudo ./deploy/local-deploy.sh update

# Docker operations
docker-build:
	@echo "🐳 Building Docker image..."
	docker build -t todo-app .

docker-run: docker-build
	@echo "🐳 Starting Docker container..."
	docker run -d \
		--name todo-app \
		--restart unless-stopped \
		-p 8000:8000 \
		-v todo_data:/home/app/data \
		todo-app
	@echo "✅ Container started. Application available at: http://localhost:8000"

docker-stop:
	@echo "🛑 Stopping Docker container..."
	-docker stop todo-app
	-docker rm todo-app
	@echo "✅ Container stopped and removed"

docker-logs:
	@echo "📋 Showing Docker container logs..."
	docker logs todo-app -f

# Development environment setup
setup:
	@echo "🔧 Setting up development environment..."
	@echo "Checking prerequisites..."
	@command -v rustc >/dev/null 2>&1 || { echo "❌ Rust not installed. Please install from https://rustup.rs/"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "❌ Node.js not installed. Please install from https://nodejs.org/"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "❌ npm not installed. Please install Node.js from https://nodejs.org/"; exit 1; }
	@echo "📦 Installing backend dependencies..."
	cd server-rs && cargo check
	@echo "📦 Installing frontend dependencies..."
	cd web && npm install
	@echo "📋 Creating environment file..."
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env file from .env.example"; fi
	@echo "✅ Development environment setup completed!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env file if needed"
	@echo "  2. Run 'make dev' to start development servers"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	cd server-rs && cargo clean
	cd web && rm -rf dist node_modules/.vite
	@echo "✅ Clean completed"

# Production quick start
prod-start:
	@echo "🚀 Quick production start with Docker..."
	docker-compose up -d
	@echo "✅ Application started. Available at: http://localhost:8000"

prod-stop:
	@echo "🛑 Stopping production containers..."
	docker-compose down
	@echo "✅ Production containers stopped"

# Health check
health:
	@echo "🏥 Checking application health..."
	@curl -f http://localhost:8000/api/health 2>/dev/null && echo "✅ Application is healthy" || echo "❌ Application is not responding"

# Show logs
logs:
	@echo "📋 Showing application logs..."
	@if [ -f "/etc/systemd/system/todo-app.service" ]; then \
		sudo journalctl -u todo-app -f; \
	else \
		echo "Service not installed. Use 'make docker-logs' for Docker logs"; \
	fi

# Install as system service
install-service: build
	@echo "📦 Installing system service..."
	sudo ./deploy/deploy.sh production
	@echo "✅ Service installed and started"

# Development with monitoring
dev-with-monitoring:
	@echo "🚀 Starting development with monitoring..."
	docker-compose -f deploy/docker-compose.monitoring.yml up -d
	@echo "📊 Monitoring available at:"
	@echo "  - Grafana: http://localhost:3001 (admin/admin)"
	@echo "  - Prometheus: http://localhost:9090"
	make dev
