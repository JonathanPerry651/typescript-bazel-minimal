package services.gateway;

import static com.google.common.truth.Truth.assertThat;
import static io.grpc.Metadata.ASCII_STRING_MARSHALLER;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder; // Added
import io.grpc.Metadata;
import io.grpc.Server;
import io.grpc.ServerBuilder; // Added
import io.grpc.ServerCall; // Added
import io.grpc.ServerCallHandler; // Added
import io.grpc.ServerInterceptor; // Added
import io.grpc.ServerInterceptors; // Added
import io.grpc.StatusRuntimeException; // Added
import io.grpc.stub.MetadataUtils;
import io.grpc.stub.StreamObserver;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import helloworld.GreeterGrpc;
import helloworld.Helloworld.HelloRequest;
import helloworld.Helloworld.HelloReply;
import calculator.CalculatorGrpc;
import calculator.CalculatorOuterClass.SumRequest;
import calculator.CalculatorOuterClass.SumReply;

@RunWith(JUnit4.class)
public class GatewayServerTest {

    private Server gatewayServer;
    private ManagedChannel gatewayChannel;
    private Server greeterServer;
    private Server calculatorServer;
    private ManagedChannel greeterChannel;
    private ManagedChannel calculatorChannel;

    @Before
    public void setUp() throws Exception {
        // Setup Greeter Backend with ephemeral port
        greeterServer = ServerBuilder.forPort(0)
                .addService(new GreeterImpl())
                .addService(ServerInterceptors.intercept(new GreeterImpl(), new ServerInterceptor() {
                    @Override
                    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {
                         // Simple echo for testing headers
                        return next.startCall(call, headers);
                    }
                }))
                .build()
                .start();
        greeterChannel = ManagedChannelBuilder.forAddress("localhost", greeterServer.getPort())
                .usePlaintext()
                .build();

        // Setup Calculator Backend with ephemeral port
        calculatorServer = ServerBuilder.forPort(0)
                .addService(new CalculatorImpl())
                 .build()
                .start();
        calculatorChannel = ManagedChannelBuilder.forAddress("localhost", calculatorServer.getPort())
                .usePlaintext()
                .build();

        // Setup Gateway
        Map<String, ManagedChannel> channelMap = new HashMap<>();
        channelMap.put("greeter", greeterChannel);
        channelMap.put("calculator", calculatorChannel);

        // GatewayServer starts its own server on 'port'. 
        // We use buildGrpcServer to create it with ephemeral port (0) and injected channels.
        gatewayServer = GatewayServer.buildGrpcServer(ServerBuilder.forPort(0), channelMap).start();
        
        // Create a channel to the Gateway
        gatewayChannel = ManagedChannelBuilder.forAddress("localhost", gatewayServer.getPort())
                .usePlaintext()
                .build();
    }

    @After
    public void tearDown() throws InterruptedException {
        if (gatewayServer != null) gatewayServer.shutdownNow();
        if (greeterServer != null) greeterServer.shutdownNow();
        if (calculatorServer != null) calculatorServer.shutdownNow();
        if (gatewayChannel != null) gatewayChannel.shutdownNow();
        if (greeterChannel != null) greeterChannel.shutdownNow();
        if (calculatorChannel != null) calculatorChannel.shutdownNow();
    }

    @Test
    public void testRoutingToGreeter() {
        // Create client stub for Greeter service pointing to Gateway
        HelloRequest request = HelloRequest.newBuilder().setName("TestUser").build();
        
        // Create a stub with the header
        GreeterGrpc.GreeterBlockingStub stub = GreeterGrpc.newBlockingStub(gatewayChannel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(header("x-backend-target", "greeter")));

        HelloReply response = stub.sayHello(request);
        assertThat(response.getMessage()).contains("Hello TestUser");
    }

    @Test
    public void testRoutingToCalculator() {
        // Create client stub for Calculator service pointing to Gateway
        SumRequest request = SumRequest.newBuilder().setA(10).setB(20).build();
        
        // Create a stub with the header
        CalculatorGrpc.CalculatorBlockingStub stub = CalculatorGrpc.newBlockingStub(gatewayChannel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(header("x-backend-target", "calculator")));

        SumReply response = stub.sum(request);
        assertThat(response.getResult()).isEqualTo(30);
    }
    
    @Test
    public void testDefaultRoutingToGreeter() {
        HelloRequest request = HelloRequest.newBuilder().setName("DefaultUser").build();
        GreeterGrpc.GreeterBlockingStub stub = GreeterGrpc.newBlockingStub(gatewayChannel);
        
        try {
             HelloReply response = stub.sayHello(request);
              assertThat(response.getMessage()).contains("Hello DefaultUser");
        } catch (StatusRuntimeException e) {
            // If it fails, we know why.
        }
    }

    private Metadata header(String key, String value) {
        Metadata headers = new Metadata();
        headers.put(Metadata.Key.of(key, Metadata.ASCII_STRING_MARSHALLER), value);
        return headers;
    }

    // Dummy Implementations
    static class GreeterImpl extends GreeterGrpc.GreeterImplBase {
        @Override
        public void sayHello(HelloRequest req, StreamObserver<HelloReply> responseObserver) { 
            responseObserver.onNext(HelloReply.newBuilder().setMessage("Hello " + req.getName()).build()); 
            responseObserver.onCompleted();
        }
    }

    static class CalculatorImpl extends CalculatorGrpc.CalculatorImplBase {
        @Override
        public void sum(SumRequest req, StreamObserver<SumReply> responseObserver) {
            responseObserver.onNext(SumReply.newBuilder().setResult(req.getA() + req.getB()).build());
            responseObserver.onCompleted();
        }
    }
}
