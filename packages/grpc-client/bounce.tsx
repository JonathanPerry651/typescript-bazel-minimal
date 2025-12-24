import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const origin = window.location.origin;
// bounce.html acts as the Redirect URI for the IdP
const redirectUri = `${origin}/static/bounce.html`;

const userManager = new UserManager({
    authority: "http://localhost:8081",
    client_id: "grpc-client",
    redirect_uri: redirectUri,
    silent_redirect_uri: redirectUri, // We use the same page for silent refresh callbacks
    response_type: "code",
    scope: "openid profile",
    // Persist state (code_verifier) in localStorage so it survives redirects
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    metadata: {
        issuer: "http://localhost:8081",
        authorization_endpoint: "http://localhost:8081/authorize",
        token_endpoint: "http://localhost:8081/token",
        userinfo_endpoint: "http://localhost:8081/userinfo",
        jwks_uri: "http://localhost:8081/.well-known/jwks.json",
    }
});

async function handleBounce() {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for OIDC callback parameters (either in query or fragment)
    const isCallback = urlParams.has('code') || urlParams.has('error') || window.location.hash.includes('code=');
    const mode = urlParams.get('mode');

    // 1. Handle OIDC Callback
    if (isCallback) {
        console.log("[Bounce] Processing OIDC callback...");
        try {
            // signinCallback handles both standard and silent (iframe) callbacks
            const user = await userManager.signinCallback();

            if (user) {
                console.log("[Bounce] Login successful. Setting domain cookie.");
                // Set cookie on root domain to allow subdomains to access it
                // For localhost, we use an empty domain or '.localhost'
                const cookieDomain = window.location.hostname === 'localhost' ? '' : `; Domain=.${window.location.hostname.split('.').slice(-2).join('.')}`;
                document.cookie = `auth_token=${user.access_token}; Path=/; Max-Age=${user.expires_in || 3600}; SameSite=Lax${cookieDomain}`;

                // Notify the opener (popup) or parent (iframe)
                const targetWindow = window.opener || window.parent;
                if (targetWindow && targetWindow !== window) {
                    targetWindow.postMessage({ type: 'AUTH_SUCCESS', token: user.access_token }, "*");
                }
            }
        } catch (err) {
            console.error("[Bounce] Callback failed:", err);
            const targetWindow = window.opener || window.parent;
            if (targetWindow && targetWindow !== window) {
                targetWindow.postMessage({ type: 'AUTH_ERROR', error: String(err) }, "*");
            }
            document.body.innerText = "Authentication failed: " + err;
        } finally {
            // Close popup if we are in one
            if (window.opener) {
                setTimeout(() => window.close(), 1000);
            }
        }
        return;
    }

    // 2. Handle Login Requests
    if (mode === 'login') {
        console.log("[Bounce] Initiating interactive login...");
        try {
            await userManager.signinRedirect();
        } catch (err) {
            console.error("[Bounce] Signin redirect failed:", err);
            document.body.innerText = "Redirect failed: " + err;
        }
        return;
    }

    // 3. Handle Silent Refresh Requests
    if (mode === 'silent') {
        console.log("[Bounce] Initiating silent refresh...");
        try {
            // prompt=none tells the IdP not to show any UI
            await userManager.signinRedirect({ prompt: 'none' });
        } catch (err) {
            console.error("[Bounce] Silent refresh failed:", err);
            window.parent.postMessage({ type: 'AUTH_ERROR', error: 'silent_failed' }, "*");
        }
        return;
    }

    // Default: Readiness check
    document.body.innerText = "Auth Portal Ready.";
}

handleBounce();
