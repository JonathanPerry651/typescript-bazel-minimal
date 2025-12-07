import { GreeterPromiseClient } from '../../proto/helloworld_js_grpc_web_pb/proto/helloworld_grpc_web_pb';
import { HelloRequest } from '../../proto/helloworld_js_grpc_web_pb/proto/helloworld_pb';
import { RpcError, Metadata } from 'grpc-web';

import { CalculatorPromiseClient } from '../../proto/calculator_js_grpc_web_pb/proto/calculator_grpc_web_pb';
import { SumRequest } from '../../proto/calculator_js_grpc_web_pb/proto/calculator_pb';

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

const client = new RoutedGreeterClient(uri);
const calcClient = new RoutedCalculatorClient(uri);

async function sayHello() {
    const request = new HelloRequest();
    request.setName('World');

    try {
        const response = await client.sayHello(request, {});
        console.log(response.getMessage());
        alert('Response: ' + response.getMessage());
    } catch (err: any) {
        console.error(err);
        alert('Error: ' + err.message);
    }
}

// Simple UI integration
const button = document.createElement('button');
button.innerText = 'Say Hello';
button.onclick = sayHello;
document.body.appendChild(button);

const div = document.createElement('div');
div.innerText = 'Click the button to call gRPC backend via Envoy';
document.body.appendChild(div);

async function doSum() {
    const r = new SumRequest();
    r.setA(10);
    r.setB(20);

    try {
        const response = await calcClient.sum(r, {});
        console.log("Sum: " + response.getResult());
        alert('Sum Result: ' + response.getResult());
    } catch (err: any) {
        console.error(err);
        alert('Calc Error: ' + err.message);
    }
}

const calcBtn = document.createElement('button');
calcBtn.innerText = 'Calculate 10+20';
calcBtn.onclick = doSum;
document.body.appendChild(document.createElement('br'));
document.body.appendChild(calcBtn);

