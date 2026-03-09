# SwiftList Workers Dockerfile
# Runs BullMQ workers on Railway.app

FROM node:20-alpine

# Install dependencies for native modules (GraphicsMagick, Sharp, etc.)
RUN apk add --no-cache \
    graphicsmagick \
    ffmpeg \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy worker source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set user
USER nodejs

# Expose port for health checks
EXPOSE 3000

# Start workers
CMD ["node", "dist/index.js"]
