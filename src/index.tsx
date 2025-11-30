import React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
    return <h1>Hello React World</h1>;
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error('Failed to find the root element');
}
