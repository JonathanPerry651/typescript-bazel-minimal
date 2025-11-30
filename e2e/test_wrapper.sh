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

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..30}; do
  if curl -s http://localhost:8080 > /dev/null; then
    echo "Server is up!"
    break
  fi
  sleep 1
done

# Run Cypress
echo "Running Cypress..."
# The binary is located at e2e/cypress_runner_/cypress_runner based on find output
./e2e/cypress_runner_/cypress_runner run --config-file cypress.config.js
