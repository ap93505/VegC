require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Mock Data for fallback
const MOCK_INVENTORY = [
    { name: 'Organic Carrots', price: '50', unit: 'kg', stock: '20', discount: true, image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=500&q=60' },
    { name: 'Fresh Spinach', price: '30', unit: 'bundle', stock: '15', discount: true, image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=500&q=60' },
    { name: 'Tomatoes', price: '60', unit: 'kg', stock: '30', discount: false, image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=500&q=60' },
    { name: 'Broccoli', price: '45', unit: 'head', stock: '10', discount: true, image: 'https://images.unsplash.com/photo-1459411621453-7edd0c4b7cb6?auto=format&fit=crop&w=500&q=60' },
    { name: 'Bell Peppers', price: '70', unit: 'kg', stock: '25', discount: false, image: 'https://images.unsplash.com/photo-1563565375-f3fdf5ecd2bd?auto=format&fit=crop&w=500&q=60' },
];

async function getDoc() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
        console.warn('Google Sheets credentials missing, using mock data mode.');
        return null;
    }

    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
}

// Helper: Update Statistics Sheet (Sheet 3)
async function updateStats(doc) {
    try {
        const statsSheet = doc.sheetsByIndex[2];
        const orderSheet = doc.sheetsByIndex[1];

        if (!statsSheet) {
            console.warn('Statistics sheet not found');
            return;
        }

        const [statsRows, orderRows] = await Promise.all([
            statsSheet.getRows(),
            orderSheet.getRows()
        ]);

        // Aggregate Sales Data
        const productStats = {}; // { Name: { sold: 0, buyers: { user: qty } } }

        orderRows.forEach(row => {
            try {
                const items = JSON.parse(row.get('Items'));
                const customer = row.get('CustomerName');

                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.name && item.qty) {
                            if (!productStats[item.name]) {
                                productStats[item.name] = { sold: 0, buyers: {} };
                            }
                            const qty = parseInt(item.qty);
                            productStats[item.name].sold += qty;

                            if (customer) {
                                if (!productStats[item.name].buyers[customer]) {
                                    productStats[item.name].buyers[customer] = 0;
                                }
                                productStats[item.name].buyers[customer] += qty;
                            }
                        }
                    });
                }
            } catch (e) { }
        });

        // Update Stats Sheet
        // Assumes Headers: Name, Stock, SoldQuantity, RemainingStock, BuyersList
        for (const row of statsRows) {
            const name = row.get('Name');
            const data = productStats[name] || { sold: 0, buyers: {} };

            // Initial Stock from Column B (Stock)
            // Note: Use row.get('Stock') to read manually synced value
            const initialStock = parseInt(row.get('Stock')) || 0;
            const remaining = Math.max(0, initialStock - data.sold);

            // Format buyers list as "User*Qty, User*Qty"
            const buyersList = Object.entries(data.buyers)
                .map(([user, qty]) => `${user}*${qty}`)
                .join(', ');

            row.set('SoldQuantity', data.sold);
            row.set('RemainingStock', remaining);
            row.set('BuyersList', buyersList);

            await row.save();
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Helper: Calculate Real-time stock
async function calculateInventory(doc) {
    const inventorySheet = doc.sheetsByIndex[0];
    const orderSheet = doc.sheetsByIndex[1];

    // ... existing login ...
    const [inventoryRows, orderRows] = await Promise.all([
        inventorySheet.getRows(),
        orderSheet.getRows()
    ]);
    // ... rest of function ...

    const soldTotals = {};
    orderRows.forEach(row => {
        try {
            const items = JSON.parse(row.get('Items'));
            if (Array.isArray(items)) {
                items.forEach(item => {
                    if (item.name && item.qty) {
                        soldTotals[item.name] = (soldTotals[item.name] || 0) + parseInt(item.qty);
                    }
                });
            }
        } catch (e) { }
    });

    return inventoryRows.map(row => {
        let imageUrl = row.get('Image') || '';
        const name = row.get('Name');
        const totalStock = parseInt(row.get('Stock')) || 0;
        const soldQty = soldTotals[name] || 0;
        const currentStock = Math.max(0, totalStock - soldQty);

        // Parse Discount Column
        const discountRaw = row.get('Discount');
        const isDiscount = discountRaw === 'TRUE' || discountRaw === 'true' || discountRaw === true;

        if (imageUrl.toString().startsWith('=IMAGE')) {
            const match = imageUrl.match(/"([^"]+)"/);
            if (match) imageUrl = match[1];
        }

        if (imageUrl.includes('drive.google.com')) {
            const idMatch = imageUrl.match(/[-\w]{25,}/);
            if (idMatch) imageUrl = `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
        }

        return {
            name: name,
            price: row.get('Price'),
            unit: row.get('Unit'),
            stock: currentStock,
            discount: isDiscount,
            image: imageUrl
        };
    });
}

// API: Get Inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const doc = await getDoc();
        if (!doc) {
            return res.json(MOCK_INVENTORY);
        }

        const inventory = await calculateInventory(doc);
        res.json(inventory);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// API: Get Orders List
app.get('/api/orders', async (req, res) => {
    try {
        const doc = await getDoc();
        if (!doc) {
            // Mock Orders
            return res.json([
                { timestamp: new Date().toISOString(), customerName: 'Mock User 1', items: [{ name: 'Carrots', qty: 2 }], total: 100 },
                { timestamp: new Date().toISOString(), customerName: 'Mock User 2', items: [{ name: 'Tomatoes', qty: 1 }], total: 60 }
            ]);
        }

        const sheet = doc.sheetsByIndex[1];
        const rows = await sheet.getRows();

        const orders = rows.map(row => {
            let items = [];
            try {
                items = JSON.parse(row.get('Items'));
            } catch (e) { }

            return {
                timestamp: row.get('Timestamp'),
                customerName: row.get('CustomerName'),
                items: items,
                total: row.get('Total')
            };
        }).reverse(); // Newest first

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// API: Submit Order
app.post('/api/order', async (req, res) => {
    try {
        const { customerName, items, total } = req.body;
        const doc = await getDoc();

        if (!doc) {
            console.log('Mock Order Received:', { customerName, items, total });
            return res.json({ success: true, message: 'Order received (Mock Mode)' });
        }

        // 1. Validate Stock
        const currentInventory = await calculateInventory(doc);

        for (const item of items) {
            const product = currentInventory.find(p => p.name === item.name);
            if (!product) {
                return res.json({ success: false, message: `商品 "${item.name}" 已下架或不存在` });
            }
            if (item.qty > product.stock) {
                return res.json({ success: false, message: `抱歉，"${item.name}" 剩餘庫存不足 (剩餘: ${product.stock})` });
            }
        }

        // 2. Submit Order if validation passes
        const sheet = doc.sheetsByIndex[1]; // Second sheet
        await sheet.addRow({
            Timestamp: new Date().toISOString(),
            CustomerName: customerName,
            Items: JSON.stringify(items),
            Total: total
        });

        // 3. Update Statistics Sheet (Async, don't block response too long or block?)
        // Better to await to ensure consistency, though it might be slower.
        // REMOVED AUTO-UPDATE AS PER FEATURE REQUEST
        // await updateStats(doc); 

        res.json({ success: true, message: 'Order submitted successfully' });
    } catch (error) {
        console.error('Error submitting order:', error);
        res.status(500).json({ error: 'Failed to submit order' });
    }
});

// API: Admin Login (Verify Password)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (!process.env.ADMIN_PASSWORD) {
        return res.status(500).json({ success: false, message: 'Server configuration error: ADMIN_PASSWORD not set.' });
    }

    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Incorrect password' });
    }
});

// API: Admin Sync Stats
app.post('/api/admin/sync-stats', async (req, res) => {
    try {
        const { password } = req.body;
        // Check password
        if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: '密碼錯誤或未設定' });
        }

        const doc = await getDoc();
        if (!doc) {
            return res.json({ success: false, message: 'Database connection failed (Mock Mode)' });
        }

        await updateStats(doc);
        res.json({ success: true, message: '訂單統計已更新完成' });
    } catch (error) {
        console.error('Error syncing stats:', error);
        res.status(500).json({ success: false, message: '更新失敗: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
