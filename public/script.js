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
        if (e.target === cartModal) {
            cartModal.classList.remove('active');
        }
    });

    orderForm.addEventListener('submit', handleOrderSubmit);
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
    products.forEach((product, index) => {
        const initialStock = parseInt(product.stock) || 0;

        // Calculate effective stock (Initial - In Cart)
        const cartItem = cart.find(item => item.name === product.name);
        const inCartQty = cartItem ? cartItem.quantity : 0;
        const remainingStock = initialStock - inCartQty;

        const isOutOfStock = remainingStock <= 0;
        const stockDisplay = isOutOfStock
            ? '<span style="color: #e63946; font-weight: bold;">已售完</span>'
            : `剩餘: ${remainingStock} ${product.unit}`;

        const card = document.createElement('div');
        card.className = 'product-card';
        if (isOutOfStock) card.classList.add('out-of-stock');

        card.innerHTML = `
            <div style="position: relative;">
                <img src="${product.image}" alt="${product.name}" class="product-image" style="${isOutOfStock ? 'filter: grayscale(100%); opacity: 0.8;' : ''}">
                ${isOutOfStock ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border-radius: 4px; font-weight: bold;">補貨中</div>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">$${product.price} / ${product.unit}</p>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.8rem;">${stockDisplay}</div>
                <button class="add-btn" onclick="addToCart(${index})" ${isOutOfStock ? 'disabled style="background: #ccc; border-color: #ccc; color: #666; cursor: not-allowed;"' : ''}>
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
    let total = 0;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #888;">購物車是空的</p>';
    } else {
        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span style="color: #666; font-size: 0.9rem;">$${item.price} x ${item.quantity}</span>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateQuantity(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
                </div>
            `;
            cartItems.appendChild(div);
        });
    }

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
};

// Order Submission
async function handleOrderSubmit(e) {
    e.preventDefault();

    if (cart.length === 0) return;

    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const total = cartTotal.textContent;

    const orderData = {
        customerName: name,
        customerPhone: phone,
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
            // Refresh inventory to show latest stock if it was a stock issue
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
