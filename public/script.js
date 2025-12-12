const API_BASE = '/api';

// State
let inventory = [];
let cart = [];

// DOM Elements
const productGrid = document.getElementById('productGrid');
const cartToggle = document.getElementById('cartToggle');
const cartCount = document.getElementById('cartCount');
const cartModal = document.getElementById('cartModal');
const closeModal = document.getElementById('closeModal');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const orderForm = document.getElementById('orderForm');
const checkoutBtn = document.getElementById('checkoutBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Orders Modal Elements
const ordersToggle = document.getElementById('ordersToggle');
const ordersModal = document.getElementById('ordersModal');
const closeOrdersModal = document.getElementById('closeOrdersModal');
const ordersList = document.getElementById('ordersList');

// Closed Modal Elements
const closedModal = document.getElementById('closedModal');
const closeClosedModalBtn = document.getElementById('closeClosedModalBtn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchInventory();
    setupEventListeners();
});

function setupEventListeners() {
    cartToggle.addEventListener('click', () => {
        updateCartUI();
        cartModal.classList.add('active');
    });

    closeModal.addEventListener('click', () => {
        cartModal.classList.remove('active');
    });

    cartModal.addEventListener('click', (e) => {
        if (e.target === cartModal || e.target.classList.contains('close-btn')) {
            cartModal.classList.remove('active');
        }
    });

    // Order Modal Listeners
    ordersToggle.addEventListener('click', () => {
        fetchOrders();
        ordersModal.classList.add('active');
    });

    closeOrdersModal.addEventListener('click', () => {
        ordersModal.classList.remove('active');
    });

    ordersModal.addEventListener('click', (e) => {
        if (e.target === ordersModal) {
            ordersModal.classList.remove('active');
        }
    });

    closeClosedModalBtn.addEventListener('click', () => {
        closedModal.classList.remove('active');
    });

    orderForm.addEventListener('submit', handleOrderSubmit);
}

// Fetch Orders
async function fetchOrders() {
    ordersList.innerHTML = '<p style="text-align: center; color: #888; padding: 1rem;">載入中...</p>';
    try {
        const response = await fetch(`${API_BASE}/orders`);
        const orders = await response.json();
        renderOrders(orders);
    } catch (error) {
        console.error('Failed to fetch orders:', error);
        ordersList.innerHTML = '<p style="text-align: center; color: red;">無法載入訂單列表</p>';
    }
}

function renderOrders(orders) {
    if (orders.length === 0) {
        ordersList.innerHTML = '<p style="text-align: center; color: #888; padding: 1rem;">目前沒有訂單</p>';
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const itemStr = order.items.map(i => `${i.name} x${i.qty}`).join(', ');
        const date = new Date(order.timestamp).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' });

        return `
            <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.8rem; border: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: bold;">
                    <span>${order.customerName}</span>
                    <span style="color: #666; font-size: 0.9rem;">${date}</span>
                </div>
                <div style="color: #4b5563; font-size: 0.95rem; margin-bottom: 0.5rem;">
                    ${itemStr}
                </div>
                <div style="text-align: right; border-top: 1px dashed #ddd; padding-top: 0.5rem; color: #10b981; font-weight: bold;">
                    總計: $${order.total}
                </div>
            </div>
        `;
    }).join('');
}

// Fetch Data
async function fetchInventory() {
    try {
        const response = await fetch(`${API_BASE}/inventory`);
        inventory = await response.json();
        renderProducts(inventory);
    } catch (error) {
        console.error('Failed to fetch inventory:', error);
        productGrid.innerHTML = '<p style="text-align:center; color:red;">無法載入商品資料，請稍後再試。</p>';
    }
}

