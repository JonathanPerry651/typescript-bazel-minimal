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

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';

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

            iframe.src = fullUrl;

            const handleMessage = (event: MessageEvent) => {
                // In real app, check origin logic
                if (event.data?.type === 'AUTH_TOKEN') {
                    const newToken = event.data.token;
                    console.log("[AuthManager] Token received from Iframe:", newToken);
                    localStorage.setItem(this.TOKEN_KEY, newToken);
                    cleanup();
                    resolve(newToken);
                }
            };

            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                AuthManager.refreshPromise = null;
            };

            window.addEventListener('message', handleMessage);
            document.body.appendChild(iframe);

            // Timeout safety
            setTimeout(() => {
                if (AuthManager.refreshPromise) {
                    cleanup();
                    reject(new Error("Auth Refresh Timed Out"));
                }
            }, 10000); // 10s timeout
        });

        return this.refreshPromise;
    }
}
