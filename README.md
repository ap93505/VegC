# 🌿 FreshVeg - Vegetable Ordering App

A modern, premium vegetable ordering application integrated with Google Sheets for inventory and order management.

## Features
- **Modern UI**: Responsive, aesthetic design with green/nature theme.
- **Dynamic Inventory**: Fetches products directly from a Google Sheet (Sheet 1).
- **Order Management**: Submits orders to a second Google Sheet (Sheet 2).
- **Cart System**: Fully functional shopping cart with total calculation.
- **Mock Mode**: Works with mock data if no Google credentials are provided (for testing).

## Setup Guide

### 1. Prerequisites
- Node.js installed.
- A Google Cloud Project.

### 2. Installation
```bash
npm install
```

### 3. Google Sheets Setup (Crucial!)
To allow the app to read/write to your Google Sheet, you need a **Service Account**.

1.  **Create a Google Sheet**:
    -   Create a new Google Sheet.
    -   **Sheet 1 (Inventory)**: Rename the first tab to `Inventory` (optional, but keep it as first tab).
        -   Headers (Row 1): `Name`, `Price`, `Unit`, `Stock`, `Image`
        -   Add some sample data.
    -   **Sheet 2 (Orders)**: Rename the second tab to `Orders`.
        -   Headers (Row 1): `Timestamp`, `CustomerName`, `CustomerPhone`, `Items`, `Total`
2.  **Google Cloud Console**:
    -   Go to [Google Cloud Console](https://console.cloud.google.com/).
    -   Create a new project.
    -   Enable the **Google Sheets API**.
    -   Go to **IAM & Admin** > **Service Accounts**.
    -   Create a Service Account and download the **JSON Key** file.
    -   **Share the Sheet**: Open your Google Sheet, click "Share", and paste the `client_email` from your JSON key (e.g., `vegc-app@...iam.gserviceaccount.com`). Give it **Editor** access.

### 4. Configuration
1.  Rename `.env.example` to `.env`.
2.  Fill in the details:
    -   `GOOGLE_SERVICE_ACCOUNT_EMAIL`: From your JSON key.
    -   `GOOGLE_PRIVATE_KEY`: From your JSON key (copy the whole string including `-----BEGIN...`).
    -   `GOOGLE_SHEET_ID`: The long string in your Google Sheet URL (e.g., `https://docs.google.com/spreadsheets/d/YOUR_ID_IS_HERE/edit`).

### 5. Run
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Visit `http://localhost:3000` to view the app.

## Mock Mode
If you run the app without valid `.env` credentials, it will default to **Mock Data** mode. You will see sample products, and orders will be logged to the server console instead of the Google Sheet.
