# 🌿 FreshVeg - Real-time Vegetable Ordering System

A premium, full-stack vegetable ordering application built with **Node.js**, **Express**, and **Google Sheets** as the database. It features real-time stock management, discount logic ("3 items for $100"), and a live order monitoring system.

## ✨ Features

- **Storefront**
  - 🎨 **Premium UI**: Modern, responsive design with smooth animations.
  - 🛍️ **Shopping Cart**: Add items, adjust quantities, and view live totals.
  - ⚡ **Real-time Stock**: Displays remaining stock (Initial Stock - Orders - Cart).
  - 🚫 **Stock Protection**: Prevents adding more items than available.
  - 🏷️ **Discount Logic**: **"3 for $100"** special offer.
    - Automatically identifies eligible items.
    - Mix & match supported.
    - Smart calculation: Bundles the 3 most expensive items into the discount; remaining items are charged at original price.
  - 📋 **Order List**: View today's orders in real-time to avoid duplicate purchases.

- **Backend (Node.js + Google Sheets)**
  - 🔄 **Google Sheets API**: Uses Google Sheets as a CMS and Database.
  - 🛡️ **Stock Validation**: Double-checks stock on the server before accepting orders.
  - 🖼️ **Image Parsing**: Supports direct URLs, Drive links, and `=IMAGE()` formulas.

## 🚀 Setup Guide

### 1. Prerequisites
- Node.js installed (v14+).
- A Google Cloud Project with **Google Sheets API** enabled.

### 2. Google Sheets Setup
Create a new Google Sheet with two tabs:

#### **Sheet 1: Inventory (Header Row Required)**
| Name | Price | Unit | Stock | Discount | Image |
|------|-------|------|-------|----------|-------|
| Carrots | 50 | kg | 20 | TRUE | http://... |
| Spinach | 30 | kg | 15 | TRUE | http://... |

- **Discount**: Set to `TRUE` to enable the "3 for $100" offer for that item.
- **Image**: Can be a direct link, a Google Drive share link, or `=IMAGE("url")`.

#### **Sheet 2: Orders (Header Row Required)**
| Timestamp | CustomerName | Items | Total |
|-----------|--------------|-------|-------|
| (Auto) | (User Input) | (JSON) | (Auto) |

**Important**: Share your Google Sheet with the **Service Account Email** (created in step 3) giving it **Editor** access.

#### **Sheet 3: Order Statistics (Header Row Required)**
| Name | Stock | SoldQuantity | RemainingStock | BuyersList |
|------|-------|--------------|----------------|------------|
| Carrots | 20 | (Auto) | (Auto) | (Auto) |
| Spinach | 15 | (Auto) | (Auto) | (Auto) |

- **Name**: Must match the product names in Sheet 1.
- **Stock**: Initial stock (manually synced or referenced from Sheet 1).
- **SoldQuantity, RemainingStock, BuyersList**: Automatically updated by the app.

### 3. Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ap93505/VegC.git
   cd VegC
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   GOOGLE_SHEET_ID=your_sheet_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour...\n-----END PRIVATE KEY-----\n"
   ADMIN_PASSWORD=your_secure_password
   ```
   *Note: Wrap the private key in quotes and preserve `\n` characters.*

### 4. Admin Panel
- Access the settings page at `http://localhost:3000/settings.html`.
- Use the **ADMIN_PASSWORD** set in your `.env` file to log in.
- Click **"整理訂單"** to manually update the Order Statistics sheet.

### 4. Run the Server

**Development Mode** (Auto-restart on change):
```bash
npm run dev
```

**Production Start**:
```bash
npm start
```

Visit `http://localhost:3000` to start ordering!

## 🧪 Mock Mode
If no Google credentials are provided, the app will automatically fall back to **Mock Mode**, serving sample data so you can test the UI and Logic without a real spreadsheet.

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3 (Variables, Flex/Grid), Vanilla JavaScript.
- **Backend**: Node.js, Express.
- **Database**: Google Sheets (via `google-spreadsheet`).

## 📝 License
ISC
