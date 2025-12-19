require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

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

// Helper: Get Current Time in Taipei Timezone (ISO-like format but local)
function getTaipeiTime() {
    return new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/\//g, '-'); // Optional: Format as YYYY-MM-DD HH:mm:ss for better readability in sheets
}

// Helper: Get Sheets by Name with Fallbacks
function getSheets(doc) {
    const findSheet = (names) => {
        for (const name of names) {
            if (doc.sheetsByTitle[name]) return doc.sheetsByTitle[name];
        }
        return null; // Not found
    };

    return {
        inventory: findSheet(['商品', 'Products']),
        orders: findSheet(['訂單', 'Orders']),
        stats: findSheet(['統計', 'Statistics']),
        announcement: findSheet(['公告', 'Announcement']),
        visit: findSheet(['造訪紀錄', 'Visit Log']),
        settings: findSheet(['設定', 'Settings'])
    };
}


// Helper: Stringify Items (Readable Format)
// Format: Name1*Qty1, Name2*Qty2
function stringifyItems(items) {
    if (!Array.isArray(items)) return '';
    return items.map(item => `${item.name}*${item.qty}`).join(', ');
}

// Helper: Parse Items (Supports JSON and Readable Format)
function parseItems(str) {
    if (str === null || str === undefined || str === '') return [];

    // Ensure string
    if (typeof str !== 'string') {
        str = String(str);
    }

    // Try JSON first (Backward Compatibility)
    if (str.trim().startsWith('[')) {
        try {
            return JSON.parse(str);
        } catch (e) { }
    }

    // Parse Readable Format: "Name*Qty, Name*Qty"
    return str.split(',').map(s => {
        const parts = s.split('*');
        if (parts.length < 2) return null;
        const qty = parts.pop().trim(); // Last part is Qty
        const name = parts.join('*').trim(); // Rejoin rest in case name has *
        if (!name || !qty) return null;
        return { name, qty };
    }).filter(i => i !== null);
}

