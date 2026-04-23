FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Expose the correct port matching server.js fallback
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
