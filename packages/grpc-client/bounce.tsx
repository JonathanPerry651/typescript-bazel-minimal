import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { AuthManager } from './auth';

const origin = window.location.origin;
const redirectUri = `${origin}/static/bounce.html`;

const userManager = new UserManager({
    authority: "http://localhost:8081",
    client_id: "grpc-client",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile",
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    metadata: {
        issuer: "http://localhost:8081",
        authorization_endpoint: "http://localhost:8081/authorize",
        token_endpoint: "/api/proxy_token",
        userinfo_endpoint: "http://localhost:8081/userinfo",
        jwks_uri: "http://localhost:8081/.well-known/jwks.json",
    }
});

function setAuthCookie(accessToken: string, expiresIn?: number): void {
    const cookieDomain = window.location.hostname === 'localhost'
        ? ''
        : `; Domain=.${window.location.hostname.split('.').slice(-2).join('.')}`;
    document.cookie = `auth_token=${accessToken}; Path=/; Max-Age=${expiresIn || 3600}; SameSite=Lax${cookieDomain}`;
}

function redirectToReturnUrl(): void {
    const returnUrl = AuthManager.getAndClearReturnUrl();
    console.log("[Bounce] Redirecting to:", returnUrl);
    window.location.href = returnUrl;
}

async function handleBounce() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    // Check for OIDC callback (code or error in query params)
    const hasCode = urlParams.has('code');
    const hasError = urlParams.has('error');
    const isCallback = hasCode || hasError;

    // 1. Handle OIDC Callback
    if (isCallback) {
        console.log("[Bounce] Processing OIDC callback...");

        // Check if this is a failed silent refresh (login_required)
        if (hasError && urlParams.get('error') === 'login_required') {
            console.log("[Bounce] Silent refresh failed (login_required). Falling back to full login...");
            // Fall back to full interactive login
            await userManager.signinRedirect();
            return;
        }

        if (hasError) {
            // Other OIDC errors - show error and redirect home
            const errorDesc = urlParams.get('error_description') || urlParams.get('error');
            console.error("[Bounce] OIDC error:", errorDesc);
            document.body.innerText = "Authentication failed: " + errorDesc;
            setTimeout(() => redirectToReturnUrl(), 3000);
            return;
        }

        try {
            const user = await userManager.signinCallback();
            if (user) {
                console.log("[Bounce] Login successful. Setting cookie and redirecting...");
                setAuthCookie(user.access_token, user.expires_in);
                redirectToReturnUrl();
            }
        } catch (err) {
            console.error("[Bounce] Callback failed:", err);
            document.body.innerText = "Authentication failed: " + err;
            setTimeout(() => redirectToReturnUrl(), 3000);
        }
        return;
    }

    // 2. Handle Refresh Request (try silent first with prompt=none)
    if (mode === 'refresh') {
        console.log("[Bounce] Attempting silent refresh (prompt=none)...");
        try {
            await userManager.signinRedirect({ prompt: 'none' });
        } catch (err) {
            console.error("[Bounce] Silent refresh initiation failed:", err);
            // Fall back to full login
            await userManager.signinRedirect();
        }
        return;
    }

    // 3. Handle Login Request (full interactive)
    if (mode === 'login') {
        console.log("[Bounce] Initiating interactive login...");
        try {
            await userManager.signinRedirect();
        } catch (err) {
            console.error("[Bounce] Login redirect failed:", err);
            document.body.innerText = "Redirect failed: " + err;
        }
        return;
    }

    // Default: show status
    document.body.innerText = "Auth Portal Ready.";
}

handleBounce();
