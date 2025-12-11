
genrule(
    name = "debug_outputs",
    srcs = [":helloworld_js_grpc_web_pb"],
    outs = ["outputs.txt"],
    cmd = "echo $(locations :helloworld_js_grpc_web_pb) > $@",
)
