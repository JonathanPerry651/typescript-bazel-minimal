#!/bin/bash
set -e

# Start the server in the background
echo "Starting server..."
./src/java_server &
SERVER_PID=$!

# Function to kill server on exit
cleanup() {
  echo "Stopping server..."
  kill $SERVER_PID
}
trap cleanup EXIT

# Wait for server to be up
echo "Waiting for server..."
while ! nc -z localhost 8080; do   
  sleep 0.1
done
echo "Server is up!"

# Run Cypress
echo "Running Cypress..."
# The binary is located at e2e/cypress_runner_/cypress_runner based on find output
./e2e/cypress_runner_/cypress_runner run --config-file cypress.config.js
