const http = require('http');
const url = require('url');

const PORT = 8081;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 1. mimic IdP Authorize Endpoint
    // In a real scenario, this would check session cookies.
    // Here we assume the user is "logged in" and immediately redirect.
    if (pathname === '/authorize') {
        console.log(`[MockIdP] Received auth request. Redirecting to callback...`);
        const token = 'server-generated-jwt-' + Date.now();
        const redirectUrl = `/callback?access_token=${token}`;

        res.writeHead(302, { 'Location': redirectUrl });
        res.end();
        return;
    }

    // 2. The Callback Endpoint (this would be hosted by the app in some flows, 
    // or the IdP in others, but for iframe silent refresh, it's often a static asset)
    // For this simulation, we serve it here to complete the loop.
    if (pathname === '/callback') {
        console.log(`[MockIdP] Serving callback page with token.`);
        const token = parsedUrl.query.access_token;

        // Return HTML that posts the token back to the parent
        const html = `
            <!DOCTYPE html>
            <html>
            <body>
                <script>
                    const token = "${token}";
                    console.log("[Iframe] Got token from URL: " + token);
                    if (window.parent) {
                        console.log("[Iframe] Posting message to parent...");
                        window.parent.postMessage({
                            type: 'AUTH_TOKEN',
                            token: token
                        }, '*');
                    }
                </script>
                <h1>Auth Successful</h1>
            </body>
            </html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Mock IdP Server running at http://localhost:${PORT}`);
});
