

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
        console.log("[AuthManager] Token missing or expired. Redirecting to Bounce Server...");
        const origin = window.location.origin;
        // Assume bounce.html is available at /static/bounce.html on the same Gateway
        // or a different domain. Here we assume same domain or known URL.
        const bounceUrl = `${origin}/static/bounce.html`;

        const returnUrl = window.location.href;
        const target = `${bounceUrl}?return_url=${encodeURIComponent(returnUrl)}`;

        window.location.replace(target);

        // We will never return from this function as the page unloads
        return new Promise<string>(() => { });
    }
}

