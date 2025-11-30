import React from 'react';
import { createRoot } from 'react-dom/client';
import { add } from '@myorg/calculator';

const App = () => {
    return <h1>Hello React World. 2 + 3 = {add(2, 3)}</h1>;
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error('Failed to find the root element');
}
