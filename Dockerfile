# Dockerfile
# Use a clean, official Node.js image as the base
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json and install dependencies
# We use COPY and RUN separately to leverage Docker caching
COPY package.json package-lock.json ./

# **CRITICAL FIX:** Install dependencies using the legacy flag to bypass ERESOLVE error
RUN npm install --legacy-peer-deps

# Copy the rest of the application files (includes /src and /tests)
COPY . .

# Command to run the test: (This will be overridden by Docker Compose)
CMD [ "node", "tests/test_connection_leak.js" ]
