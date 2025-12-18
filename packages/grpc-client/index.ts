import { GreeterPromiseClient } from 'typescript_bazel_minimal/services/greeter/proto/helloworld_js_grpc_web';
import { CalculatorPromiseClient } from 'typescript_bazel_minimal/services/calculator/proto/calculator_js_grpc_web';

const uri = 'http://localhost:8080/application/grpc-web';

import { AuthManager } from './auth';

class TargetHeaderInterceptor {
    constructor(private target: string) { }
    intercept(request: any, invoker: any) {
        const metadata = request.getMetadata();
        metadata['x-backend-target'] = this.target;
        return invoker(request);
    }
}

class AuthInterceptor {
    async intercept(request: any, invoker: any) {
        const metadata = request.getMetadata();

        try {
            // This smart getter will return the token if exists,
            // OR trigger the iframe refresh flow if missing.
            const token = await AuthManager.getValidToken();
            metadata['Authorization'] = `Bearer ${token}`;
        } catch (err) {
            console.error("[AuthInterceptor] Failed to get token:", err);
            // We proceed without token? Or throw? 
            // Usually we proceed and let backend return 401
        }

        return invoker(request);
    }
}

class RoutedGreeterClient extends GreeterPromiseClient {
    constructor(hostname: string) {
        super(hostname, null, {
            unaryInterceptors: [
                new TargetHeaderInterceptor('greeter'),
                new AuthInterceptor()
            ]
        });
    }
}

class RoutedCalculatorClient extends CalculatorPromiseClient {
    constructor(hostname: string) {
        super(hostname, null, {
            unaryInterceptors: [
                new TargetHeaderInterceptor('calculator'),
                new AuthInterceptor()
            ]
        });
    }
}

export const greeterClient = new RoutedGreeterClient(uri);
export const calculatorClient = new RoutedCalculatorClient(uri);
