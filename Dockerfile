# Use Node.js 24 with Debian Bookworm Slim
FROM node:24-bookworm-slim

# Set the working directory inside the container
WORKDIR /app

# Enable pnpm using Corepack
RUN corepack enable

# Copy package files first
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install

# Copy the rest of the application
COPY . .

# Expose the port used by the Express server
EXPOSE 5000

# Start the application
CMD ["pnpm", "dev"]