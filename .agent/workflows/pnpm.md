---
description: How to run pnpm commands
---

To run pnpm commands in this repository, use the following wrapper:

```bash
# // turbo
bazel run @pnpm -- --dir $PWD <command>
```

Example:
```bash
bazel run @pnpm -- --dir $PWD install
bazel run @pnpm -- --dir $PWD add -D webpack
```