// Render Products
function renderProducts(products) {
    productGrid.innerHTML = '';

    // Calculate status and sort: Available first, Out of Stock last
    const sortedProducts = products.map((product, index) => {
        const initialStock = parseInt(product.stock) || 0;
        const cartItem = cart.find(item => item.name === product.name);
        const inCartQty = cartItem ? cartItem.quantity : 0;
        const remainingStock = initialStock - inCartQty;
        const isOutOfStock = remainingStock <= 0;

        return {
            ...product,
            originalIndex: index, // Keep track of original index for addToCart
            remainingStock,
            isOutOfStock
        };
    }).sort((a, b) => {
        // Priority 1: Stock Status (Out of Stock goes to bottom)
        if (a.isOutOfStock && !b.isOutOfStock) return 1;
        if (!a.isOutOfStock && b.isOutOfStock) return -1;

        // Priority 2: Discount (If both in stock, Discount goes to top)
        if (!a.isOutOfStock && !b.isOutOfStock) {
            if (b.discount && !a.discount) return 1;
            if (a.discount && !b.discount) return -1;
        }

        return 0; // Keep original order otherwise
    });

    sortedProducts.forEach((product) => {
        const { originalIndex, remainingStock, isOutOfStock } = product;

        const stockDisplay = isOutOfStock
            ? '<span style="color: #e63946; font-weight: bold;">已售完</span>'
            : `剩餘: ${remainingStock} ${product.unit}`;

        const card = document.createElement('div');
        card.className = 'product-card';
        if (isOutOfStock) card.classList.add('out-of-stock');

        // Discount Badge - Removed per user request
        const discountBadge = '';

        const priceDiscountTag = product.discount
            ? '<span style="background: #e63946; color: white; font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">3件$100</span>'
            : '';

        card.innerHTML = `
            <div style="position: relative;">
                <img src="${product.image}" alt="${product.name}" class="product-image" style="${isOutOfStock ? 'filter: grayscale(100%); opacity: 0.8;' : ''}">
                ${isOutOfStock ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border-radius: 4px; font-weight: bold;">補貨中</div>' : ''}
                ${discountBadge}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">$${product.price} / ${product.unit} ${priceDiscountTag}</p>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.8rem;">${stockDisplay}</div>
                <button class="add-btn" onclick="addToCart(${originalIndex})" ${isOutOfStock ? 'disabled style="background: #ccc; border-color: #ccc; color: #666; cursor: not-allowed;"' : ''}>
                    ${isOutOfStock ? '無法購買' : '加入購物車'}
                </button>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

// Cart Logic
window.addToCart = (index) => {
    const product = inventory[index];
    const stock = parseInt(product.stock) || 0;
    const existingItem = cart.find(item => item.name === product.name);

    let currentQtyInCart = existingItem ? existingItem.quantity : 0;

    if (currentQtyInCart + 1 > stock) {
        showToast('庫存不足，無法新增更多', 'error');
        return;
    }

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1, maxStock: stock });
    }

    updateCartCounts();
    renderProducts(inventory); // Re-render to update stock display
    showToast(`已加入 ${product.name}`);
};

function updateCartCounts() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = count;

    // Enable/Disable checkout
    checkoutBtn.disabled = count === 0;
}

function updateCartUI() {
    cartItems.innerHTML = '';

    // 1. Separate items
    let normalItems = [];
    let discountItems = [];

    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #888;">購物車是空的</p>';
        cartTotal.textContent = '0';
        return;
    }

    cart.forEach((item, index) => {
        // Render Item Row
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name} ${item.discount ? '<span style="font-size:0.75rem; background:#FFD700; color:#b45309; padding:2px 4px; border-radius:3px;">3件100</span>' : ''}</h4>
                <span style="color: #666; font-size: 0.9rem;">$${item.price} x ${item.quantity}</span>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="updateQuantity(${index}, -1)">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
            </div>
        `;
        cartItems.appendChild(div);

        // Group for calculation
        if (item.discount) {
            // Expand quantity: [Price, Price, Price]
            for (let i = 0; i < item.quantity; i++) {
                discountItems.push(parseInt(item.price));
            }
        } else {
            normalItems.push(parseInt(item.price) * item.quantity);
        }
    });

    // 2. Calculate Total
    let total = 0;

    // A. Normal Items
    total += normalItems.reduce((sum, p) => sum + p, 0);

    // B. Discount Items (3 for 100)
    // Sort descending to prioritize expensive items in the bundle (so customer saves more / remainder is cheapest)
    discountItems.sort((a, b) => b - a);

    let bundleCount = Math.floor(discountItems.length / 3);

    total += bundleCount * 100;

    // Add remainders (the cheapest ones because we sorted descending)
    const remainders = discountItems.slice(bundleCount * 3);
    total += remainders.reduce((sum, p) => sum + p, 0);

    cartTotal.textContent = total;
}

window.updateQuantity = (index, change) => {
    const item = cart[index];
    const newQty = item.quantity + change;
    const maxStock = parseInt(item.maxStock) || parseInt(item.stock) || 999;

    if (newQty > maxStock) {
        showToast('庫存不足，無法新增更多', 'error');
        return;
    }

    item.quantity = newQty;

    if (item.quantity <= 0) {
        cart.splice(index, 1);
    }

    updateCartCounts();
    updateCartUI();
    renderProducts(inventory); // Re-render to update stock display
    showToast(`已加入 ${product.name}`);
};

// Order Submission
async function handleOrderSubmit(e) {
    e.preventDefault();

    if (cart.length === 0) return;

    // Check Store Status First
    try {
        const res = await fetch(`${API_BASE}/store-status`);
        const status = await res.json();

        if (!status.isOpen) {
            cartModal.classList.remove('active');
            closedModal.classList.add('active');
            return;
        }
    } catch (err) {
        console.error('Status check failed');
    }

    const name = document.getElementById('name').value;
    const total = cartTotal.textContent;

    // Check Duplicate Name
    try {
        const checkRes = await fetch(`${API_BASE}/check-name?name=${encodeURIComponent(name)}`);
        const checkData = await checkRes.json();

        if (checkData.exists) {
            showToast('本周已有相同名字的訂單，請協助更換下單姓名，謝謝', 'error');
            return;
        }
    } catch (error) {
        console.error('Name check failed:', error);
        // Optional: Block or allow? Let's allow if check fails to avoid blocking users on error? 
        // Or fail safe? User asked for feature, so let's log but maybe proceed or alert. 
        // For now, if check fails entirely (500), we probably shouldn't block, but if it returns true, we block.
    }

    const orderData = {
        customerName: name,
        items: cart.map(item => ({ name: item.name, qty: item.quantity, price: item.price })),
        total: total
    };

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = '處理中...';

    try {
        const response = await fetch(`${API_BASE}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (result.success) {
            cart = [];
            updateCartCounts();
            cartModal.classList.remove('active');
            orderForm.reset();
            showToast('訂單已送出！我們會盡快為您出貨', 'success');
        } else {
            showToast(result.message || '訂購失敗，請稍後再試', 'error');
            await fetchInventory();
        }
    } catch (error) {
        console.error('Order error:', error);
        showToast('發生錯誤，請檢查網路連線', 'error');
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = '立即下單';
    }
}

// Toast
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast visible ${type}`;

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}
