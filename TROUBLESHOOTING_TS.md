# TypeScript Dependency Troubleshooting in Bazel

This guide outlines common issues and solutions when working with TypeScript dependencies in this Bazel workspace, particularly involving gRPC and third-party npm packages.

## 1. "Cannot find module" Errors

### npm Packages
If `tsc` cannot find an import like `import React from 'react';`:
1.  **Check `BUILD.bazel`**: Ensure the npm package is listed in the `deps` attribute of your `ts_project` or `js_library`.
    ```starlark
    ts_projectXB
        name = "lib",
        srcs = ["index.ts"],
        deps = [
            "//:node_modules/react",
            "//:node_modules/@types/react",
        ],
    )
    ```
2.  **Check `package.json`**: Ensure the package is present in `package.json`.
3.  **Check Lockfile**: If you added a new package, you may need to repin the lockfile. Bazel uses `pnpm-lock.yaml` via `npm_translate_lock`.
    - Run: `Bazel run @unpinned_npm//:pnpm -- install` (or similar depending on setup) to update the lockfile if it's not manual.

### Generated Proto/gRPC Code
If `tsc` fails to find generated proto imports (e.g., `google/rpc/status_pb`):
1.  **Check Proto Library Deps**: The `js_grpc_web_library` rule must explicitly include the proto definition that provides the file.
    - *Example*: `google.rpc.Status` requires `@googleapis//google/rpc:status_proto`.
    ```starlark
    js_grpc_web_libraryXB
        name = "calculator_js_grpc_web",
        protos = [
            ":calculator_proto",
            "@googleapis//google/rpc:status_proto",  # <--- REQUIRED for google.rpc.Status
        ],
    )
    ```
2.  **Verify Output**: Run `bazelTc build //path/to:target` and inspect `bazel-bin`.
    - Generated JS files usually live in `bazel-bin/external/...` or `bazel-bin/proto/...`.

## 2. Pnpm Lockfile Issues
`rules_js` relies on `pnpm-lock.yaml`.
- **Mismatch**: If `package.json` changes but `pnpm-lock.yaml` is old, Bazel might fail or fetch old versions.
- **Manual Edits**: If you manually edit `pnpm-lock.yaml`, ensure the structure matches what `rules_js` expects (v6 format is common).
- **Bazel Trace**: Use `bazel mod graph` to see if transitive dependencies (like `rules_rust` pulled in by `rules_proto_grpc`) are confusing the graph, though this affects Bazel modules more than npm packages.

## 3. Absolute vs Relative Imports
This workspace uses absolute imports mapping to the workspace root.
- **Error**: `Cannot find module '../../proto/...'`
- **Fix**: Switch to absolute paths: `import ... from 'typescript_bazel_minimal/proto/...'`.
- **Why**: Bazel's sandbox layout works best when imports mirror the workspace structure.

## 4. Debugging Tips
- **Sandbox Debugging (Critical for Absolute Paths)**: 
    - **Command**: `bazel build --sandbox_debug //packages/calculator:bundle`
    - **Action**: When the build fails, Bazel prints the path to the sandbox (e.g., `~/.cache/bazel/.../sandbox/linux-sandbox/1/execroot/_main`).
    - **Inspection**:
        1.  `cd` into that directory.
        2.  Check for the presence of a symlink matching your workspace name (e.g., `typescript_bazel_minimal`).
            - **Expected**: `ls -l typescript_bazel_minimal` should point to `.`.
        3.  If this symlink exists, absolute imports like `import ... from 'typescript_bazel_minimal/packages/...'` work because Node resolve walks up, hits the sandbox root, sees the folder `typescript_bazel_minimal`, and resolves the path.
        4.  If imports fail, verify that `tsconfig.json` paths or `node_modules` linkage isn't shadowing this behavior.

## Debugging Module Resolution

### 1. Identify which tool is failing
*   **`ts_project` error**: Usually `error TS2307: Cannot find module...`
    *   **Cause**: The TypeScript compiler (`tsc`) cannot find the `.d.ts` type definition files.
    *   **Fix**:
        1.  Check `deps`: Ensure the target is listed in `deps`.
        2.  Check `sandbox`: Run with `--sandbox_debug` and check if the file exists in the sandbox root.
        3.  Check `paths`: Verify `tsconfig.json` `paths` mapping covers the import.

*   **`esbuild` error**: Usually `[error] Could not resolve "..."`
    *   **Cause**: The bundler cannot find the actual `.js` files at runtime/bundle-time.
    *   **Fix**:
        1.  Check `deps`: Ensure the target (and its transitive deps) provides JS files.
        2.  **Verbose Logs**: Use a `config` file with `logLevel: 'verbose'` and run `bazel build --output_filter='.*' //path/to:target` to see where it's looking.
        3.  **Inspect Sandbox**: Run with `--sandbox_debug` and look into `bazel-bin/packages/calculator/node_modules` (or similar links).

### 5. Configured `paths` but Missing Symlink?
If you have `"paths": { "my_workspace/*": ["./*"] }` in `tsconfig.json` but debugging shows no `my_workspace` symlink:
1.  **Check `baseUrl`**: `paths` are relative to `baseUrl`. Ensure `"baseUrl": "."` (or correct root) is set in `tsconfig.json`.
2.  **Check Inputs (`srcs`)**: The files you are trying to import MUST be listed in the `srcs` or `deps` of the `ts_project` rule. If they aren't inputs, they won't be copied to the sandbox, so `tsc` won't find them even if the path mapping is correct.
3.  **Virtual Roots**: If using `root_dir` in `ts_project`, file locations in the sandbox might look different. Use `--sandbox_debug` to inspect the actual directory structure `tsc` sees.
- **Verbose Output**: Use `bazel build -s` to see the exact commands (including `tsc` arguments) being executed.
- **Resolve Json**: If you see errors about `package.json` resolution, ensure `resolveJsonModule` is set in `tsconfig.json` and the json file is in `srcs`.
