// config-secure.js - PRODUCTION VERSION FOR RENDER
class SecureConfig {
    constructor() {
        this.config = null;
        this.isLoaded = false;
        this.backendUrl = 'https://favs-b-backend.onrender.com';
        this.apiToken = "favsbling_termux_token_2024";
        this.init();
    }

    async init() {
        console.log('🚀 Loading production configuration from Render...');
        
        try {
            await this.fetchFromBackend();
            console.log('✅ Connected to production backend');
        } catch (error) {
            console.error('❌ Failed to connect to backend:', error);
            this.useSafeFallback();
        }
    }

    async fetchFromBackend() {
        console.log(`🔗 Connecting to: ${this.backendUrl}`);
        
        const response = await fetch(`${this.backendUrl}/config`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.config) {
            this.config = data.config;
            this.setupGlobalConfig();
            this.isLoaded = true;
        } else {
            throw new Error('Invalid configuration response');
        }
    }

    useSafeFallback() {
        console.warn('⚠️ Using safe fallback configuration');
        this.config = {
            FIREBASE_API_KEY: "fallback_safe_key",
            FIREBASE_AUTH_DOMAIN: "favs-bling.firebaseapp.com",
            FIREBASE_DATABASE_URL: "https://favs-bling-default-rtdb.firebaseio.com",
            FIREBASE_PROJECT_ID: "favs-bling",
            FIREBASE_STORAGE_BUCKET: "favs-bling.appspot.com",
            FIREBASE_MESSAGING_SENDER_ID: "000000000000",
            FIREBASE_APP_ID: "1:000000000000:web:fallback123",
            PAYSTACK_PUBLIC_KEY: "pk_test_fallbackmode",
            ADMIN_EMAIL: "admin@favsbling.com",
            BACKEND_URL: "https://favs-b-backend.onrender.com",
            APP_NAME: "Favs Bling",
            SUPPORT_EMAIL: "support@favsbling.com",
            ENABLE_BACKEND: true,
            ENABLE_PAYSTACK: false,
            ENABLE_FIREBASE: true
        };
        this.setupGlobalConfig();
        this.isLoaded = true;
    }

    setupGlobalConfig() {
        window.CONFIG = this.config;
        Object.freeze(window.CONFIG);
        
        console.log('🔒 Production configuration loaded');
        console.log('📱 App:', this.config.APP_NAME);
        
        window.dispatchEvent(new CustomEvent('configReady'));
    }
}

// Initialize
const secureConfig = new SecureConfig();
window.secureConfig = secureConfig;
