export class AuthManager {
    private static TOKEN_KEY = 'auth_token';
    private static refreshPromise: Promise<string> | null = null;

    static getToken(): string | null {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(this.TOKEN_KEY);
    }

    static async getValidToken(): Promise<string> {
        const token = this.getToken();
        // in a real app, check expiration here (e.g. JWT decode)
        if (token) {
            return token;
        }
        return this.refreshSession();
    }

    static async refreshSession(): Promise<string> {
        // Dedup running refreshes
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = new Promise((resolve, reject) => {
            console.log("[AuthManager] Initiating Silent Auth (Iframe)...");

            if (typeof document === 'undefined') {
                reject(new Error("Cannot refresh session in non-browser environment"));
                return;
            }

            // PKCE Helper Functions
            const generateCodeVerifier = () => {
                const array = new Uint8Array(32);
                window.crypto.getRandomValues(array);
                return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
            };

            const sha256 = async (plain: string) => {
                const encoder = new TextEncoder();
                const data = encoder.encode(plain);
                const hash = await window.crypto.subtle.digest('SHA-256', data);
                return hash;
            };

            const base64UrlEncode = (a: ArrayBuffer) => {
                return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(a))))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };

            // Start Async Flow
            (async () => {
                try {
                    const codeVerifier = generateCodeVerifier();
                    const hashed = await sha256(codeVerifier);
                    const codeChallenge = base64UrlEncode(hashed);

                    // Construct Double-Hop URL with PKCE params
                    // 1. Final destination: Origin + /silent-auth.html
                    const origin = window.location.origin;
                    const silentAuthUrl = `${origin}/silent-auth.html`;

                    // Let's assume we have constants for these services.
                    // Note: Central Auth needs to support /authorize?response_type=code&code_challenge=...
                    const CENTRAL_AUTH_URL = "http://localhost:8081/authorize";
                    const JWT_WRAPPER_URL = "http://localhost:8080/static/bounce.html";

                    const encodedSilentAuth = encodeURIComponent(silentAuthUrl);
                    const wrapperUrl = `${JWT_WRAPPER_URL}?redirect=${encodedSilentAuth}`; // bounce.html blindly forwards other params

                    const encodedWrapperUrl = encodeURIComponent(wrapperUrl);

                    // Append PKCE params to the INITIAL URL (Central Auth)
                    // bounce.html will forward keys *other than* redirect to destination,
                    // BUT wait... Central Auth redirects to bounce.html?
                    // Usually: CentralAuth -> valid? -> Redirect to (Bounce + params).
                    // So we send params to CentralAuth.
                    const fullUrl = `${CENTRAL_AUTH_URL}?redirect=${encodedWrapperUrl}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`;

                    // Popup Auth (Bypass CSP)
                    const width = 600;
                    const height = 600;
                    const left = (window.screen.width - width) / 2;
                    const top = (window.screen.height - height) / 2;

                    const popup = window.open(
                        fullUrl,
                        'AuthPopup',
                        `width=${width},height=${height},top=${top},left=${left},resizable,scrollbars`
                    );

                    if (!popup) {
                        reject(new Error("Popup blocked. Please check your browser settings."));
                        return;
                    }

                    // Declare pollTimer here so cleanup can access it
                    let pollTimer: any;

                    const cleanup = () => {
                        window.removeEventListener('message', handleMessage);
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                        AuthManager.refreshPromise = null;
                        clearInterval(pollTimer); // Clear the interval when cleaning up
                    };

                    const handleMessage = async (event: MessageEvent) => {
                        // Check origin for security
                        if (event.origin !== window.location.origin) {
                            return;
                        }

                        if (event.data?.type === 'AUTH_CODE') {
                            const code = event.data.code;
                            console.log("[AuthManager] Auth Code received:", code);
                            cleanup();

                            // PKCE: Exchange Code for Token
                            try {
                                console.log("[AuthManager] Exchanging code for token...");
                                // Mocking the token endpoint call (since we don't have a real one)
                                // In real life: POST /token with code, verifier, client_id
                                /*
                                const response = await fetch('http://localhost:8081/token', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                    body: new URLSearchParams({
                                        grant_type: 'authorization_code',
                                        code: code,
                                        redirect_uri: silentAuthUrl,
                                        code_verifier: codeVerifier,
                                        client_id: 'grpc-client'
                                    })
                                });
                                const data = await response.json();
                                const newToken = data.access_token;
                                */

                                // Mock simulation for success
                                const newToken = `mock_token_from_code_${code}`;

                                console.log("[AuthManager] Token acquired via PKCE:", newToken);
                                localStorage.setItem(this.TOKEN_KEY, newToken);
                                resolve(newToken);
                            } catch (e) {
                                reject(new Error("Token exchange failed: " + e));
                            }
                        }
                    };

                    window.addEventListener('message', handleMessage);

                    // Poll to see if popup was closed manually by user
                    pollTimer = setInterval(() => {
                        if (popup.closed) {
                            cleanup();
                            reject(new Error("Auth Popup closed by user"));
                        }
                    }, 500);

                    // Timeout safety
                    setTimeout(() => {
                        if (AuthManager.refreshPromise) { // Check if promise is still active
                            cleanup();
                            reject(new Error("Auth Refresh Timed Out"));
                        }
                    }, 30000); // Increased timeout for manual interaction if needed

                } catch (err) {
                    reject(err);
                }
            })();
        });

        return this.refreshPromise;
    }
}
