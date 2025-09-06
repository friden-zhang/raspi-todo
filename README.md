# 🍓 Raspberry Pi Todo Application

A modern, full-stack todo application designed specifically for Raspberry Pi, featuring:

- **Rust Backend**: High-performance, memory-safe server using Axum framework
- **React Frontend**: Modern TypeScript-based user interface
- **Real-time Updates**: WebSocket communication for instant synchronization
- **SQLite Database**: Lightweight, embedded database perfect for Pi
- **Docker Support**: Easy containerized deployment
- **Auto-deployment**: CI/CD pipeline for seamless updates

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/friden-zhang/raspi-todo.git
cd raspi-todo
docker-compose up -d
```

Access the application at: <http://localhost:8000>

### Option 2: Local Deployment (Raspberry Pi)

```bash
# Systemd service deployment
sudo ./deploy/local-deploy.sh systemd

# Or Docker deployment
sudo ./deploy/local-deploy.sh docker
```

### Option 3: Development Setup

```bash
# Terminal 1: Start Rust backend
cd server-rs
cargo run

# Terminal 2: Start React frontend
cd web
npm install
npm run dev
```

**📚 For detailed deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## 🏗️ Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          🌐 Web Browser (React SPA)                            │
│                     ┌─────────────────────────────────────┐                     │
│                     │  📱 Admin Panel  │  📋 Display View │                     │
│                     └─────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTP/WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        🦀 Rust Backend (Axum Framework)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  📡 REST API    │  │ 🔌 WebSocket    │  │ 📊 Health Check │  │ 📁 Static   │ │
│  │                 │  │                 │  │                 │  │             │ │
│  │ • GET /todos    │  │ • Real-time     │  │ • /api/health   │  │ • React     │ │
│  │ • POST /todos   │  │   updates       │  │ • Metrics       │  │   Build     │ │
│  │ • PUT /todos    │  │ • Broadcasting  │  │ • Monitoring    │  │ • Assets    │ │
│  │ • DELETE /todos │  │ • Connection    │  │                 │  │             │ │
│  │                 │  │   management    │  │                 │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │ SQLx Queries
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🗃️ SQLite Database                                    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            📋 todos table                              │   │
│  │                                                                         │   │
│  │  • id (PRIMARY KEY)     • status (todo/doing/done)                     │   │
│  │  • title (TEXT)         • priority (0-3)                               │   │
│  │  • note (TEXT)          • due_at (TIMESTAMP)                           │   │
│  │  • created_at           • updated_at                                   │   │
│  │  • deleted (soft delete)                                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 🔄 Real-time Data Flow

```text
User Action → Frontend → REST API → Database → WebSocket → All Connected Clients
```

**📐 For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## 🚢 Deployment

This application supports multiple deployment methods optimized for Raspberry Pi:

- **🐳 Docker Compose** - Recommended for development and testing
- **⚙️ Systemd Service** - Production deployment on Raspberry Pi
- **📊 With Monitoring** - Full observability stack (Grafana + Prometheus)

Quick deployment options:

```bash
# Docker deployment (easiest)
docker-compose up -d

# Production deployment on Raspberry Pi
sudo ./deploy/local-deploy.sh systemd

# With monitoring stack
docker-compose -f deploy/docker-compose.monitoring.yml up -d
```

**📚 For complete deployment instructions, troubleshooting, and production setup, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## 🛠️ Technology Details

## 📁 Project Structure

```
raspi-todo/
├── server-rs/           # Rust backend (Axum + SQLite)
│   ├── src/
│   │   ├── main.rs      # Application entry point
│   │   ├── routes.rs    # REST API endpoints
│   │   ├── model.rs     # Data models
│   │   ├── db.rs        # Database layer
│   │   ├── ws.rs        # WebSocket handling
│   │   └── error.rs     # Error handling
│   └── Cargo.toml       # Rust dependencies
├── web/                 # React frontend (TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx      # Main application component
│   │   ├── types.ts     # TypeScript definitions
│   │   └── pages/       # Page components
│   └── package.json     # Node.js dependencies
├── deploy/              # Deployment configurations
│   ├── deploy.sh        # Automated deployment script
│   ├── todo-app.service # Systemd service
│   ├── nginx.conf       # Reverse proxy config
│   └── README.md        # Deployment guide
├── docs/                # Documentation
│   ├── DEPLOYMENT.md    # Detailed deployment guide
│   ├── ARCHITECTURE.md  # System architecture
│   └── PRE_COMMIT.md    # Code formatting setup
└── docker-compose.yml   # Container orchestration
```

## ✨ Features

### Core Functionality

- ✅ Create, read, update, delete todos
- 🏷️ Priority levels (0-3) and status tracking
- 📅 Due date management
- 🔄 Real-time updates via WebSocket
- 📱 Responsive web interface

### Technical Features

- 🦀 **Rust Backend**: Memory-safe, high-performance server
- ⚛️ **React Frontend**: Modern component-based UI
- 🗄️ **SQLite Database**: Embedded, zero-config database
- 🐳 **Docker Ready**: Containerized deployment
- 🔄 **CI/CD Pipeline**: GitHub Actions automation
- 📊 **Monitoring**: Health checks and observability
- 🔒 **Security**: Non-root execution, input validation

## 🛠️ Technology Stack

### Backend (Rust)

- **Axum**: Modern async web framework
- **Tokio**: Async runtime for high-concurrency
- **SQLx**: Compile-time checked SQL queries
- **Serde**: JSON serialization/deserialization
- **Tracing**: Structured logging

### Frontend (TypeScript/React)

- **React 18**: Modern functional components with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing

### Infrastructure

- **Docker**: Containerization
- **GitHub Actions**: CI/CD pipeline
- **Nginx**: Reverse proxy (optional)
- **Systemd**: Service management

## 🔧 Development

### Prerequisites

- Rust 1.75+ with Cargo
- Node.js 18+ with npm
- SQLite3

### Backend Development

```bash
cd server-rs

# Install dependencies and run
cargo run

# Run tests
cargo test

# Format code
cargo fmt

# Lint code
cargo clippy
```

### Frontend Development

```bash
cd web

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Format code
npm run format

# Type check
npm run type-check
```

### Code Quality

This project uses automated code formatting and quality checks:

```bash
# Setup pre-commit hooks (one-time setup)
make setup-hooks

# Format all code
make format

# Check formatting
make format-check

# Run all linting
make lint

# Manual pre-commit checks
make pre-commit
```

**Pre-commit hooks** automatically run before each commit to:

- Format Rust code with `cargo fmt`
- Format TypeScript/JavaScript with Prettier
- Check TypeScript types
- Validate JSON/YAML syntax
- Fix whitespace and line endings

See [docs/PRE_COMMIT.md](docs/PRE_COMMIT.md) for detailed information.

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: Change port in `.env` file
2. **Permission errors**: Check user permissions with `sudo chown -R app:app /opt/todo-app`
3. **Database locks**: Restart the service with `sudo systemctl restart todo-app`

### Health Checks

```bash
# Application health
curl http://localhost:8000/api/health

# Container health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for the Raspberry Pi community
- Inspired by modern web development practices
- Designed for simplicity and performance

---

**Perfect for Raspberry Pi**: Optimized for ARM64 architecture with minimal resource usage
