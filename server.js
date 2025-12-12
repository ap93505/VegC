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
    { name: 'Organic Carrots', price: '50', unit: 'kg', stock: '20', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=500&q=60' },
    { name: 'Fresh Spinach', price: '30', unit: 'bundle', stock: '15', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=500&q=60' },
    { name: 'Tomatoes', price: '60', unit: 'kg', stock: '30', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=500&q=60' },
    { name: 'Broccoli', price: '45', unit: 'head', stock: '10', image: 'https://images.unsplash.com/photo-1459411621453-7edd0c4b7cb6?auto=format&fit=crop&w=500&q=60' },
    { name: 'Bell Peppers', price: '70', unit: 'kg', stock: '25', image: 'https://images.unsplash.com/photo-1563565375-f3fdf5ecd2bd?auto=format&fit=crop&w=500&q=60' },
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

// Helper: Calculate Real-time stock
async function calculateInventory(doc) {
    const inventorySheet = doc.sheetsByIndex[0];
    const orderSheet = doc.sheetsByIndex[1];

    const [inventoryRows, orderRows] = await Promise.all([
        inventorySheet.getRows(),
        orderSheet.getRows()
    ]);

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

// API: Submit Order
app.post('/api/order', async (req, res) => {
    try {
        const { customerName, customerPhone, items, total } = req.body;
        const doc = await getDoc();

        if (!doc) {
            console.log('Mock Order Received:', { customerName, customerPhone, items, total });
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
            CustomerPhone: customerPhone,
            Items: JSON.stringify(items),
            Total: total
        });

        res.json({ success: true, message: 'Order submitted successfully' });
    } catch (error) {
        console.error('Error submitting order:', error);
        res.status(500).json({ error: 'Failed to submit order' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
