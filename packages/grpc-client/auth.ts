import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';

export class AuthManager {
    private static userManager: UserManager;

    static initialize() {
        if (this.userManager) return;

        const origin = window.location.origin;

        this.userManager = new UserManager({
            authority: "http://localhost:8081", // IdP URL
            client_id: "grpc-client",
            redirect_uri: `${origin}/silent-auth.html`, // Used for standard redirects
            popup_redirect_uri: `${origin}/silent-auth.html`,
            post_logout_redirect_uri: origin,
            response_type: "code",
            scope: "openid profile",
            // Use local storage to persist user session across reloads
            userStore: new WebStorageStateStore({ store: window.localStorage }),
            // Optional: Automation of silent refresh via iframe
            automaticSilentRenew: true,
            silent_redirect_uri: `${origin}/silent-auth.html`,
        });

        // Log events for debugging
        this.userManager.events.addUserLoaded((user: User) => {
            console.log("[AuthManager] User loaded:", user.profile);
        });
        this.userManager.events.addSilentRenewError((error: Error) => {
            console.error("[AuthManager] Silent renew error:", error);
        });
    }

    static async getValidToken(): Promise<string | null> {
        this.initialize();
        const user = await this.userManager.getUser();

        if (user && !user.expired) {
            return user.access_token;
        }

        // If expired or missing, try silent refresh first if configured, or just return null
        // to let the interceptor trigger a full refresh (popup).
        // For this implementation, we'll return null and let the retry mechanism handle it.
        return null;
    }
    static async refreshSession(): Promise<string> {
        this.initialize();
        console.log("[AuthManager] Initiating Signin Popup...");
        try {
            const user = await this.userManager.signinPopup();
            console.log("[AuthManager] Signin successful:", user.profile);
            return user.access_token;
        } catch (err) {
            console.error("[AuthManager] Signin failed:", err);
            throw err;
        }
    }

}
