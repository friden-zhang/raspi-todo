# Multi-stage build for optimized production image
# Stage 1: Build Rust backend
FROM rust:1.75-slim as rust-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Rust project files
COPY server-rs/Cargo.toml server-rs/Cargo.lock ./server-rs/
COPY server-rs/src ./server-rs/src/

# Build the Rust application in release mode
WORKDIR /app/server-rs
RUN cargo build --release

# Stage 2: Build React frontend
FROM node:18-alpine as web-builder

WORKDIR /app

# Copy package files and install dependencies
COPY web/package.json web/package-lock.json ./web/
WORKDIR /app/web
RUN npm ci --only=production

# Copy source files and build
COPY web/src ./src/
COPY web/index.html web/vite.config.ts web/tsconfig.json ./
RUN npm run build

# Stage 3: Production runtime image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create application user for security
RUN useradd --create-home --shell /bin/bash app
USER app
WORKDIR /home/app

# Copy built applications
COPY --from=rust-builder /app/server-rs/target/release/server-rs ./server
COPY --from=web-builder /app/web/dist ./static

# Create data directory for SQLite database
RUN mkdir -p data

# Expose the application port
EXPOSE 8000

# Set environment variables
ENV RUST_LOG=info
ENV DATABASE_URL=sqlite:./data/todos.db
ENV STATIC_DIR=./static
ENV PORT=8000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start the application
CMD ["./server"]
