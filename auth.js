// auth.js - Firebase Authentication for Favs Bling (Production Version)
let auth, database, app, googleProvider;
let authManager;
let ADMIN_EMAIL = null;

// Wait for secure configuration before initializing Firebase
function initializeFirebaseWhenReady() {
    if (!window.CONFIG) {
        console.log('⏳ Waiting for secure configuration from backend...');
        window.addEventListener('configReady', initializeFirebase);
        return;
    }
    initializeFirebase();
}

function initializeFirebase() {
    console.log('🔥 Initializing Firebase with secure config...');
    
    // Check if config is available
    if (!window.CONFIG || !window.CONFIG.FIREBASE_API_KEY) {
        console.error('❌ Firebase configuration not available');
        showConfigError();
        return;
    }

    const firebaseConfig = {
        apiKey: window.CONFIG.FIREBASE_API_KEY,
        authDomain: window.CONFIG.FIREBASE_AUTH_DOMAIN,
        databaseURL: window.CONFIG.FIREBASE_DATABASE_URL,
        projectId: window.CONFIG.FIREBASE_PROJECT_ID,
        storageBucket: window.CONFIG.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: window.CONFIG.FIREBASE_MESSAGING_SENDER_ID,
        appId: window.CONFIG.FIREBASE_APP_ID
    };

    try {
        // Initialize Firebase
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        database = firebase.database();
        googleProvider = new firebase.auth.GoogleAuthProvider();
        ADMIN_EMAIL = window.CONFIG.ADMIN_EMAIL;

        console.log('✅ Firebase initialized successfully');
        console.log('📧 Admin email:', ADMIN_EMAIL);
        
        // Initialize Auth Manager
        initializeAuthManager();
        
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        showConfigError();
    }
}

function showConfigError() {
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #f44336; color: white; padding: 20px; border-radius: 10px; z-index: 10000; text-align: center; max-width: 400px;">
            <h3>🚨 Configuration Error</h3>
            <p>Unable to load secure configuration from backend.</p>
            <p>This may be due to:</p>
            <ul style="text-align: left; margin: 10px 0;">
                <li>Backend service temporarily unavailable</li>
                <li>Internet connection issues</li>
                <li>Browser security restrictions</li>
            </ul>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                <button onclick="retryFirebaseInit()" style="background: white; color: #f44336; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">Retry Connection</button>
                <button onclick="useEmergencyMode()" style="background: #ff9800; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Limited Mode</button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
}

function retryFirebaseInit() {
    console.log('🔄 Retrying Firebase initialization...');
    // Remove error message
    document.querySelectorAll('div').forEach(div => {
        if (div.innerHTML.includes('Configuration Error')) {
            div.remove();
        }
    });
    
    // Reinitialize
    initializeFirebaseWhenReady();
}

