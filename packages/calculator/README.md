# Adding a New Package

This guide documents the steps required to add a new TypeScript package to this Bazel-managed monorepo, using `packages/calculator` as an example.

## 1. Create Package Directory and Files

Create a new directory for your package (e.g., `packages/my-package`) and add the following files:

### `package.json`
Define the package name and entry point.
```json
{
    "name": "@myorg/my-package",
    "version": "0.0.0",
    "main": "index.js",
    "types": "index.d.ts"
}
```

### `index.ts`
Add your source code.
```typescript
export const hello = () => "Hello from my-package";
```

### `BUILD.bazel`
Define the build targets. You need a `ts_project` to compile the TypeScript and an `npm_package` to package it for linking.

```starlark
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@aspect_rules_js//npm:defs.bzl", "npm_package")

ts_project(
    name = "my-package",
    srcs = ["index.ts"],
    tsconfig = "//:tsconfig_build",
    source_map = True,
    declaration = True,
    transpiler = "tsc",
    visibility = ["//visibility:public"],
)

npm_package(
    name = "pkg",
    package = "@myorg/my-package",
    srcs = [
        "package.json",
        ":my-package",
    ],
    visibility = ["//visibility:public"],
)
```

## 2. Link the Package

Update the root `BUILD.bazel` to link the new package into `node_modules`.

```starlark
load("@aspect_rules_js//npm:defs.bzl", "npm_link_package")

npm_link_package(
    name = "node_modules/@myorg/my-package",
    src = "//packages/my-package:pkg",
)
```

## 3. Use the Package

### In Build Targets (`BUILD.bazel`)
Add the linked package to the `deps` of the consuming target.

```starlark
ts_project(
    name = "app",
    # ...
    deps = [
        "//:node_modules/@myorg/my-package",
    ],
)
```

### In Source Code (`.ts` / `.tsx`)
Import it using the package name defined in `package.json`.

```typescript
import { hello } from '@myorg/my-package';
```

### In Runtime (Browser)
If the package is used in a browser application (like `src/index.html`), you must add it to the import map so the browser knows where to find the file.

```html
<script type="importmap">
{
    "imports": {
        "@myorg/my-package": "/node_modules/@myorg/my-package/index.js"
    }
}
</script>
```

And ensure the package is included in the `assets` filegroup of your server target so it is served.

```starlark
filegroup(
    name = "assets",
    srcs = [
        # ...
        "//:node_modules/@myorg/my-package",
    ],
)
```
