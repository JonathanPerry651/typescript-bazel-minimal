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

        // Add current token if available
        const token = await AuthManager.getValidToken();
        if (token) {
            metadata['Authorization'] = `Bearer ${token}`;
        }

        try {
            return await invoker(request);
        } catch (err: any) {
            // Check for UNAUTHENTICATED (gRPC code 16)
            if (err && err.code === 16) {
                console.warn("[AuthInterceptor] Received UNAUTHENTICATED (16). Redirecting to auth...");
                // This navigates away - the page will reload after auth
                AuthManager.refreshSession();
            }
            throw err;
        }
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