// Helper: Update Statistics Sheet (Sheet 3)
async function updateStats(doc) {
    try {
        const sheets = getSheets(doc);
        const statsSheet = sheets.stats;

        if (!statsSheet) {
            console.warn('Statistics sheet not found');
            return;
        }

        if (!sheets.inventory || !sheets.orders) {
            console.warn('Inventory or Orders sheet not found, skipping stats update');
            return;
        }

        // Fetch all data
        const [inventoryRows, orderRows] = await Promise.all([
            sheets.inventory.getRows(),
            sheets.orders.getRows()
        ]);

        // Aggregate Sales Data
        const productStats = {}; // { Name: { sold: 0, buyers: { user: qty } } }

        orderRows.forEach((row, rowIndex) => {
            try {
                const rawItems = row.get('Items');
                const items = parseItems(rawItems);

                // Debug log if needed, or silent fail
                // if (!Array.isArray(items)) console.log(`Row ${rowIndex} items invalid`);

                const customer = row.get('CustomerName');

                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.name && item.qty) {
                            // Normalize Key
                            const key = String(item.name).trim();
                            if (!productStats[key]) {
                                productStats[key] = { sold: 0, buyers: {} };
                            }
                            const qty = parseInt(item.qty) || 0;
                            productStats[key].sold += qty;

                            if (customer) {
                                const customerKey = String(customer).trim();
                                if (!productStats[key].buyers[customerKey]) {
                                    productStats[key].buyers[customerKey] = 0;
                                }
                                productStats[key].buyers[customerKey] += qty;
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn(`Error parsing row ${rowIndex} in stats update:`, e);
            }
        });

        // Resize Stats Sheet to match Inventory count (+1 for header)
        const targetRowCount = inventoryRows.length + 1;

        // Resize logic
        try {
            await statsSheet.resize({ rowCount: targetRowCount, columnCount: 5 });
        } catch (e) {
            console.warn('Resize failed, attempting to proceed with existing cells:', e.message);
        }

        // Load all cells for the new size
        await statsSheet.loadCells();

        // Check actual loaded size to prevent out-of-bounds
        // Note: google-spreadsheet internals allow checking rowCount via statsSheet.rowCount usually.
        const maxRows = statsSheet.rowCount;

        // Overwrite Data
        for (let i = 0; i < inventoryRows.length; i++) {
            const rowIndex = i + 1; // Header is 0

            // Safety Check
            if (rowIndex >= maxRows) {
                console.warn(`Skipping stats row ${rowIndex} - Out of bounds (Max: ${maxRows})`);
                break;
            }

            const invRow = inventoryRows[i];
            const nameRaw = invRow.get('Name');
            const name = nameRaw ? String(nameRaw).trim() : 'Unknown Product'; // Handle missing name

            const stockStr = invRow.get('Stock');
            const initialStock = parseInt(stockStr) || 0;

            const data = productStats[name] || { sold: 0, buyers: {} };
            const remaining = Math.max(0, initialStock - data.sold);

            // Format buyers list
            const buyersList = Object.entries(data.buyers)
                .map(([user, qty]) => `${user}*${qty}`)
                .join(', ');

            statsSheet.getCell(rowIndex, 0).value = name;
            statsSheet.getCell(rowIndex, 1).value = initialStock;
            statsSheet.getCell(rowIndex, 2).value = data.sold;
            statsSheet.getCell(rowIndex, 3).value = remaining;
            statsSheet.getCell(rowIndex, 4).value = buyersList;
        }

        await statsSheet.saveUpdatedCells();

    } catch (error) {
        console.error('Error updating stats:', error);
        throw error; // Re-throw to inform frontend
    }
}

// Helper: Calculate Real-time stock
async function calculateInventory(doc) {
    const sheets = getSheets(doc);

    if (!sheets.inventory || !sheets.orders) {
        console.warn('Critical: Inventory or Orders sheet missing');
        throw new Error('Required sheets not found');
    }

    const [inventoryRows, orderRows] = await Promise.all([
        sheets.inventory.getRows(),
        sheets.orders.getRows()
    ]);
    // ... rest of function ...

    const soldTotals = {};
    orderRows.forEach(row => {
        try {
            const items = parseItems(row.get('Items'));
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
        let imageUrl = row.get('Image');
        if (!imageUrl || imageUrl.trim() === '') {
            imageUrl = 'images/default.png';
        }
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
        } else if (imageUrl.includes('drive.google.com')) {
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
                { rowIndex: 1, timestamp: getTaipeiTime(), customerName: 'Mock User 1', items: [{ name: 'Carrots', qty: 2, price: 50 }], total: 100 }
            ]);
        }

        const sheets = getSheets(doc);
        if (!sheets.orders || !sheets.inventory) {
            return res.status(500).json({ error: 'Required sheets not found' });
        }

        // Fetch Orders AND Inventory to re-hydrate prices
        // (Since readable format Name*Qty doesn't store price, we use current inventory price)
        const [orderRows, inventoryRows] = await Promise.all([
            sheets.orders.getRows(),
            sheets.inventory.getRows()
        ]);

        // Build Price Map
        const priceMap = {};
        inventoryRows.forEach(row => {
            const name = row.get('Name');
            const price = row.get('Price');
            if (name) priceMap[name] = price;
        });

        const orders = orderRows.map((row, index) => {
            let items = [];
            try {
                // Parse items and inject price
                const parsed = parseItems(row.get('Items'));
                items = parsed.map(item => ({
                    ...item,
                    price: priceMap[item.name] || '0' // Fallback to 0 if product not found
                }));
            } catch (e) { }

            return {
                rowIndex: index, // 0-based index directly matching the array from getRows()
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

// Helper: Get and Auto-Reset Store Status (Google Sheet "設定")
async function getStoreStatus() {
    try {
        const doc = await getDoc();
        if (!doc) return { isOpen: true, closedAt: null };

        const sheets = getSheets(doc);
        const sheet = sheets.settings;
        if (!sheet) return { isOpen: true, closedAt: null };

        await sheet.loadCells('A1:C1');
        const statusCell = sheet.getCell(0, 1); // B1
        const timeCell = sheet.getCell(0, 2);   // C1

        // Parse boolean from string or boolean value
        let isOpen = statusCell.value === true || statusCell.value === 'TRUE';
        let closedAt = timeCell.value ? timeCell.value.toString() : null;

        // Check 3-day reset logic
        if (!isOpen && closedAt) {
            const closedTime = new Date(closedAt).getTime();
            const now = Date.now();
            const daysDiff = (now - closedTime) / (1000 * 60 * 60 * 24);

            if (daysDiff >= 3) {
                console.log('Auto-opening store after 3 days');
                isOpen = true;
                closedAt = null;

                // Sync back to sheet
                statusCell.value = true;
                timeCell.value = '';
                await sheet.saveUpdatedCells();
            }
        }

        return { isOpen, closedAt };
    } catch (error) {
        console.error('Error reading store status:', error);
        return { isOpen: true, closedAt: null };
    }
}

async function updateStoreStatus(isOpen) {
    try {
        const doc = await getDoc();
        if (!doc) return { isOpen, closedAt: null };

        const sheets = getSheets(doc);
        const sheet = sheets.settings;
        if (!sheet) {
            console.warn('Settings sheet not found');
            return { isOpen, closedAt: null };
        }

        await sheet.loadCells('A1:C1');
        const labelCell = sheet.getCell(0, 0); // A1
        const statusCell = sheet.getCell(0, 1); // B1
        const timeCell = sheet.getCell(0, 2);   // C1

        labelCell.value = '店鋪開關';
        statusCell.value = isOpen;

        const closedAt = isOpen ? null : getTaipeiTime();
        timeCell.value = closedAt || '';

        await sheet.saveUpdatedCells();
        return { isOpen, closedAt };
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
}

// API: Get Store Status
app.get('/api/store-status', async (req, res) => {
    const status = await getStoreStatus();
    res.json(status);
});

// API: Check Name Existence
app.get('/api/check-name', async (req, res) => {
    try {
        const nameToCheck = req.query.name;
        if (!nameToCheck) return res.json({ exists: false });

        const doc = await getDoc();
        if (!doc) return res.json({ exists: false }); // Mock mode

        const sheets = getSheets(doc);
        if (!sheets.orders) return res.json({ exists: false });

        const rows = await sheets.orders.getRows();

        const exists = rows.some(row => {
            const rowName = row.get('CustomerName');
            return rowName && rowName.trim().toLowerCase() === nameToCheck.trim().toLowerCase();
        });

        res.json({ exists });
    } catch (error) {
        console.error('Check name error:', error);
        res.status(500).json({ error: 'Check failed' });
    }
});

// API: Order Submission
app.post('/api/order', async (req, res) => {
    try {
        // 0. Check Store Status
        const status = await getStoreStatus();
        if (!status.isOpen) {
            return res.json({ success: false, message: '本周網頁訂單已截止' });
        }

        const { customerName, items, total } = req.body;
        const doc = await getDoc();

        if (!doc) {
            console.log('Mock Order Received:', { customerName, items, total });
            return res.json({ success: true, message: 'Mock Order received' });
        }

        try {
            // 1. Validate Stock
            const currentInventory = await calculateInventory(doc);

            for (const item of items) {
                const product = currentInventory.find(p => p.name === item.name);
                if (!product) {
                    return res.json({ success: false, message: `商品 "${item.name}" 已下架` });
                }
                if (item.qty > product.stock) {
                    return res.json({ success: false, message: `"${item.name}" 庫存不足` });
                }
            }
        } catch (e) {
            return res.json({ success: false, message: 'Inventory Check Failed: ' + e.message });
        }

        // 2. Submit Order if validation passes
        const sheets = getSheets(doc);
        if (!sheets.orders) return res.json({ success: false, message: 'System Error: Orders Sheet missing' });

        await sheets.orders.addRow({
            Timestamp: getTaipeiTime(),
            CustomerName: customerName,
            Items: stringifyItems(items),
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

// API: Admin Update Store Status
app.post('/api/admin/store-status', async (req, res) => {
    const { password, isOpen } = req.body;

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: '密碼錯誤' });
    }

    const newSettings = await updateStoreStatus(isOpen);
    res.json({ success: true, message: `商店已${isOpen ? '開啟' : '關閉'}`, status: newSettings });
});

// --- Admin Order Management ---

// 1. Add Order (Admin bypasses store open check)
app.post('/api/admin/order/add', async (req, res) => {
    try {
        const { password, customerName, items, total } = req.body;

        // Auth
        if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: '密碼錯誤' });
        }

        const doc = await getDoc();
        if (!doc) {
            return res.json({ success: true, message: 'Mock Order Created' });
        }

        try {
            const currentInventory = await calculateInventory(doc);
            for (const item of items) {
                const product = currentInventory.find(p => p.name === item.name);
                if (!product) return res.json({ success: false, message: `商品 "${item.name}" 不存在` });
                if (item.qty > product.stock) return res.json({ success: false, message: `"${item.name}" 庫存不足` });
            }
        } catch (e) {
            return res.json({ success: false, message: 'Stock Check Error: ' + e.message });
        }

        const sheets = getSheets(doc);
        if (!sheets.orders) return res.json({ success: false, message: 'Orders Sheet Missing' });

        // Add Row
        await sheets.orders.addRow({
            Timestamp: getTaipeiTime(),
            CustomerName: customerName,
            Items: stringifyItems(items),
            Total: total
        });

        // await updateStats(doc); // Optional: sync stats

        res.json({ success: true, message: '新增訂單成功' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '新增失敗' });
    }
});

// 2. Delete Order
app.post('/api/admin/order/delete', async (req, res) => {
    try {
        const { password, rowIndex } = req.body; // rowIndex is the index in the array returned by getRows()

        if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Auth failed' });
        }

        const doc = await getDoc();
        if (!doc) return res.json({ success: true, message: 'Mock Deleted' });

        const sheets = getSheets(doc);
        if (!sheets.orders) return res.json({ success: false, message: 'Orders Sheet Missing' });

        const rows = await sheets.orders.getRows();

        if (rowIndex < 0 || rowIndex >= rows.length) {
            return res.json({ success: false, message: '找不到該訂單 (Index invalid)' });
        }

        const rowToDelete = rows[rowIndex];
        await rowToDelete.delete();
        // await updateStats(doc);

        res.json({ success: true, message: '刪除成功' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '刪除失敗' });
    }
});

// 3. Update Order
app.post('/api/admin/order/update', async (req, res) => {
    try {
        const { password, rowIndex, newData } = req.body;
        // newData: { customerName, items: [{name, qty, price}], total }

        if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Auth failed' });
        }

        const doc = await getDoc();
        if (!doc) return res.json({ success: true, message: 'Mock Updated' });

        const sheets = getSheets(doc);
        if (!sheets.orders) return res.json({ success: false, message: 'Orders Sheet Missing' });

        const rows = await sheets.orders.getRows(); // Fetch fresh

        if (rowIndex < 0 || rowIndex >= rows.length) {
            return res.json({ success: false, message: '訂單不存在' });
        }

        const targetRow = rows[rowIndex];

        // Stock Re-validation Logic
        // We need to check if the NEW items can be fulfilled by (Current Stock + Old Items of this order)
        try {
            // 1. Calculate current real stock (which includes deduction of the old items)
            const currentInventory = await calculateInventory(doc);

            // 2. Identify old items from the target row
            let oldItems = [];
            try {
                oldItems = parseItems(targetRow.get('Items'));
            } catch (e) { }

            // 3. Check new items
            for (const newItem of newData.items) {
                const product = currentInventory.find(p => p.name === newItem.name);
                if (!product) return res.json({ success: false, message: `商品 ${newItem.name} 不存在` });

                // How much of this product was in the *old* order?
                const oldItem = oldItems.find(i => i.name === newItem.name);
                const oldQty = oldItem ? parseInt(oldItem.qty) : 0;
                const newQty = parseInt(newItem.qty);

                // Available for this specific edit = Current Free Stock + What we are returning (OldQty)
                const availableForThisOrder = product.stock + oldQty;

                if (newQty > availableForThisOrder) {
                    return res.json({
                        success: false,
                        message: `庫存不足: ${newItem.name}`
                    });
                }
            }
        } catch (e) {
            return res.json({ success: false, message: 'Stock Check Error: ' + e.message });
        }

        // Apply Updates
        targetRow.assign({
            CustomerName: newData.customerName,
            Items: stringifyItems(newData.items),
            Total: newData.total,
            // Timestamp remains unchanged usually, or update if desired? Let's keep original timestamp.
        });
        await targetRow.save();

        // await updateStats(doc);

        res.json({ success: true, message: '訂單更新成功' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '更新失敗' });
    }
});

// API: Get Announcement
app.get('/api/announcement', async (req, res) => {
    try {
        const doc = await getDoc();
        if (!doc) return res.json({ message: '' });

        const sheets = getSheets(doc);
        const sheet = sheets.announcement;

        if (!sheet) {
            return res.json({ message: '' });
        }

        // Load reading range for A1
        await sheet.loadCells('A1');
        const cell = sheet.getCell(0, 0); // A1
        const message = cell.value ? cell.value.toString() : '';

        res.json({ message });
    } catch (error) {
        console.error('Error fetching announcement:', error);
        res.json({ message: '' }); // Fail silently for UI
    }
});

// API: Record Visit
app.post('/api/visit', async (req, res) => {
    try {
        const doc = await getDoc();
        if (!doc) return res.json({ success: false });

        const sheets = getSheets(doc);
        const sheet = sheets.visit;

        if (!sheet) {
            // Let's just return silently if not found to avoid errors
            return res.json({ success: false, message: 'Sheet not found' });
        }

        // Append timestamp to Column A (using addRow)
        // Use Taipei Time (UTC+8)
        await sheet.addRow([getTaipeiTime()]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error recording visit:', error);
        res.json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
