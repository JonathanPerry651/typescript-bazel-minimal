import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts';

const origin = window.location.origin;
// bounce.html acts as the Redirect URI for the IdP
const redirectUri = `${origin}/static/bounce.html`;

const userManager = new UserManager({
    authority: "http://localhost:8081", // IdP URL
    client_id: "grpc-client",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile",
    // We need to persist state (code_verifier) between start and end of flow on this domain
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
    const code = urlParams.get('code');
    const returnUrlParam = urlParams.get('return_url');

    // 1. Check if this is a Callback from IdP (has code)
    if (code) {
        console.log("[Bounce] Processing callback from IdP...");
        try {
            // Process the response (exchange code for token)
            // This requires the code_verifier, which should be in localStorage from the start step
            const user = await userManager.signinCallback();
            if (!user) {
                console.error("[Bounce] Login successful but no user returned.");
                document.body.innerText = "Login successful but no user context.";
                return;
            }
            console.log("[Bounce] Login successful. User:", user.profile);

            // Set Cookie
            // TODO: In production, set Domain=.mycorp.com
            // For localhost dev, we might just set it for localhost or omit Domain to imply host-only
            const cookieDomain = window.location.hostname === 'localhost' ? '' : '; Domain=.mycorp.com';
            document.cookie = `auth_token=${user.access_token}; Path=/${cookieDomain}; Max-Age=${user.expires_in || 3600}; SameSite=Lax`;
            console.log("[Bounce] Cookie set.");

            // Redirect back to the original application
            // We need to know where to go. 
            // The state passed to IdP and back *could* contain it, OR we stored it in localStorage/sessionStorage
            // user.state might have it if we passed it during signinRedirect({ state: ... })
            const returnUrl = user.state as string;

            if (returnUrl) {
                console.log("[Bounce] Redirecting back to app:", returnUrl);
                window.location.replace(returnUrl);
            } else {
                console.warn("[Bounce] No return_url found in state. Staying on bounce page.");
                document.body.innerText = "Login successful, but lost return URL.";
            }

        } catch (err) {
            console.error("[Bounce] Callback processing failed:", err);
            document.body.innerText = "Login failed: " + err;
        }
        return;
    }

    // 2. Check if this is a Login Request from App (has return_url)
    if (returnUrlParam) {
        console.log("[Bounce] Starting login flow. Return URL:", returnUrlParam);
        try {
            // Start the flow
            // Pass return_url as state so we get it back after callback
            await userManager.signinRedirect({
                state: returnUrlParam
            });
        } catch (err) {
            console.error("[Bounce] Failed to start redirect:", err);
            document.body.innerText = "Failed to start login: " + err;
        }
        return;
    }

    // 3. Fallback / Error
    console.error("[Bounce] Unknown state. No code and no return_url.");
    document.body.innerText = "Bounce Server: Ready. Provide ?return_url=... to login.";
}

handleBounce();
