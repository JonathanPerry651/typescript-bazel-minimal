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

            // Construct Double-Hop URL
            // 1. Final destination: Origin + /silent-auth.html
            const origin = window.location.origin;
            const silentAuthUrl = `${origin}/silent-auth.html`;

            // 2. Wrap via JwtWrapper: https://jwt-wrapper?redirect=...
            // Note: We need to point to the actual JwtWrapper service URL.
            // Assumption: It's running on port 8082 or proxied.
            // Based on user request "https://jwt-wrapper-server?redirect=origin"
            // I'll assume localhost:8082 for now, or maybe it should be relative?
            // The prompt said: "https://central-auth?redirect=<https//jwt-wrapper-server?redirect=origin>"

            // Let's assume we have constants for these services.
            const CENTRAL_AUTH_URL = "http://localhost:8081/authorize"; // Mock IdP
            // REFACTOR: Replaced Java JwtWrapperServer with static bounce.html served by gateway
            const JWT_WRAPPER_URL = "http://localhost:8080/static/bounce.html";

            const encodedSilentAuth = encodeURIComponent(silentAuthUrl);
            const wrapperUrl = `${JWT_WRAPPER_URL}?redirect=${encodedSilentAuth}`;

            const encodedWrapperUrl = encodeURIComponent(wrapperUrl);
            const fullUrl = `${CENTRAL_AUTH_URL}?redirect=${encodedWrapperUrl}`;

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

            const handleMessage = (event: MessageEvent) => {
                // In real app, check origin logic
                if (event.data?.type === 'AUTH_TOKEN') {
                    const newToken = event.data.token;
                    console.log("[AuthManager] Token received from Popup:", newToken);
                    localStorage.setItem(this.TOKEN_KEY, newToken);
                    cleanup();
                    resolve(newToken);
                }
            };

            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                if (popup && !popup.closed) {
                    popup.close();
                }
                AuthManager.refreshPromise = null;
            };

            window.addEventListener('message', handleMessage);

            // Poll to see if popup was closed manually by user
            const pollTimer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(pollTimer);
                    if (AuthManager.refreshPromise) {
                        cleanup();
                        reject(new Error("Auth Popup closed by user"));
                    }
                }
            }, 500);

            // Timeout safety
            setTimeout(() => {
                if (AuthManager.refreshPromise) {
                    cleanup();
                    clearInterval(pollTimer);
                    reject(new Error("Auth Refresh Timed Out"));
                }
            }, 30000); // Increased timeout for manual interaction if needed
        });

        return this.refreshPromise;
    }
}
