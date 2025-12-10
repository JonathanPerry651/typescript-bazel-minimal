import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HelloRequest } from 'typescript_bazel_minimal/proto/helloworld_js_grpc_web_pb/proto/helloworld_pb';
import { RpcError, Metadata } from 'grpc-web';
import { SumRequest } from 'typescript_bazel_minimal/proto/calculator_js_grpc_web_pb/proto/calculator_pb';

import { greeterClient, calculatorClient } from '../../packages/grpc-client';

const client = greeterClient;
const calcClient = calculatorClient;

const App = () => {
    const [messages, setMessages] = useState<string[]>([]);

    const log = (msg: string) => {
        console.log(msg);
        setMessages(prev => [...prev, msg]);
    };

    const sayHello = async () => {
        const request = new HelloRequest();
        request.setName('World');

        try {
            const response = await client.sayHello(request, {});
            log('Response: ' + response.getMessage());
        } catch (err: any) {
            console.error(err);
            log('Error: ' + err.message);
        }
    };

    const doSum = async () => {
        const r = new SumRequest();
        r.setA(10);
        r.setB(20);

        try {
            const response = await calcClient.sum(r, {});
            log('Sum Result: ' + response.getResult());
        } catch (err: any) {
            console.error(err);
            log('Calc Error: ' + err.message);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>gRPC React Calculator</h1>
            <p>Click the buttons to call gRPC backends via Envoy</p>

            <div style={{ marginBottom: '10px' }}>
                <button onClick={sayHello} style={{ marginRight: '10px', padding: '8px 16px' }}>
                    Say Hello
                </button>
                <button onClick={doSum} style={{ padding: '8px 16px' }}>
                    Calculate 10+20
                </button>
            </div>

            <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '100px', backgroundColor: '#f9f9f9' }}>
                <h3>Logs:</h3>
                {messages.length === 0 ? <p style={{ color: '#888' }}>No logs yet...</p> : (
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {messages.map((msg, i) => <li key={i} style={{ borderBottom: '1px solid #eee', padding: '4px 0' }}>{msg}</li>)}
                    </ul>
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('root') || document.createElement('div');
if (!container.id) {
    container.id = 'root';
    document.body.appendChild(container);
}

const root = createRoot(container);
root.render(<App />);
