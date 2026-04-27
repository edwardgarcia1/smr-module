import { describe, expect, it } from "bun:test";
import "../src/index";
import { edenTreaty } from "@elysiajs/eden";
import type { App } from "../src/index";

const client = edenTreaty<App>("http://localhost:3000");
// If the app has prefix /api, the client property is likely named 'api'
const { api } = client;

const testUser = {
    username: "testuser" + Date.now(),
    password: "TestPass123",
    name: "Test User"
};

describe("Auth Flow", () => {
    it("should register a new user", async () => {
        const response = await api.auth.register.post(testUser);
        const { data, error } = response;

        console.log("Registration response:", JSON.stringify(response, null, 2));

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.message).toBe("User registered successfully");
    });

    it("should login with registered user", async () => {
        const response = await api.auth.login.post({
            username: testUser.username,
            password: testUser.password
        });
        const { data, error } = response;

        console.log("Login response:", JSON.stringify(response, null, 2));

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.message).toBe("Logged in successfully");
        expect(data?.user).toBeDefined();
        expect(data?.user.username).toBe(testUser.username);

        // Extract access token from set-cookie header
        // response.headers is a Headers-like object
        const setCookieHeader = (response.headers as any).get('set-cookie');
        
        if (setCookieHeader) {
            // Parse the cookie string to get the accessToken
            // Example: "accessToken=eyJ...; Max-Age=900; ..."
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const accessTokenCookie = cookies.find((c: string) => c.startsWith('accessToken='));
            if (accessTokenCookie) {
                const token = accessTokenCookie.split(';')[0].split('=')[1];
                // Store token for later tests
                (global as any).testAccessToken = token;
            }
        }
        if (setCookieHeader) {
            // Parse the cookie string to get the accessToken
            // Example: "accessToken=eyJ...; Max-Age=900; ..."
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const accessTokenCookie = cookies.find(c => c.startsWith('accessToken='));
            if (accessTokenCookie) {
                const token = accessTokenCookie.split(';')[0].split('=')[1];
                console.log("Extracted token:", token);
                // Store token for later tests
                (global as any).testAccessToken = token;
            } else {
                console.log("No accessToken cookie found");
            }
        } else {
            console.log("No set-cookie header found");
        }
    });

    it("should return 401 for unauthenticated access to users list", async () => {
        // Use a fresh client to ensure no cookies are sent
        const freshClient = edenTreaty<App>("http://localhost:3000");
        const { error } = await freshClient.api.users.get();

        expect(error).toBeDefined();
        expect(error?.status).toBe(401);
    });

    it("should return 403 for authenticated 'user' role accessing users list", async () => {
        const token = (global as any).testAccessToken;
        expect(token).toBeDefined();

        // Pass the token via headers using $headers
        const { error } = await api.users.get({
            $headers: {
                Authorization: `Bearer ${token}`
            }
        });

        expect(error).toBeDefined();
        // We expect Forbidden (403) because regular users cannot list all users
        expect(error?.status).toBe(403);
    });
});