function useEmergencyMode() {
    console.log('🔄 Switching to emergency mode...');
    // Remove error message
    document.querySelectorAll('div').forEach(div => {
        if (div.innerHTML.includes('Configuration Error')) {
            div.remove();
        }
    });
    
    // Show notification
    if (window.authManager) {
        window.authManager.showNotification('⚠️ Running in limited mode - Some features disabled', 'warning');
    } else {
        // Create basic notification if authManager not available
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #ff9800; color: white; padding: 15px; border-radius: 8px; z-index: 10000;">
                ⚠️ Running in limited mode
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

function initializeAuthManager() {
    // Authentication Manager Class
    class AuthManager {
        constructor() {
            this.currentUser = null;
            this.isAdmin = false;
            this.init();
        }

        init() {
            // Set up auth state listener
            auth.onAuthStateChanged((user) => {
                if (user) {
                    this.handleUserLogin(user);
                } else {
                    this.handleUserLogout();
                }
            });

            // Set up event listeners for auth forms
            this.setupAuthListeners();
            
            // Set up social login buttons
            this.setupSocialLogin();
            
            console.log('✅ Auth Manager initialized');
        }

        setupAuthListeners() {
            // Login form
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }

            // Signup form
            const signupForm = document.getElementById('signupForm');
            if (signupForm) {
                signupForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleSignup();
                });
            }

            // Forgot password form
            const forgotPasswordForm = document.getElementById('forgotPasswordForm');
            if (forgotPasswordForm) {
                forgotPasswordForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handlePasswordReset();
                });
            }

            // Clear any pre-filled values
            const loginEmail = document.getElementById('loginEmail');
            if (loginEmail) loginEmail.value = '';
        }

        setupSocialLogin() {
            // Google login button
            const googleButton = document.querySelector('.social-button.google');
            if (googleButton) {
                googleButton.addEventListener('click', () => {
                    this.handleGoogleLogin();
                });
            }

            // Facebook login button
            const facebookButton = document.querySelector('.social-button.facebook');
            if (facebookButton) {
                facebookButton.addEventListener('click', () => {
                    this.showNotification('Facebook login coming soon!', 'info');
                });
            }
        }

        // Show authentication overlay
        showAuthOverlay() {
            const authOverlay = document.getElementById('authOverlay');
            const mainWebsite = document.getElementById('mainWebsite');
            
            if (authOverlay && mainWebsite) {
                authOverlay.classList.add('active');
                authOverlay.classList.remove('hidden');
                mainWebsite.classList.add('hidden');
            }
            
            this.resetAuthForms();
        }

        // Show main website
        showMainWebsite() {
            const authOverlay = document.getElementById('authOverlay');
            const mainWebsite = document.getElementById('mainWebsite');
            
            if (authOverlay && mainWebsite) {
                authOverlay.classList.remove('active');
                authOverlay.classList.add('hidden');
                mainWebsite.classList.remove('hidden');
            }
        }

        // Reset all auth forms
        resetAuthForms() {
            const forms = [
                document.getElementById('loginForm'),
                document.getElementById('signupForm'),
                document.getElementById('forgotPasswordForm')
            ];
            
            forms.forEach(form => {
                if (form) form.reset();
            });
            
            this.switchAuthTab('login');
        }

        // Switch between auth tabs
        switchAuthTab(tab) {
            const loginTab = document.getElementById('loginTab');
            const signupTab = document.getElementById('signupTab');
            const loginForm = document.getElementById('loginForm');
            const signupForm = document.getElementById('signupForm');
            const forgotForm = document.getElementById('forgotPasswordForm');
            
            if (!loginTab || !signupTab) return;
            
            // Reset all
            [loginTab, signupTab].forEach(t => t.classList.remove('active'));
            [loginForm, signupForm, forgotForm].forEach(f => {
                if (f) f.classList.remove('active');
            });
            
            // Activate selected
            if (tab === 'login') {
                loginTab.classList.add('active');
                if (loginForm) loginForm.classList.add('active');
            } else if (tab === 'signup') {
                signupTab.classList.add('active');
                if (signupForm) signupForm.classList.add('active');
            } else if (tab === 'forgot') {
                if (forgotForm) forgotForm.classList.add('active');
            }
        }

        // Handle user login
        async handleLogin() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const button = document.querySelector('#loginForm button[type="submit"]');
            
            if (!button) return;

            const originalText = button.innerHTML;

            try {
                // Show loading state
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
                button.disabled = true;

                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                console.log('User logged in:', userCredential.user.email);
                
                button.innerHTML = '<i class="fas fa-check"></i> Success!';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                }, 1500);
                
            } catch (error) {
                console.error('Login error:', error);
                button.innerHTML = originalText;
                button.disabled = false;
                this.showNotification(this.getAuthErrorMessage(error), 'error');
            }
        }

        // Handle user signup
        async handleSignup() {
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            const button = document.querySelector('#signupForm button[type="submit"]');
            
            if (!button) return;

            const originalText = button.innerHTML;

            // Validation
            if (password !== confirmPassword) {
                this.showNotification('Passwords do not match!', 'error');
                return;
            }

            if (password.length < 6) {
                this.showNotification('Password must be at least 6 characters!', 'error');
                return;
            }

            try {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
                button.disabled = true;

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                console.log('User created:', userCredential.user.email);
                
                // Save user profile to Firebase
                await database.ref('users/' + userCredential.user.uid).set({
                    name: name,
                    email: email,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });

                button.innerHTML = '<i class="fas fa-check"></i> Account Created!';
                this.showNotification('Account created successfully!', 'success');
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                    this.switchAuthTab('login');
                }, 2000);
                
            } catch (error) {
                console.error('Signup error:', error);
                button.innerHTML = originalText;
                button.disabled = false;
                this.showNotification(this.getAuthErrorMessage(error), 'error');
            }
        }

        // Handle Google login
        async handleGoogleLogin() {
            const googleButton = document.querySelector('.social-button.google');
            if (!googleButton) return;

            const originalText = googleButton.innerHTML;

            try {
                googleButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                googleButton.disabled = true;

                const result = await auth.signInWithPopup(googleProvider);
                console.log('Google login successful:', result.user.email);
                
                googleButton.innerHTML = '<i class="fas fa-check"></i> Success!';
                
                setTimeout(() => {
                    googleButton.innerHTML = originalText;
                    googleButton.disabled = false;
                }, 1500);
                
            } catch (error) {
                console.error('Google login error:', error);
                googleButton.innerHTML = originalText;
                googleButton.disabled = false;
                
                if (error.code === 'auth/popup-closed-by-user') {
                    this.showNotification('Google login was cancelled', 'info');
                } else {
                    this.showNotification(this.getAuthErrorMessage(error), 'error');
                }
            }
        }

        // Handle password reset
        async handlePasswordReset() {
            const email = document.getElementById('forgotEmail').value;
            const button = document.querySelector('#forgotPasswordForm button[type="submit"]');
            
            if (!button) return;

            const originalText = button.innerHTML;

            if (!email || !email.includes('@')) {
                this.showNotification('Please enter a valid email address', 'error');
                return;
            }

            try {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                button.disabled = true;

                await auth.sendPasswordResetEmail(email);
                
                button.innerHTML = '<i class="fas fa-check"></i> Email Sent!';
                this.showNotification('Password reset email sent! Check your inbox.', 'success');
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                    this.switchAuthTab('login');
                }, 3000);
                
            } catch (error) {
                console.error('Password reset error:', error);
                button.innerHTML = originalText;
                button.disabled = false;
                this.showNotification(this.getAuthErrorMessage(error), 'error');
            }
        }

        // Handle user logout
        async handleLogout() {
            try {
                await auth.signOut();
                this.showNotification('Successfully logged out!', 'info');
            } catch (error) {
                console.error('Logout error:', error);
                this.showNotification('Error during logout', 'error');
            }
        }

        // Handle successful user login
        handleUserLogin(user) {
            console.log('User authenticated:', user.email);
            this.currentUser = user;
            
            // Check if user is admin
            this.isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            
            this.showMainWebsite();
            this.updateAuthUI(user);
            
            // Notify store about login
            if (window.store && typeof window.store.handleUserLogin === 'function') {
                window.store.handleUserLogin(user);
            }
            
            if (this.isAdmin) {
                this.showNotification('👑 Welcome Admin! Dashboard activated.', 'success');
                this.showAdminInterface();
            } else {
                this.showNotification(`👋 Welcome ${user.email}!`, 'success');
                this.hideAdminInterface();
            }
        }

        // Handle user logout
        handleUserLogout() {
            console.log('User signed out');
            this.currentUser = null;
            this.isAdmin = false;
            
            this.updateAuthUI(null);
            
            if (window.store && typeof window.store.handleUserLogout === 'function') {
                window.store.handleUserLogout();
            }
            
            this.hideAdminInterface();
        }

        // Update UI based on authentication state
        updateAuthUI(user) {
            const authButtons = document.getElementById('authButtons');
            const userMenu = document.getElementById('userMenu');
            
            if (user) {
                if (authButtons) authButtons.classList.add('hidden');
                if (userMenu) {
                    userMenu.classList.remove('hidden');
                    const userEmail = userMenu.querySelector('#userEmail');
                    if (userEmail) userEmail.textContent = user.email;
                }
                
                if (this.isAdmin) {
                    this.showAdminInterface();
                } else {
                    this.hideAdminInterface();
                }
            } else {
                if (authButtons) authButtons.classList.remove('hidden');
                if (userMenu) userMenu.classList.add('hidden');
                this.hideAdminInterface();
            }
        }

        // Show admin interface
        showAdminInterface() {
            const adminNavLink = document.querySelector('.admin-nav-link');
            if (adminNavLink) {
                adminNavLink.classList.remove('hidden');
                adminNavLink.style.display = 'block';
            }
            
            const adminStatus = document.getElementById('adminStatus');
            if (adminStatus) {
                adminStatus.innerHTML = '<span class="status-badge success">👑 Admin Mode Active</span>';
            }
        }

        // Hide admin interface
        hideAdminInterface() {
            const adminNavLink = document.querySelector('.admin-nav-link');
            const adminSection = document.getElementById('admin');
            
            if (adminNavLink) {
                adminNavLink.classList.add('hidden');
                adminNavLink.style.display = 'none';
            }
            
            const adminStatus = document.getElementById('adminStatus');
            if (adminStatus) {
                adminStatus.innerHTML = '<span class="status-badge">🔒 Authentication Required</span>';
            }
            
            if (adminSection && adminSection.classList.contains('active')) {
                if (window.store && typeof window.store.showSection === 'function') {
                    window.store.showSection('home');
                }
            }
        }

        // Check if user is authenticated
        isAuthenticated() {
            return this.currentUser !== null;
        }

        // Check if user is admin
        isUserAdmin() {
            return this.isAdmin;
        }

        // Get current user
        getCurrentUser() {
            return this.currentUser;
        }

        // Auth error messages
        getAuthErrorMessage(error) {
            const errorMessages = {
                'auth/invalid-email': 'Invalid email address',
                'auth/user-disabled': 'This account has been disabled',
                'auth/user-not-found': 'No account found with this email',
                'auth/wrong-password': 'Incorrect password',
                'auth/email-already-in-use': 'Email already in use',
                'auth/weak-password': 'Password is too weak',
                'auth/network-request-failed': 'Network error. Please check your connection',
                'auth/too-many-requests': 'Too many attempts. Please try again later',
                'auth/invalid-credential': 'Invalid login credentials',
                'auth/account-exists-with-different-credential': 'An account already exists with the same email address'
            };
            
            return errorMessages[error.code] || 'Authentication failed. Please try again';
        }

        // Show notification
        showNotification(message, type = 'info') {
            // Remove existing notifications
            document.querySelectorAll('.custom-notification').forEach(notification => {
                notification.remove();
            });

            const notification = document.createElement('div');
            notification.className = `custom-notification ${type}`;
            notification.textContent = message;
            
            const styles = {
                success: 'background: #27ae60;',
                error: 'background: #e74c3c;',
                warning: 'background: #f59e0b;',
                info: 'background: #3498db;'
            };
            
            notification.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 3000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                ${styles[type] || styles.info}
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }

        // Require authentication for protected actions
        requireAuthForAction(action) {
            if (!this.isAuthenticated()) {
                this.showNotification(`🔐 Please log in to ${action}`, 'info');
                this.showAuthOverlay();
                return false;
            }
            return true;
        }

        // Require admin access for admin actions
        requireAdminAccess(action) {
            if (!this.isAuthenticated()) {
                this.showNotification(`🔐 Please log in to ${action}`, 'info');
                this.showAuthOverlay();
                return false;
            }
            
            if (!this.isAdmin) {
                this.showNotification('🔒 Admin access required for this action', 'error');
                return false;
            }
            
            return true;
        }
    }

    // Create and initialize Auth Manager
    authManager = new AuthManager();
    window.authManager = authManager;
}

// Start Firebase initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Favs Bling authentication system...');
    initializeFirebaseWhenReady();
});

// Global functions for HTML onclick handlers
window.handleLogout = function() {
    if (window.authManager) {
        window.authManager.handleLogout();
    }
};

window.showAuthOverlay = function() {
    if (window.authManager) {
        window.authManager.showAuthOverlay();
    }
};

window.switchAuthTab = function(tab) {
    if (window.authManager) {
        window.authManager.switchAuthTab(tab);
    }
};

// Debug helper
window.debugAuth = function() {
    if (window.authManager) {
        console.log('Auth Manager:', window.authManager);
        console.log('Current User:', window.authManager.currentUser);
        console.log('Is Admin:', window.authManager.isAdmin);
        console.log('Firebase Config Available:', !!window.CONFIG);
    } else {
        console.log('Auth Manager not initialized');
    }
};