// API.js - Main Application Logic for Favs Bling with Backend Integration

// Store Configuration with Firebase Authentication
class FavsBlingStore {
    constructor() {
        this.products = JSON.parse(localStorage.getItem('favsProducts')) || this.getDefaultProducts();
        this.cart = [];
        this.orders = JSON.parse(localStorage.getItem('favsOrders')) || [];
        this.customers = JSON.parse(localStorage.getItem('favsCustomers')) || [];
        this.currentSection = 'home';
        this.backendUrl = "https://favs-bling-backend.onrender.com";
        this.paystackPublicKey = CONFIG.PAYSTACK_PUBLIC_KEY;
        this.adminEmail = CONFIG.ADMIN_EMAIL;
        this.currentUser = null;
        this.isAdmin = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Check if user is already logged in via auth manager
        if (window.authManager && window.authManager.currentUser) {
            this.handleUserLogin(window.authManager.currentUser);
        }
        
        // Load products immediately (public access)
        this.loadProducts();
        
        // Test backend connection on startup
        await this.testBackendConnection();
    }

    async testBackendConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/health`);
            const data = await response.json();
            console.log('✅ Backend connection:', data);
            this.showNotification('🔗 Backend connected successfully', 'success');
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            this.showNotification('⚠️ Backend connection failed - using fallback', 'warning');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('data-section');
                
                // FIXED: Enhanced admin access check - allow direct access without cart
                if (section === 'admin') {
                    if (!this.isAdmin) {
                        this.showNotification('🔒 Admin access required. Please log in as administrator.', 'error');
                        if (window.authManager) {
                            window.authManager.showAuthOverlay();
                        }
                        return;
                    } else {
                        // FIXED: Direct admin access without requiring cart
                        this.showSection(section);
                        this.loadAdminItems();
                        this.updateAdminStats();
                        this.loadOrders();
                        this.loadCustomers();
                        return; // Important: return early to prevent default behavior
                    }
                }
                
                // Check authentication for cart access - always require auth for cart
                if (section === 'cart') {
                    if (!this.requireAuthForAction('view cart')) {
                        return;
                    }
                }
                
                this.showSection(section);
            });
        });

        // CTA Buttons
        document.querySelectorAll('.cta-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                this.showSection(section);
            });
        });

        // Checkout button with auth check
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                if (this.requireAuthForAction('checkout')) {
                    this.showSection('checkout');
                }
            });
        }

        // Forms
        const checkoutForm = document.getElementById('checkoutForm');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCheckout();
            });
        }

        const addItemForm = document.getElementById('addItemForm');
        if (addItemForm) {
            addItemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddItem();
            });
        }

        // Login button in nav
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                if (window.authManager) {
                    window.authManager.showAuthOverlay();
                }
            });
        }

        // Auto-fill customer email from logged in user
        const customerEmail = document.getElementById('customerEmail');
        if (customerEmail) {
            customerEmail.addEventListener('focus', () => {
                if (!customerEmail.value && this.currentUser) {
                    customerEmail.value = this.currentUser.email;
                }
            });
        }

        // Filter buttons for products
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                
                // Update active filter button
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Filter products
                const productCards = document.querySelectorAll('.product-card');
                productCards.forEach(card => {
                    const productName = card.querySelector('h3').textContent.toLowerCase();
                    if (filter === 'all' || 
                        (filter === 'clothing' && productName.includes('shirt')) ||
                        (filter === 'clothing' && productName.includes('dress')) ||
                        (filter === 'clothing' && productName.includes('jeans')) ||
                        (filter === 'clothing' && productName.includes('blouse')) ||
                        (filter === 'accessories' && productName.includes('accessory'))) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // Check authentication for protected actions
    requireAuthForAction(action) {
        if (!this.currentUser) {
            this.showNotification(`🔐 Please log in to ${action}`, 'info');
            if (window.authManager) {
                window.authManager.showAuthOverlay();
            }
            return false;
        }
        return true;
    }

    // ===== USER MANAGEMENT =====

    async handleUserLogin(user) {
        console.log('🔄 handleUserLogin called for:', user.email);
        
        this.currentUser = user;
        
        // Enhanced admin check
        this.isAdmin = user.email.toLowerCase() === this.adminEmail.toLowerCase();
        
        console.log('🔄 User logged in:', user.email);
        console.log('👑 Is admin:', this.isAdmin);
        
        // Load user-specific cart from Firebase
        await this.loadUserCart();
        
        this.loadProducts();
        this.updateCartDisplay();
        this.updateAuthUI(user);
        
        if (this.isAdmin) {
            this.showNotification('👑 Welcome Admin! Dashboard activated.', 'success');
            this.showAdminInterface();
            // Auto-show admin section for admin users
            setTimeout(() => {
                this.showSection('admin');
                console.log('✅ Auto-showing admin section');
            }, 1000);
        } else {
            this.showNotification(`👋 Welcome ${user.email}!`, 'success');
            this.showSection('home');
        }
    }

    // Enhanced logout to always clear cart and reset UI properly
    handleUserLogout() {
        console.log('🔄 handleUserLogout called');
        
        this.currentUser = null;
        this.isAdmin = false;
        
        // Always clear cart on logout
        this.cart = [];
        
        this.hideAdminInterface();
        this.updateAuthUI(null);
        this.updateCartDisplay(); // Refresh cart display
        this.showSection('home'); // Always go to home after logout
        
        console.log('✅ User fully logged out and cart cleared');
    }

    // Load user-specific cart from Firebase
    async loadUserCart() {
        if (!this.currentUser) return;
        
        try {
            const cartRef = firebase.database().ref('carts/' + this.currentUser.uid);
            const snapshot = await cartRef.once('value');
            
            if (snapshot.exists()) {
                this.cart = snapshot.val();
                console.log('🛒 Loaded user cart:', this.cart);
            } else {
                this.cart = [];
                console.log('🛒 No existing cart found, starting fresh');
            }
        } catch (error) {
            console.error('Error loading user cart:', error);
            this.cart = [];
        }
    }

    // Save user-specific cart to Firebase
    async saveCart() {
        if (!this.currentUser) {
            console.log('No user logged in, skipping cart save');
            return;
        }
        
        try {
            const cartRef = firebase.database().ref('carts/' + this.currentUser.uid);
            await cartRef.set(this.cart);
            console.log('🛒 Saved user cart to Firebase:', this.cart);
        } catch (error) {
            console.error('Error saving user cart to Firebase:', error);
            // Fallback to localStorage if Firebase fails
            try {
                localStorage.setItem('favsCart_' + this.currentUser.uid, JSON.stringify(this.cart));
                console.log('🛒 Saved user cart to localStorage as fallback');
            } catch (localError) {
                console.error('Error saving to localStorage:', localError);
            }
        }
    }

    // Update UI based on authentication state
    updateAuthUI(user) {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        
        if (user) {
            // User is logged in
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) {
                userMenu.classList.remove('hidden');
                const userEmail = userMenu.querySelector('#userEmail');
                if (userEmail) userEmail.textContent = user.email;
            }
        } else {
            // User is logged out
            if (authButtons) authButtons.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    }

    showAdminInterface() {
        const adminNavLink = document.querySelector('.admin-nav-link');
        const adminSection = document.getElementById('admin');
        
        console.log('🔄 Showing admin interface...');
        console.log('🔍 Admin nav link found:', !!adminNavLink);
        console.log('🔍 Admin section found:', !!adminSection);
        
        if (adminNavLink) {
            adminNavLink.classList.remove('hidden');
            adminNavLink.style.display = 'block';
            console.log('✅ Admin nav link should be visible now');
        }
        
        if (adminSection) {
            adminSection.classList.remove('hidden');
            console.log('✅ Admin section should be visible now');
        }
        
        // Update admin status display
        const adminStatus = document.getElementById('adminStatus');
        if (adminStatus) {
            adminStatus.innerHTML = '<span class="status-badge success">👑 Admin Mode Active</span>';
        }
        
        // Load admin data
        this.loadAdminItems();
        this.updateAdminStats();
    }

    hideAdminInterface() {
        const adminNavLink = document.querySelector('.admin-nav-link');
        const adminSection = document.getElementById('admin');
        
        if (adminNavLink) {
            adminNavLink.classList.add('hidden');
            adminNavLink.style.display = 'none';
        }
        
        if (adminSection) {
            adminSection.classList.add('hidden');
        }
        
        // If current section is admin, redirect to home
        if (this.currentSection === 'admin') {
            this.showSection('home');
        }
    }

    // ===== PRODUCT MANAGEMENT =====

    getDefaultProducts() {
        return {
            clothing: [
                { 
                    id: 1, 
                    name: "Designer T-Shirt", 
                    price: 4500, 
                    image_url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", 
                    category: "clothing",
                    description: "Premium quality cotton t-shirt with unique design",
                    stock: 50
                },
                { 
                    id: 2, 
                    name: "Casual Dress", 
                    price: 8500, 
                    image_url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400", 
                    category: "clothing",
                    description: "Elegant casual dress for everyday wear",
                    stock: 30
                },
                { 
                    id: 3, 
                    name: "Denim Jeans", 
                    price: 6500, 
                    image_url: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400", 
                    category: "clothing",
                    description: "Comfortable denim jeans perfect for casual wear",
                    stock: 25
                },
                { 
                    id: 4, 
                    name: "Summer Blouse", 
                    price: 5500, 
                    image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400", 
                    category: "clothing",
                    description: "Light and breezy summer blouse",
                    stock: 40
                }
            ],
            service: [
                { 
                    id: 101, 
                    name: "Classic Manicure", 
                    price: 2500, 
                    image_url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400", 
                    category: "service",
                    description: "Professional classic manicure with nail care"
                },
                { 
                    id: 102, 
                    name: "Gel Nails", 
                    price: 4500, 
                    image_url: "https://images.unsplash.com/photo-1607778784676-3ed1c2b6e335?w=400", 
                    category: "service",
                    description: "Long-lasting gel nail polish application"
                },
                { 
                    id: 103, 
                    name: "Nail Art Design", 
                    price: 3500, 
                    image_url: "https://images.unsplash.com/photo-1577083552431-6e5fd01988a3?w=400", 
                    category: "service",
                    description: "Custom nail art designs and patterns"
                },
                { 
                    id: 104, 
                    name: "Spa Pedicure", 
                    price: 5000, 
                    image_url: "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=400", 
                    category: "service",
                    description: "Relaxing spa pedicure with foot massage"
                }
            ]
        };
    }

    loadProducts() {
        this.loadProductCategory('clothing', 'productsGrid');
        this.loadProductCategory('service', 'servicesGrid');
    }

    loadProductCategory(category, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';

        if (!this.products[category] || this.products[category].length === 0) {
            container.innerHTML = `<div class="no-items">No ${category} items available</div>`;
            return;
        }

        this.products[category].forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = category === 'service' ? 'service-card' : 'product-card';
            productCard.innerHTML = `
                <div class="${category === 'service' ? 'service-image' : 'product-image'}">
                    <img src="${product.image_url}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Product+Image'">
                </div>
                <h3>${product.name}</h3>
                <div class="${category === 'service' ? 'service-price' : 'product-price'}">₦${product.price.toLocaleString()}</div>
                <button class="add-to-cart" onclick="store.addToCart(${product.id}, '${category}')">
                    🛒 Add to Cart
                </button>
            `;
            container.appendChild(productCard);
        });
    }

    // Add to cart now requires authentication and saves to user-specific cart
    async addToCart(productId, category) {
        // Check authentication before adding to cart
        if (!this.requireAuthForAction('add items to cart')) {
            return;
        }

        const product = this.products[category].find(p => p.id === productId);
        if (!product) return;

        const existingItem = this.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...product,
                quantity: 1
            });
        }

        await this.saveCart(); // Save to user-specific cart
        this.updateCartDisplay();
        this.showNotification(`✅ Added ${product.name} to cart!`, 'success');
    }

    // FIXED: Enhanced removeFromCart function
    async removeFromCart(productId) {
        if (!this.currentUser) {
            this.showNotification('Please log in to manage cart', 'error');
            return;
        }
        
        this.cart = this.cart.filter(item => item.id !== productId);
        await this.saveCart(); // Save to user-specific cart
        this.updateCartDisplay();
        this.showNotification('🗑️ Item removed from cart', 'info');
    }

    // FIXED: Enhanced updateQuantity function
    async updateQuantity(productId, change) {
        if (!this.currentUser) {
            this.showNotification('Please log in to manage cart', 'error');
            return;
        }
        
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                await this.removeFromCart(productId);
            } else {
                await this.saveCart(); // Save to user-specific cart
                this.updateCartDisplay();
            }
        }
    }

    // FIXED: Enhanced clearCart function
    async clearCart() {
        if (!this.currentUser) {
            this.showNotification('Please log in to manage cart', 'error');
            return;
        }
        
        if (this.cart.length === 0) {
            this.showNotification('🛒 Cart is already empty', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear your entire cart?')) {
            this.cart = [];
            await this.saveCart(); // Save to user-specific cart
            this.updateCartDisplay();
            this.showNotification('🛒 Cart cleared successfully', 'success');
        }
    }

    // FIXED: Enhanced cart display with better remove functionality
    updateCartDisplay() {
        const cartBadge = document.getElementById('cartBadge');
        const cartItems = document.getElementById('cartItems');
        const subtotalEl = document.getElementById('subtotal');
        const totalAmountEl = document.getElementById('totalAmount');
        const checkoutBtn = document.getElementById('checkoutBtn');

        // Show authentication required message if user is not logged in
        if (!this.currentUser) {
            if (cartBadge) cartBadge.textContent = '0';
            if (cartItems) {
                cartItems.innerHTML = `
                    <div class="empty-cart-state">
                        <div class="empty-cart-icon">🔐</div>
                        <h4>Authentication Required</h4>
                        <p>Please log in to view your cart</p>
                        <button class="cta-button" onclick="showAuthOverlay()">Login / Sign Up</button>
                    </div>
                `;
            }
            if (subtotalEl) subtotalEl.textContent = '0';
            if (totalAmountEl) totalAmountEl.textContent = '0';
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartBadge) cartBadge.textContent = totalItems;

        if (cartItems) {
            cartItems.innerHTML = '';
            if (this.cart.length === 0) {
                cartItems.innerHTML = `
                    <div class="empty-cart-state">
                        <div class="empty-cart-icon">🛒</div>
                        <h4>Your cart is empty</h4>
                        <p>Add some products or services to get started</p>
                        <button class="cta-button" data-section="products">Browse Products</button>
                    </div>
                `;
            } else {
                this.cart.forEach(item => {
                    const itemTotal = item.price * item.quantity;
                    const cartItem = document.createElement('div');
                    cartItem.className = 'cart-item';
                    cartItem.innerHTML = `
                        <div class="item-details">
                            <h4>${item.name}</h4>
                            <div>₦${item.price.toLocaleString()} each</div>
                            <div><strong>₦${itemTotal.toLocaleString()}</strong></div>
                        </div>
                        <div class="item-controls">
                            <button class="quantity-btn" onclick="store.updateQuantity(${item.id}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" onclick="store.updateQuantity(${item.id}, 1)">+</button>
                            <button class="remove-btn" onclick="store.removeFromCart(${item.id})">Remove</button>
                        </div>
                    `;
                    cartItems.appendChild(cartItem);
                });
                
                // FIXED: Add clear cart button when cart has items
                const clearCartContainer = document.createElement('div');
                clearCartContainer.style.textAlign = 'center';
                clearCartContainer.style.marginTop = '20px';
                clearCartContainer.innerHTML = `
                    <button class="clear-cart-btn" onclick="store.clearCart()" style="background: var(--error); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        🗑️ Clear Entire Cart
                    </button>
                `;
                cartItems.appendChild(clearCartContainer);
            }
        }

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString();
        if (totalAmountEl) totalAmountEl.textContent = subtotal.toLocaleString();
        
        if (checkoutBtn) {
            checkoutBtn.disabled = this.cart.length === 0;
        }
    }

    showSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            }
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionId;
        }

        if (sectionId === 'checkout') {
            this.updateOrderReview();
        } else if (sectionId === 'admin' && this.isAdmin) {
            this.loadAdminItems();
            this.updateAdminStats();
        }
    }

    updateOrderReview() {
        const orderReview = document.getElementById('orderReview');
        const orderTotal = document.getElementById('orderTotal');

        if (orderReview && orderTotal) {
            orderReview.innerHTML = '';
            const total = this.cart.reduce((sum, item) => {
                const itemTotal = item.price * item.quantity;
                const itemEl = document.createElement('div');
                itemEl.className = 'order-item';
                itemEl.innerHTML = `${item.name} - ${item.quantity} x ₦${item.price.toLocaleString()} = ₦${itemTotal.toLocaleString()}`;
                orderReview.appendChild(itemEl);
                return sum + itemTotal;
            }, 0);

            orderTotal.textContent = total.toLocaleString();
        }
    }

    // FIXED: Paystack callback function - properly defined
    async handleCheckout() {
        if (!this.currentUser) {
            this.showNotification('Please log in to checkout', 'error');
            if (window.authManager) {
                window.authManager.showAuthOverlay();
            }
            return;
        }

        const name = document.getElementById('customerName').value;
        const email = document.getElementById('customerEmail').value;
        const phone = document.getElementById('customerPhone').value;
        const address = document.getElementById('customerAddress').value;
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (!name || !email || !phone) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (total === 0) {
            this.showNotification('Your cart is empty', 'error');
            return;
        }

        this.showNotification('Processing payment...', 'info');

        try {
            // FIXED: Properly define callback functions for Paystack
            const paymentCallback = (response) => {
                console.log('Paystack callback received:', response);
                this.handlePaymentSuccess(response.reference, email, total, name, phone, address);
            };

            const paymentOnClose = () => {
                console.log('Paystack payment closed by user');
                this.showNotification('Payment was cancelled', 'warning');
            };

            // Initialize Paystack payment with properly defined functions
            const handler = PaystackPop.setup({
                key: this.paystackPublicKey,
                email: email,
                amount: total * 100, // Convert to kobo
                currency: 'NGN',
                ref: 'FB_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Customer Name",
                            variable_name: "customer_name",
                            value: name
                        },
                        {
                            display_name: "Phone Number",
                            variable_name: "phone_number",
                            value: phone
                        },
                        {
                            display_name: "Delivery Address",
                            variable_name: "delivery_address", 
                            value: address || 'Not provided'
                        },
                        {
                            display_name: "User ID",
                            variable_name: "user_id",
                            value: this.currentUser.uid
                        }
                    ]
                },
                callback: paymentCallback,
                onClose: paymentOnClose
            });

            handler.openIframe();

        } catch (error) {
            console.error('Paystack error:', error);
            this.showNotification('Payment initialization failed. Please try again.', 'error');
        }
    }

    async handlePaymentSuccess(reference, email, total, name, phone, address) {
        try {
            this.showNotification('🔍 Verifying payment with secure backend...', 'info');
            
            // Step 1: Verify payment with backend
            const verificationResponse = await fetch(`${this.backendUrl}/verify-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reference })
            });

            const verificationResult = await verificationResponse.json();

            if (!verificationResult.success) {
                throw new Error(verificationResult.message || 'Payment verification failed');
            }

            console.log('✅ Backend verification successful:', verificationResult);
            this.showNotification('✅ Payment verified securely!', 'success');

            // Step 2: Create order with verified payment
            const order = {
                id: reference,
                customerEmail: email,
                customerName: name,
                customerPhone: phone,
                deliveryAddress: address,
                items: [...this.cart],
                total: total,
                status: 'paid',
                date: new Date().toISOString(),
                paymentMethod: 'paystack',
                verified: true, // Mark as backend-verified
                verificationData: verificationResult.data,
                backendVerified: true
            };

            // Save order
            this.orders.push(order);
            this.saveOrders();

            // Update customer stats
            this.updateCustomerStats(email, total);

            // Generate receipt
            this.generateReceipt(reference, email, total);
            
            // Clear cart after successful payment
            this.cart = [];
            await this.saveCart();
            this.updateCartDisplay();
            
            // Show success modal
            this.showSuccessModal();
            this.showNotification('🎉 Payment verified and completed successfully!', 'success');
            
            // Clear form
            document.getElementById('checkoutForm').reset();
            
            // Update admin stats if admin is viewing
            if (this.isAdmin) {
                this.updateAdminStats();
            }
            
        } catch (error) {
            console.error('❌ Payment verification error:', error);
            this.showNotification(`❌ Payment verification failed: ${error.message}`, 'error');
            
            // Keep items in cart for retry
            this.showNotification('🛒 Items kept in cart for retry', 'info');
        }
    }

    generateReceipt(reference, email, total) {
        const receiptContent = `
FAVS BLING - OFFICIAL RECEIPT
===============================
Receipt No: ${reference}
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Customer: ${email}
Backend Verified: ✅ YES

ITEMS PURCHASED:
${this.cart.map(item => 
    `${item.name.padEnd(25)} ${item.quantity}x ₦${item.price.toLocaleString().padStart(8)} = ₦${(item.price * item.quantity).toLocaleString().padStart(10)}`
).join('\n')}

SUBTOTAL: ₦${total.toLocaleString().padStart(15)}
TOTAL: ₦${total.toLocaleString().padStart(18)}
PAYMENT METHOD: Paystack
STATUS: ✅ PAID & VERIFIED

Thank you for your purchase!
Contact: support@favsbling.com
Backend: ${this.backendUrl}
        `.trim();

        // Create and download receipt file
        const blob = new Blob([receiptContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `favs-bling-receipt-${reference}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== ADMIN FUNCTIONS =====

    handleAddItem() {
        if (!this.isAdmin) {
            this.showNotification('Admin access required', 'error');
            return;
        }

        const name = document.getElementById('itemName').value;
        const price = parseInt(document.getElementById('itemPrice').value);
        const category = document.getElementById('itemCategory').value;
        const imageUrl = document.getElementById('itemImageUrl').value;
        const description = document.getElementById('itemDescription').value;

        if (!name || !price || !category || !imageUrl) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }

        const newItem = {
            id: Date.now(),
            name: name,
            price: price,
            image_url: imageUrl,
            category: category,
            description: description,
            stock: 0
        };

        if (!this.products[category]) {
            this.products[category] = [];
        }

        this.products[category].push(newItem);
        this.saveProducts();
        this.loadProducts();
        this.loadAdminItems();
        this.updateAdminStats();
        
        document.getElementById('addItemForm').reset();
        this.showNotification('✅ Item added successfully!', 'success');
    }

    loadAdminItems() {
        if (!this.isAdmin) return;
        
        this.loadAdminCategory('clothing', 'clothingList', 'clothingCount');
        this.loadAdminCategory('service', 'servicesList', 'servicesCount');
    }

    loadAdminCategory(category, containerId, countId) {
        const container = document.getElementById(containerId);
        const countElement = document.getElementById(countId);
        
        if (!container) return;
        
        container.innerHTML = '';

        if (!this.products[category] || this.products[category].length === 0) {
            container.innerHTML = `<div class="no-items">No ${category} items added yet</div>`;
            if (countElement) countElement.textContent = '0 items';
            return;
        }

        if (countElement) {
            countElement.textContent = `${this.products[category].length} items`;
        }

        this.products[category].forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'admin-item';
            itemEl.innerHTML = `
                <div class="admin-item-content">
                    <img src="${item.image_url}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/50x50?text=Image'">
                    <div class="admin-item-info">
                        <strong>${item.name}</strong>
                        <div>₦${item.price.toLocaleString()}</div>
                    </div>
                </div>
                <button class="delete-btn" onclick="store.deleteItem(${item.id}, '${category}')">
                    Delete
                </button>
            `;
            container.appendChild(itemEl);
        });
    }

    deleteItem(itemId, category) {
        if (!this.isAdmin) {
            this.showNotification('Admin access required', 'error');
            return;
        }

        if (confirm('Are you sure you want to delete this item?')) {
            this.products[category] = this.products[category].filter(item => item.id !== itemId);
            this.saveProducts();
            this.loadProducts();
            this.loadAdminItems();
            this.updateAdminStats();
            this.showNotification('🗑️ Item deleted successfully', 'success');
        }
    }

    updateAdminStats() {
        if (!this.isAdmin) return;

        const totalProducts = this.products.clothing?.length || 0;
        const totalServices = this.products.service?.length || 0;
        const totalRevenue = this.calculateTotalRevenue();

        const totalProductsEl = document.getElementById('totalProducts');
        const totalServicesEl = document.getElementById('totalServices');
        const totalRevenueEl = document.getElementById('totalRevenue');

        if (totalProductsEl) totalProductsEl.textContent = totalProducts;
        if (totalServicesEl) totalServicesEl.textContent = totalServices;
        if (totalRevenueEl) totalRevenueEl.textContent = `₦${totalRevenue.toLocaleString()}`;

        // Update item counts
        const clothingCountEl = document.getElementById('clothingCount');
        const servicesCountEl = document.getElementById('servicesCount');

        if (clothingCountEl) clothingCountEl.textContent = `${totalProducts} items`;
        if (servicesCountEl) servicesCountEl.textContent = `${totalServices} items`;
    }

    calculateTotalRevenue() {
        let revenue = 0;
        Object.values(this.products).forEach(category => {
            category.forEach(item => {
                revenue += item.price * 10; // Estimate 10 sales per item
            });
        });
        return revenue;
    }

    addCustomer(customer) {
        // Check if customer already exists
        const existingCustomer = this.customers.find(c => c.id === customer.id);
        if (!existingCustomer) {
            this.customers.push(customer);
            this.saveCustomers();
        }
    }

    updateCustomerStats(email, amount) {
        const customer = this.customers.find(c => c.email === email);
        if (customer) {
            customer.orders += 1;
            customer.totalSpent += amount;
            this.saveCustomers();
        }
    }

    // Save methods
    saveProducts() {
        localStorage.setItem('favsProducts', JSON.stringify(this.products));
    }

    saveOrders() {
        localStorage.setItem('favsOrders', JSON.stringify(this.orders));
    }

    saveCustomers() {
        localStorage.setItem('favsCustomers', JSON.stringify(this.customers));
    }

    // Backend connection check
    async checkBackendConnection() {
        const backendStatus = document.getElementById('backendStatus');
        if (backendStatus) {
            backendStatus.innerHTML = '<span class="status-warning">🔄 Checking...</span>';
        }

        try {
            const response = await fetch(`${this.backendUrl}/health`);
            const data = await response.json();
            
            if (backendStatus) {
                backendStatus.innerHTML = '<span class="status-success">✅ Connected</span>';
            }
            this.showNotification('✅ Backend connection successful', 'success');
            
            // Also test Paystack connection
            const paystackTest = await fetch(`${this.backendUrl}/test-paystack`);
            const paystackData = await paystackTest.json();
            
            if (paystackData.success) {
                this.showNotification('✅ Paystack connection verified', 'success');
            }
            
        } catch (error) {
            if (backendStatus) {
                backendStatus.innerHTML = '<span class="status-error">❌ Disconnected</span>';
            }
            this.showNotification('❌ Backend connection failed', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
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
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    showSuccessModal() {
        const successModal = document.getElementById('successModal');
        if (successModal) {
            successModal.style.display = 'block';
        }
    }

    hideSuccessModal() {
        const successModal = document.getElementById('successModal');
        if (successModal) {
            successModal.style.display = 'none';
        }
        this.showSection('home');
    }

    // Debug methods
    checkAdminStatus() {
        console.log('=== ADMIN STATUS CHECK ===');
        console.log('Current User:', this.currentUser);
        console.log('Is Admin:', this.isAdmin);
        console.log('Admin Email:', this.adminEmail);
        
        if (this.currentUser) {
            console.log('User Email:', this.currentUser.email);
            console.log('Email Match:', this.currentUser.email.toLowerCase() === this.adminEmail.toLowerCase());
        }
        
        // Check admin nav link visibility
        const adminNavLink = document.querySelector('.admin-nav-link');
        console.log('Admin nav link:', adminNavLink);
        console.log('Admin nav link classes:', adminNavLink?.className);
        console.log('Admin nav link computed display:', window.getComputedStyle(adminNavLink).display);
        
        // Force show admin if conditions are met
        if (this.isAdmin) {
            this.showAdminInterface();
            this.showSection('admin');
            this.showNotification('👑 Admin dashboard activated!', 'success');
        }
    }

    // Force admin for testing
    forceAdminMode() {
        this.isAdmin = true;
        this.showAdminInterface();
        this.showSection('admin');
        this.showNotification('🔧 Admin mode forced for testing', 'warning');
        console.log('Admin mode forced for testing');
    }
}

// Initialize store when page loads
let store;
document.addEventListener('DOMContentLoaded', () => {
    store = new FavsBlingStore();
    window.store = store;
});

// Global functions
window.closeSuccessModal = function() {
    if (window.store) {
        window.store.hideSuccessModal();
    }
};

// Debug functions
window.debugAdmin = function() {
    if (store) {
        store.checkAdminStatus();
    }
};

window.forceAdmin = function() {
    if (store) {
        store.forceAdminMode();
    }
};

window.debugStore = function() {
    if (window.store) {
        console.log('Store instance:', window.store);
        console.log('Current User:', window.store.currentUser);
        console.log('Is Admin:', window.store.isAdmin);
        console.log('Products:', window.store.products);
        console.log('Orders:', window.store.orders);
        console.log('Customers:', window.store.customers);
    } else {
        console.log('Store not initialized yet');
    }
};
