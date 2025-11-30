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
- `MODULE.bazel`: Bazel dependencies and extensions (Bzlmod).
- `.bazelrc`: Bazel configuration flags.
- `BUILD.bazel`: Root build file, exports config files and defines root targets.
- `tsconfig.json`: TypeScript configuration for the IDE.
- `tsconfig.build.json`: TypeScript configuration for Bazel builds (enables emission).
- `cypress.config.js`: Cypress configuration file.
- `src/`: Application source code.
  - `index.tsx`: React application entry point.
  - `index.html`: HTML template with JSPM import map.
  - `SimpleWebServer.java`: Hermetic Java web server for testing.
  - `BUILD.bazel`: Build targets for the app and server.
- `cypress/`: Cypress test files.
  - `e2e/`: End-to-end test specifications.
  - `support/`: Cypress support files and commands.
  - `tsconfig.json`: TypeScript config for Cypress tests.
- `e2e/`: Bazel test targets for end-to-end testing.
  - `BUILD.bazel`: Defines the `cypress_test` and `sh_test` targets.
  - `test_wrapper.sh`: Script to manage server lifecycle during tests.

## Notes
- This example is configured for **React** and **JavaScript emission**.
- `tsconfig.json` is set to `noEmit: true` for IDE support, but `tsconfig.build.json` enables emission for Bazel builds.

## Managing TypeScript Dependencies

This guide explains how to add and manage TypeScript dependencies in this Bazel project.

### 1. Add Dependencies to `package.json`

Add your dependencies to `package.json` just like a normal Node.js project.

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  "devDependencies": {
    "@types/react": "18.2.0",
    "@types/react-dom": "18.2.0"
  }
}
```

### 2. Update the Lockfile

After modifying `package.json`, you must update `pnpm-lock.yaml`. **Do not run `pnpm install` or `npm install` directly on your machine.** Instead, use the Bazel-managed pnpm tool to ensure consistency.

Run the following command from the workspace root:

```bash
bazel run @pnpm//:pnpm -- install --dir $PWD
```

This command runs `pnpm install` inside the Bazel environment but writes the changes back to your workspace (`$PWD`).

### 3. Expose Dependencies in `BUILD.bazel`

To use the new dependencies in your TypeScript code, you must add them to the `deps` attribute of your `ts_project` rule in `src/BUILD.bazel`.

The dependencies are available under the `//:node_modules` package.

```starlark
ts_project(
    name = "index",
    srcs = ["index.tsx"],
    deps = [
        "//:node_modules/react",
        "//:node_modules/react-dom",
        "//:node_modules/@types/react",
        "//:node_modules/@types/react-dom",
    ],
    ...
)
```

### Troubleshooting

#### "Cannot find module" errors
If you see errors like `Cannot find module 'foo'`, ensure that:
1. The package is in `package.json`.
2. The lockfile is updated.
3. The package is listed in `deps` in `BUILD.bazel`.
4. If it's a type definition (e.g., `@types/foo`), it must also be in `deps`.

#### "Repository ... is not defined"
If you encounter Bazel errors about missing repositories after updating dependencies, try cleaning the cache:

```bash
bazel clean --expunge
```
