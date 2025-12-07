package services.calculator;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import calculator.CalculatorGrpc;
import calculator.CalculatorOuterClass;
import java.util.logging.Logger;

public class CalculatorServer {
    private static final Logger logger = Logger.getLogger(CalculatorServer.class.getName());
    private static final int PORT = 9091;

    public static void main(String[] args) throws Exception {
        Server server = ServerBuilder.forPort(PORT)
                .addService(new CalculatorImpl())
                .build()
                .start();
        
        logger.info("Calculator Server started, listening on " + PORT);
        server.awaitTermination();
    }

    static class CalculatorImpl extends CalculatorGrpc.CalculatorImplBase {
        @Override
        public void sum(CalculatorOuterClass.SumRequest request, StreamObserver<CalculatorOuterClass.SumReply> responseObserver) {
            int result = request.getA() + request.getB();
            CalculatorOuterClass.SumReply reply = CalculatorOuterClass.SumReply.newBuilder()
                    .setResult(result)
                    .build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }
    }
}
