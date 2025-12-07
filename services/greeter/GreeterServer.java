package services.greeter;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import helloworld.GreeterGrpc;
import helloworld.Helloworld;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

import io.grpc.Context;
import io.grpc.Contexts;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;



public class GreeterServer {
    private static final Logger logger = Logger.getLogger(GreeterServer.class.getName());

    private Server server;

    public static final Context.Key<String> HEADER_KEY = Context.key("header-val");
    public static final Metadata.Key<String> TARGET_HEADER = Metadata.Key.of("x-backend-target", Metadata.ASCII_STRING_MARSHALLER);

    public static void main(String[] args) throws IOException, InterruptedException {
        final GreeterServer server = new GreeterServer();
        server.start();
        server.blockUntilShutdown();
    }

    private void start() throws IOException {
        /* The port on which the server should run */
        int port = 9090;
        server = ServerBuilder.forPort(port)
                .addService(new GreeterImpl())
                .intercept(new ServerInterceptor() {
                    @Override
                    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
                            ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {
                        String val = headers.get(TARGET_HEADER);
                        Context ctx = Context.current().withValue(HEADER_KEY, val);
                        return Contexts.interceptCall(ctx, call, headers, next);
                    }
                })
                .build()
                .start();
        logger.info("Server started, listening on " + port);
        Runtime.getRuntime().addShutdownHook(new Thread() {
            @Override
            public void run() {
                // Use stderr here since the logger may have been reset by its JVM shutdown
                // hook.
                System.err.println("*** shutting down gRPC server since JVM is shutting down");
                try {
                    GreeterServer.this.stop();
                } catch (InterruptedException e) {
                    e.printStackTrace(System.err);
                }
                System.err.println("*** server shut down");
            }
        });
    }

    private void stop() throws InterruptedException {
        if (server != null) {
            server.awaitTermination(30, TimeUnit.SECONDS);
        }
    }

    /**
     * Await termination on the main thread since the grpc library uses daemon
     * threads.
     */
    private void blockUntilShutdown() throws InterruptedException {
        if (server != null) {
            server.awaitTermination();
        }
    }

    static class GreeterImpl extends GreeterGrpc.GreeterImplBase {

        @Override
        public void sayHello(Helloworld.HelloRequest req, StreamObserver<Helloworld.HelloReply> responseObserver) {
            String headerVal = HEADER_KEY.get();
            String msg = "Hello " + req.getName();
            if (headerVal != null) {
                msg += " (Header: " + headerVal + ")";
            }
            Helloworld.HelloReply reply = Helloworld.HelloReply.newBuilder().setMessage(msg)
                    .build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }
    }
}
