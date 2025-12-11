load("@rules_proto_grpc_js//:defs.bzl", "js_grpc_web_library")
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

def _generate_index_ts_impl(ctx):
    proto_files = []
    for dep in ctx.attr.deps:
        if ProtoInfo in dep:
            proto_files.extend(dep[ProtoInfo].direct_sources)
            
    pb_target_name = ctx.attr.pb_target_name
    output_file = ctx.actions.declare_file(ctx.attr.output_name + "/index.ts")
    
    # Create a manifest file mapping source path to export base path
    manifest_lines = []
    
    for f in proto_files:
        path = f.short_path
        
        # Normalize path if external
        if path.startswith("../"):
            parts = path.split("/")
            path = "/".join(parts[2:])
        
        if path.endswith(".proto"):
            base_path = path[:-6]
        else:
            base_path = path

        # Construct export base path (e.g. '../target_pb/base')
        export_base = "../%s_pb/%s" % (pb_target_name, base_path)
        
        # Manifest format: SOURCE_SHORT_PATH EXPORT_BASE
        # We use f.path (exec path) for the shell script to find the file
        manifest_lines.append("%s %s" % (f.path, export_base))

    manifest_file = ctx.actions.declare_file(ctx.attr.output_name + "_manifest.txt")
    ctx.actions.write(output=manifest_file, content="\n".join(manifest_lines) + "\n")
    
    # Shell command to generate index.ts
    command = """
    echo "// Generated exports for {name}" > {output}
    while read -r source export_base; do
        echo "export * from '${{export_base}}_pb';" >> {output}
        # Check if file defines a service (simple regex)
        # Use simple grep to check for "service ServiceName"
        # Use [[:space:]] for portability in strict bazel environments
        if grep -q "^[[:space:]]*service[[:space:]]" "$source"; then
            echo "export * from '${{export_base}}_grpc_web_pb';" >> {output}
        fi
    done < {manifest}
    """.format(
        name = ctx.attr.name,
        output = output_file.path,
        manifest = manifest_file.path
    )
    
    ctx.actions.run_shell(
        outputs = [output_file],
        inputs = proto_files + [manifest_file],
        command = command,
        mnemonic = "GenerateGrpcWebIndex"
    )
    
    return [DefaultInfo(files = depset([output_file]))]

_generate_index_ts = rule(
    implementation = _generate_index_ts_impl,
    attrs = {
        "deps": attr.label_list(providers = [ProtoInfo]),
        "pb_target_name": attr.string(mandatory = True),
        "output_name": attr.string(mandatory = True),
    },
)

def wrapped_js_grpc_web_library(name, protos, **kwargs):
    pb_name = name + "_pb"
    js_grpc_web_library(
        name = pb_name,
        protos = protos,
        **kwargs
    )

    # Use custom rule for index generation
    _generate_index_ts(
        name = name + "_gen_index",
        deps = protos,
        pb_target_name = pb_name,
        output_name = name,
    )

    ts_project(
        name = name,
        srcs = [name + "_gen_index"], # The rule outputs the file
        declaration = True,
        deps = [
            ":" + pb_name,
            "//:node_modules/@types/google-protobuf",
            "//:node_modules/grpc-web",
            "//:node_modules/google-protobuf",
        ],
        tsconfig = "//:tsconfig_build",
        transpiler = "tsc",
        source_map = True,
        visibility = ["//visibility:public"],
    )
