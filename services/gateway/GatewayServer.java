package services.gateway;

import com.sun.net.httpserver.SimpleFileServer;
import com.sun.net.httpserver.HttpServer;
import io.grpc.*;
import io.grpc.stub.ClientCalls;
import io.grpc.stub.ServerCalls;
import io.grpc.stub.StreamObserver;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;
import javax.annotation.Nullable;

public class GatewayServer {
    private static final Logger logger = Logger.getLogger(GatewayServer.class.getName());
    private static final int HTTP_PORT = 8000;
    private static final int GRPC_PORT = 9000;
    
    public static final Context.Key<ManagedChannel> ORCHESTRATION_TARGET_CHANNEL = Context.key("target-channel");
    public static final Metadata.Key<String> TARGET_HEADER_KEY = Metadata.Key.of("x-backend-target", Metadata.ASCII_STRING_MARSHALLER);

    public static void main(String[] args) throws Exception {
        // 1. Static Assets Server
        Path staticDir = Paths.get("/app/static"); 
        if (!staticDir.toFile().exists()) {
             staticDir = Paths.get("services/gateway/static");
        }
        
        HttpServer httpServer = SimpleFileServer.createFileServer(
                new InetSocketAddress(HTTP_PORT),
                staticDir,
                SimpleFileServer.OutputLevel.VERBOSE
        );
        httpServer.start();
        logger.info("HTTP Server started on port " + HTTP_PORT);

        // 2. Generic gRPC Proxy
        // Channels (Localhost for testing)
        ManagedChannel greeterChannel = ManagedChannelBuilder.forAddress("localhost", 9090)
                .usePlaintext()
                .build();
        
        ManagedChannel calculatorChannel = ManagedChannelBuilder.forAddress("localhost", 9091)
                .usePlaintext()
                .build();

        Map<String, ManagedChannel> channelMap = new HashMap<>();
        channelMap.put("greeter", greeterChannel);
        channelMap.put("calculator", calculatorChannel);

        Server grpcServer = createGrpcServer(ServerBuilder.forPort(GRPC_PORT), channelMap).start();

        logger.info("Generic gRPC Proxy Server started on port " + GRPC_PORT);
        
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            grpcServer.shutdown();
            httpServer.stop(0);
        }));

        grpcServer.awaitTermination();
    }

    public static Server buildGrpcServer(ServerBuilder<?> serverBuilder, Map<String, ManagedChannel> channelMap) {
        // We use an interceptor to orchestrate routing
        ServerInterceptor routingInterceptor = new ServerInterceptor() {
            @Override
            public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
                    ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {
                
                String target = headers.get(TARGET_HEADER_KEY);
                logger.info("Orchestration header x-backend-target: " + target);

                ManagedChannel selected = channelMap.values().stream().findFirst().orElse(null); // Default to first available or null logic
                // Replicate original logic: default to the one named "greeter" if available, or first?
                // Original logic: "ManagedChannel selected = greeterChannel;"
                if (channelMap.containsKey("greeter")) {
                    selected = channelMap.get("greeter");
                }
                
                if (target != null && channelMap.containsKey(target)) {
                    selected = channelMap.get(target);
                }

                Context ctx = Context.current().withValue(ORCHESTRATION_TARGET_CHANNEL, selected);
                return Contexts.interceptCall(ctx, call, headers, next);
            }
        };

        return serverBuilder
                .intercept(routingInterceptor) // Global interceptor
                .fallbackHandlerRegistry(new GenericProxyRegistry())
                .build();
    }

    // Deprecated wrapper to match signature if needed, or just inline in main.
    // I renamed it to buildGrpcServer to be clear it returns a built (but not started) server.
    private static Server createGrpcServer(ServerBuilder<?> serverBuilder, Map<String, ManagedChannel> channelMap) {
        return buildGrpcServer(serverBuilder, channelMap);
    }

    // Registry resolves ANY method, relying on Context for channel selection
    static class GenericProxyRegistry extends HandlerRegistry {
        
        @Override
        @Nullable
        public ServerMethodDefinition<?, ?> lookupMethod(String methodName, @Nullable String authority) {
            // Normalize method name (strip leading slash)
            String normalizedMethodName = methodName;
            if (normalizedMethodName.startsWith("/")) {
                normalizedMethodName = normalizedMethodName.substring(1);
            }
            
            // Create a MethodDescriptor on the fly for the requested method
            MethodDescriptor<InputStream, InputStream> methodDescriptor = MethodDescriptor.<InputStream, InputStream>newBuilder()
                    .setType(MethodDescriptor.MethodType.UNKNOWN) // Unknown allows streaming or unary
                    .setFullMethodName(normalizedMethodName)
                    .setRequestMarshaller(new InputStreamMarshaller())
                    .setResponseMarshaller(new InputStreamMarshaller())
                    .build();

            return ServerMethodDefinition.create(
                    methodDescriptor,
                    new GatewayServerCallHandler(methodDescriptor)
            );
        }
    }

    // Trivial Marshaller for InputStream (Pass-through with buffering)
    static class InputStreamMarshaller implements MethodDescriptor.Marshaller<InputStream> {
        @Override
        public InputStream stream(InputStream value) { return value; }
        @Override
        public InputStream parse(InputStream stream) { 
            try {
                return new java.io.ByteArrayInputStream(stream.readAllBytes());
            } catch (java.io.IOException e) {
                 throw new RuntimeException(e);
            }
        }
    }

    // Handler that forwards the call to the backend selected in Context, including headers
    static class GatewayServerCallHandler implements ServerCallHandler<InputStream, InputStream> {
        private final MethodDescriptor<InputStream, InputStream> method;

        public GatewayServerCallHandler(MethodDescriptor<InputStream, InputStream> method) {
            this.method = method;
        }

        @Override
        public ServerCall.Listener<InputStream> startCall(ServerCall<InputStream, InputStream> serverCall, Metadata headers) {
            // Retrieve channel from Context
            ManagedChannel channel = ORCHESTRATION_TARGET_CHANNEL.get();
            if (channel == null) {
                serverCall.close(Status.INTERNAL.withDescription("No channel selected"), new Metadata());
                return new ServerCall.Listener<InputStream>() {};
            }

            // Create Client Call
            ClientCall<InputStream, InputStream> clientCall = channel.newCall(method, CallOptions.DEFAULT);
            
            // Start Client Call with listener that forwards response to Server Call
            clientCall.start(new ClientCall.Listener<InputStream>() {
                @Override
                public void onHeaders(Metadata responseHeaders) {
                    serverCall.sendHeaders(responseHeaders);
                }

                @Override
                public void onMessage(InputStream message) {
                    serverCall.sendMessage(message);
                }

                @Override
                public void onClose(Status status, Metadata trailers) {
                    logger.info("Gateway ClientCall closed: " + status);
                    serverCall.close(status, trailers);
                }
            }, headers); // Forward REQUEST headers here

            // Flow control: Request first message from backend
            clientCall.request(1);
            // Flow control: Request first message from client (browser)
            serverCall.request(1);

            // Return Server Call Listener that forwards request to Client Call
            return new ServerCall.Listener<InputStream>() {
                @Override
                public void onMessage(InputStream message) {
                    clientCall.sendMessage(message);
                }

                @Override
                public void onHalfClose() {
                    try {
                        clientCall.halfClose();
                    } catch (Throwable t) {
                        System.err.println("CRASH in onHalfClose: " + t);
                        t.printStackTrace();
                        throw t;
                    }
                }

                @Override
                public void onCancel() {
                    clientCall.cancel("Server call cancelled", null);
                }

                @Override
                public void onReady() {
                }
            };
        }
    }
}
