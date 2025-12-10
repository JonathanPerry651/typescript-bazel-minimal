#!/bin/bash
set -e


# --- Runfiles Helper ---
# See https://github.com/bazelbuild/bazel/blob/master/tools/bash/runfiles/runfiles.bash
if [[ -f "${RUNFILES_DIR:-/dev/null}/bazel_tools/tools/bash/runfiles/runfiles.bash" ]]; then
  source "${RUNFILES_DIR}/bazel_tools/tools/bash/runfiles/runfiles.bash"
elif [[ -f "$0.runfiles/bazel_tools/tools/bash/runfiles/runfiles.bash" ]]; then
  source "$0.runfiles/bazel_tools/tools/bash/runfiles/runfiles.bash"
else
  echo >&2 "ERROR: cannot find @bazel_tools//tools/bash/runfiles/runfiles.bash"
  exit 1
fi
# --- End Runfiles Helper ---

# Locate Binaries
KIND=$(rlocation typescript_bazel_minimal/bin/kind)
KUBECTL=$(rlocation typescript_bazel_minimal/bin/kubectl)
PLAYWRIGHT=$(rlocation typescript_bazel_minimal/e2e/playwright_bin_test_/playwright_bin_test)

# Locate Artifacts
GATEWAY_TAR=$(rlocation typescript_bazel_minimal/services/gateway/gateway.tar)
GREETER_TAR=$(rlocation typescript_bazel_minimal/services/greeter/greeter.tar)
CALCULATOR_TAR=$(rlocation typescript_bazel_minimal/services/calculator/calculator.tar)
ENVOY_TAR=$(rlocation typescript_bazel_minimal/envoy/envoy.tar)
DEPLOYMENT_YAML=$(rlocation typescript_bazel_minimal/k8s/deployment.yaml)

# Ensure binaries are executable (bazel might strip permissions in data path?)
chmod +x "$KIND" "$KUBECTL"

# Setup Kind
# Use a unique cluster name to avoid collisions if running locally?
# For now, stick to "kind" or "e2e-test"
CLUSTER_NAME="e2e-test-bazel"

cleanup() {
  echo "Cleaning up..."
  "$KIND" delete cluster --name "$CLUSTER_NAME" || true
}
trap cleanup EXIT

# Create Cluster
if ! "$KIND" get clusters | grep -q "$CLUSTER_NAME"; then
  echo "Creating Kind cluster '$CLUSTER_NAME' (using podman)..."
  export KIND_EXPERIMENTAL_PROVIDER=podman
  "$KIND" create cluster --name "$CLUSTER_NAME"
fi

# Load Images
echo "Loading images..."
"$KIND" load image-archive "$GATEWAY_TAR" --name "$CLUSTER_NAME"
"$KIND" load image-archive "$GREETER_TAR" --name "$CLUSTER_NAME"
"$KIND" load image-archive "$CALCULATOR_TAR" --name "$CLUSTER_NAME"
"$KIND" load image-archive "$ENVOY_TAR" --name "$CLUSTER_NAME"

# Apply Deployment
echo "Applying deployment..."
"$KUBECTL" --context "kind-$CLUSTER_NAME" apply -f "$DEPLOYMENT_YAML"

# Wait for Rollout
echo "Waiting for rollout..."
"$KUBECTL" --context "kind-$CLUSTER_NAME" rollout status deployment/greeter-app --timeout=60s

# Port Forward
echo "Setting up port forwarding..."
POD_NAME=$("$KUBECTL" --context "kind-$CLUSTER_NAME" get pods -l app=greeter -o jsonpath="{.items[0].metadata.name}")

# Pick a random port to avoid collisions
LOCAL_PORT=$(shuf -i 20000-30000 -n 1)
echo "Using local port: $LOCAL_PORT"

"$KUBECTL" --context "kind-$CLUSTER_NAME" port-forward "$POD_NAME" "$LOCAL_PORT":8080 &
PF_PID=$!

# Update trap
trap "kill $PF_PID || true; cleanup" EXIT

# Wait for PF
sleep 5

# Run Playwright
echo "Running Playwright..."
# Connection usually works, but if port forward fails silently, playwright will fail.
export BASE_URL="http://localhost:$LOCAL_PORT"
"$PLAYWRIGHT" test e2e/example.spec.ts --config e2e/playwright.config.ts


