# Minimal TypeScript Bazel Example

This repository demonstrates a completely minimal setup for TypeScript with Bazel using `aspect_rules_ts`, `aspect_rules_js`, and `rules_nodejs`.

## Features
- **Bazel-managed Tooling**: Node.js, pnpm, and TypeScript are managed by Bazel (hermetic).
- **Type Checking**: Configured for type-checking using `ts_project`.
- **Minimal Config**: Only essential configuration files are included.

## Prerequisites
- [Bazelisk](https://github.com/bazelbuild/bazelisk) (recommended) or Bazel 6.0+

## Setup
The repository uses Bzlmod (`MODULE.bazel`) for dependency management.
Dependencies are defined in `package.json` and locked in `pnpm-lock.yaml`.

## Building
To type-check the source code:
```bash
bazel build //src:index
```

## Project Structure
- `MODULE.bazel`: Bazel dependencies and extensions.
- `.bazelrc`: Bazel configuration flags.
- `BUILD.bazel`: Root build file, exports config files.
- `tsconfig.json`: TypeScript configuration.
- `src/`: Source code.
  - `index.ts`: TypeScript entry point.
  - `BUILD.bazel`: Build target for `index.ts`.

## Notes
- This example is configured for **type-checking only** (`noEmit: true` in `tsconfig.json`).
- To enable JavaScript emission, you would need to configure a transpiler (e.g., `tsc` or `swc`) in `ts_project` and update `tsconfig.json`.
