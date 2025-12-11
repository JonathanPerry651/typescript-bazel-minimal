import { HelloRequest } from 'typescript_bazel_minimal/services/greeter/proto/helloworld_js_grpc_web';
import { SumRequest } from 'typescript_bazel_minimal/services/calculator/proto/calculator_js_grpc_web';
import { greeterClient, calculatorClient } from 'typescript_bazel_minimal/packages/grpc-client';

const client = greeterClient;
const calcClient = calculatorClient;

export class CalculatorApp {
    async sayHello(): Promise<string> {
        const request = new HelloRequest();
        request.setName('World');

        try {
            const response = await client.sayHello(request, {});
            return 'Response: ' + response.getMessage();
        } catch (err: any) {
            console.error(err);
            return 'Error: ' + err.message;
        }
    }

    async doSum(a: number, b: number): Promise<string> {
        const r = new SumRequest();
        r.setA(a);
        r.setB(b);

        try {
            const response = await calcClient.sum(r, {});
            return 'Sum Result: ' + response.getResult();
        } catch (err: any) {
            console.error(err);
            return 'Calc Error: ' + err.message;
        }
    }
}
