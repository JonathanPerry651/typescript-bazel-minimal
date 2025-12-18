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



            // Point to real Mock IdP server (ensure you run `bazel run //packages/mock-idp:server`)
            iframe.src = 'http://localhost:8081/authorize';

            const handleMessage = (event: MessageEvent) => {
                // In real app, check origin: if (event.origin !== 'http://localhost:8081') return;

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
            }, 5000);
        });

        return this.refreshPromise;
    }
}
