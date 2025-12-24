
export class AuthManager {

    static getCookie(name: string): string | null {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
    }

    static async getValidToken(): Promise<string | null> {
        return this.getCookie('auth_token');
    }

    /**
     * Attempts to refresh the session.
     * 1. Try silent refresh via iframe (prompt=none)
     * 2. If silent fails, open a popup for interactive login
     */
    static async refreshSession(): Promise<string> {
        console.log("[AuthManager] Token missing or expired. Attempting silent refresh...");

        try {
            return await this.trySilentRefresh();
        } catch (err) {
            console.warn("[AuthManager] Silent refresh failed, falling back to popup login.", err);
            return await this.openLoginPopup();
        }
    }

    private static async trySilentRefresh(): Promise<string> {
        return new Promise((resolve, reject) => {
            const origin = window.location.origin;
            const bounceUrl = `${origin}/static/bounce.html?mode=silent`;

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = bounceUrl;

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Silent refresh timed out"));
            }, 5000);

            const handler = (event: MessageEvent) => {
                if (event.origin !== origin) return;
                if (event.data?.type === 'AUTH_SUCCESS') {
                    cleanup();
                    resolve(event.data.token);
                } else if (event.data?.type === 'AUTH_ERROR') {
                    cleanup();
                    reject(new Error(event.data.error));
                }
            };

            const cleanup = () => {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                document.body.removeChild(iframe);
            };

            window.addEventListener('message', handler);
            document.body.appendChild(iframe);
        });
    }

    private static async openLoginPopup(): Promise<string> {
        console.log("[AuthManager] Opening login popup...");
        const origin = window.location.origin;
        const bounceUrl = `${origin}/static/bounce.html?mode=login`;

        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;

        const popup = window.open(
            bounceUrl,
            'AuthPortal',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            throw new Error("Popup blocked");
        }

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent) => {
                if (event.origin !== origin) return;
                if (event.data?.type === 'AUTH_SUCCESS') {
                    window.removeEventListener('message', handler);
                    resolve(event.data.token);
                } else if (event.data?.type === 'AUTH_ERROR') {
                    window.removeEventListener('message', handler);
                    reject(new Error(event.data.error));
                }
            };

            window.addEventListener('message', handler);

            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    window.removeEventListener('message', handler);
                    reject(new Error("Login popup closed by user"));
                }
            }, 1000);
        });
    }
}
