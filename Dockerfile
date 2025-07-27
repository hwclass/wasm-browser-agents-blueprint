# Use Node.js as base image
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    python3 \
    python3-pip \
    golang \
    && rm -rf /var/lib/apt/lists/*

# Install Rust and wasm-pack
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Make build scripts executable
RUN chmod +x build.sh \
    && chmod +x demos/hello-agent/rust/build.sh \
    && chmod +x demos/hello-agent/go/build.sh \
    && chmod +x demos/hello-agent/python/build.sh \
    && chmod +x demos/hello-agent/js/build.sh

# Build all WASM modules
RUN ./build.sh

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 5173

# Start the application
CMD ["npm", "run", "dev", "--", "--host"] 