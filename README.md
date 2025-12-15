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
Create a new Google Sheet with the following tabs (names can be English or Chinese):

#### **1. Inventory (Sheet Name: "商品" or "Products")**
| Name | Price | Unit | Stock | Discount | Image |
|------|-------|------|-------|----------|-------|
| Carrots | 50 | kg | 20 | TRUE | http://... |

- **Discount**: Set to `TRUE` to enable the "3 for $100" offer.

#### **2. Orders (Sheet Name: "訂單" or "Orders")**
| Timestamp | CustomerName | Items | Total |
|-----------|--------------|-------|-------|
| (Auto) | (User Input) | (JSON) | (Auto) |

#### **3. Stats (Sheet Name: "統計" or "Statistics")**
| Name | Stock | SoldQuantity | RemainingStock | BuyersList |
|------|-------|--------------|----------------|------------|
| (Auto) | (Auto) | (Auto) | (Auto) | (Auto) |

#### **4. Announcement (Sheet Name: "公告" or "Announcement")**
- **Cell A1**: The announcement message text (e.g., "We are closed today!").

#### **5. Visits (Sheet Name: "造訪紀錄" or "Visit Log")**
- **Column A**: Automatically records timestamps of page visits.

#### **6. Settings (Sheet Name: "設定" or "Settings")**
- **Cell A1**: "店鋪開關" (Label)
- **Cell B1**: "TRUE" or "FALSE" (Store Open Status)
- **Cell C1**: Timestamp (Auto-generated when closed)

**Important**: 
- Share your Google Sheet with the **Service Account Email** giving it **Editor** access.
- Tab order does not matter as long as the names match one of the options above.

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
