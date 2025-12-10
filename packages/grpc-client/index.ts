import { GreeterPromiseClient } from 'typescript_bazel_minimal/proto/helloworld_js_grpc_web_pb/proto/helloworld_grpc_web_pb';
import { CalculatorPromiseClient } from 'typescript_bazel_minimal/proto/calculator_js_grpc_web_pb/proto/calculator_grpc_web_pb';

const uri = 'http://localhost:8080/application/grpc-web';

class TargetHeaderInterceptor {
    constructor(private target: string) { }
    intercept(request: any, invoker: any) {
        const metadata = request.getMetadata();
        metadata['x-backend-target'] = this.target;

        return invoker(request);
    }
}

class RoutedGreeterClient extends GreeterPromiseClient {
    constructor(hostname: string) {
        super(hostname, null, {
            unaryInterceptors: [new TargetHeaderInterceptor('greeter')]
        });
    }
}

class RoutedCalculatorClient extends CalculatorPromiseClient {
    constructor(hostname: string) {
        super(hostname, null, {
            unaryInterceptors: [new TargetHeaderInterceptor('calculator')]
        });
    }
}

export const greeterClient = new RoutedGreeterClient(uri);
export const calculatorClient = new RoutedCalculatorClient(uri);
