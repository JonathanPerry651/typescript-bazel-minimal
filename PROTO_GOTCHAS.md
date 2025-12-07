# Protobuf & gRPC-Web Compilation Gotchas

This document outlines common pitfalls and "gotchas" encountered when working with Protocol Buffers, gRPC-Web, and Bazel, specifically within a TypeScript environment.

## 1. Runtime Version Mismatch (`readStringRequireUtf8`)

### The Error
You may encounter a runtime error in the browser console similar to:
```
TypeError: r.readStringRequireUtf8 is not a function
```
or
```
TypeError: obj.readString is not a function
```

### The Cause
This is caused by a **mismatch** between the version of the `protoc` compiler used to generate the JavaScript code and the version of the `google-protobuf` runtime library installed in `node_modules`.

*   **Protoc v21+ (and v25+)**: Generates code that utilizes newer methods like `readStringRequireUtf8` for correct UTF-8 handling.
*   **google-protobuf v3.x**: Does **not** contain these methods.
*   **google-protobuf v4.x**: Contains these methods.

In this project, the Bazel toolchain was configured to use a modern `protoc` (v25.3), but `package.json` initially pinned `google-protobuf` to `3.21.2`.

### The Fix
Ensure your runtime library matches the major version of your compiler output.
*   **Upgrade Runtime**: Update `package.json` to use `google-protobuf: ^4.0.0` (or matching `protoc` version).
    ```json
    "dependencies": {
      "google-protobuf": "^4.0.1",
      ...
    }
    ```
*   **Downgrade Compiler**: Alternatively, pin the `protoc` toolchain in `MODULE.bazel` to an older version (e.g., v3.20.x), though this is less recommended as you lose newer features.

## 2. Bazel Toolchain Versions (`toolchains_protoc`)

### The Gotcha
Bazel's `rules_proto` and `toolchains_protoc` abstract away the `protoc` binary. However, they rely on upstream repositories (like `github.com/protocolbuffers/protobuf`) to fetch the compiler.

*   **Missing Versions**: Not all `protoc` versions are available in the default toolchain repositories. Attempting to pin a specific version (e.g., `v21.7`) in `MODULE.bazel` may result in build failures if the toolchain rules don't have a checksum/URL for that specific release.
*   **Lockfile Drift**: `MODULE.bazel.lock` can sometimes hold onto stale toolchain resolutions.

### Best Practice
*   Check the [rules_proto_grpc](https://github.com/rules-proto-grpc/rules_proto_grpc) or `toolchains_protoc` documentation for supported versions.
*   Prefer upgrading the runtime (JavaScript package) over fighting with Bazel to downgrade the compiler binaries.

## 3. Explicit Dependencies in `esbuild`

### The Gotcha
When using `esbuild` with Bazel (via `aspect_rules_esbuild`), the bundler needs explicit access to the runtime libraries sourced from `node_modules`.

*   Simply adding `google-protobuf` to `package.json` is not enough.
*   You must add `//:node_modules/google-protobuf` to the `deps` attribute of your `ts_project` or `esbuild` rule.

```starlark
ts_project(
    name = "app",
    srcs = ["index.ts"],
    deps = [
        "//proto:my_proto_ts",
        "//:node_modules/google-protobuf",  # <--- CRITICAL
        "//:node_modules/grpc-web",
    ],
)
```
Without this, the TypeScript compiler may pass, but the bundler might fail to resolve the module or bundle a duplicate/incorrect version.
