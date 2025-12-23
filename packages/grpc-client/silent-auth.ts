import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

// Entry point for silent-auth.html
new UserManager({
    authority: "http://localhost:8081", // Dummy/Default matches auth.ts
    client_id: "grpc-client",
    redirect_uri: window.location.href,
    userStore: new WebStorageStateStore({ store: window.localStorage })
}).signinPopupCallback();
console.log("[SilentAuth] Callback processed.");
