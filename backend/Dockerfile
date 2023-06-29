# Use the specified Node.js version as the base image
FROM node:19.3.0

# Set the working directory inside the container
WORKDIR /app

# Install the specified npm version globally
RUN npm install -g npm@9.2.0

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the worker.js script to the container
COPY worker.js .

# Specify the command to run the script
CMD ["node", "worker.js"]