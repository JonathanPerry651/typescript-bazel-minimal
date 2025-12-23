import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

// Entry point for silent-auth.html
console.log("[SilentAuth] Starting silent auth handling");
console.log("[SilentAuth] Current URL:", window.location.href);

const mgr = new UserManager({
    authority: "http://localhost:8081", // Dummy/Default matches auth.ts
    client_id: "grpc-client",
    redirect_uri: window.location.href,
    userStore: new WebStorageStateStore({ store: window.localStorage })
});

console.log("[SilentAuth] UserManager settings:", mgr.settings);

mgr.signinPopupCallback()
    .then(() => {
        console.log("[SilentAuth] Callback processed successfully.");
    })
    .catch((err) => {
        console.error("[SilentAuth] Callback processing failed:", err);
    });
