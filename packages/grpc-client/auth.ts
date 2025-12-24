

export class AuthManager {

    static getCookie(name: string): string | null {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
    }

    static async getValidToken(): Promise<string | null> {
        // Trivial implementation: read from cookie
        // The bounce server handles refreshing by re-triggering the flow if needed?
        // Actually, if cookie is expired, we return null, interceptor triggers refreshSession -> redirects to bounce
        return this.getCookie('auth_token');
    }

    static async refreshSession(): Promise<string> {
        console.log("[AuthManager] Token missing or expired. Opening Bounce Popup...");
        const origin = window.location.origin;
        const bounceUrl = `${origin}/static/bounce.html`;

        // Calculate screen center for popup
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;

        const popup = window.open(
            `${bounceUrl}?popup=true`,
            'BounceAuth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            console.error("[AuthManager] Popup blocked. Please allow popups for this site.");
            throw new Error("Popup blocked");
        }

        return new Promise<string>((resolve, reject) => {
            const handler = (event: MessageEvent) => {
                // Ensure message comes from our origin
                if (event.origin !== origin) return;

                if (event.data && event.data.type === 'BOUNCE_SUCCESS') {
                    console.log("[AuthManager] Valid token received from popup.");
                    window.removeEventListener('message', handler);
                    resolve(event.data.token);
                } else if (event.data && event.data.type === 'BOUNCE_ERROR') {
                    console.error("[AuthManager] Error received from popup:", event.data.error);
                    window.removeEventListener('message', handler);
                    reject(new Error(event.data.error));
                }
            };

            window.addEventListener('message', handler);

            // Optional: Check if popup is closed manually
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    window.removeEventListener('message', handler);
                    // If we haven't resolved yet, it means the user closed it without success
                    reject(new Error("Popup closed by user"));
                }
            }, 1000);
        });
    }
}

