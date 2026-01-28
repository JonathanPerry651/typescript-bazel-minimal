const RETURN_URL_KEY = 'auth_return_url';

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
     * Stores the current URL and redirects to the auth bounce page.
     * First tries silent refresh (prompt=none), falls back to full login if needed.
     * This navigates away from the current page - the Promise never resolves.
     */
    static refreshSession(): never {
        console.log("[AuthManager] Token missing or expired. Redirecting to auth...");

        // Store current URL so we can return after auth
        sessionStorage.setItem(RETURN_URL_KEY, window.location.href);

        // Redirect to bounce page which will try silent refresh first
        const origin = window.location.origin;
        window.location.href = `${origin}/static/bounce.html?mode=refresh`;

        // This line is never reached, but TypeScript needs the return type
        throw new Error("Redirecting to auth");
    }

    /**
     * Gets the stored return URL and clears it from storage.
     */
    static getAndClearReturnUrl(): string {
        const returnUrl = sessionStorage.getItem(RETURN_URL_KEY);
        sessionStorage.removeItem(RETURN_URL_KEY);
        return returnUrl || '/';
    }
}
