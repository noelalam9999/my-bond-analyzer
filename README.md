# my-bond-analyzer

Next.js app that reads bond holdings from a Google Sheet and shows a portfolio summary
(invested capital, annual coupon income, weighted coupon, maturities).

## Data source

The sheet must be shared as **Anyone with the link → Viewer**. Expected columns:

`Bond Title | ISIN | Purchase Price (BDT) | Coupon Rate (%) | Current Yield`

Bond titles like `15Y BGTB 16/01/2028` are parsed for tenor and maturity date.

## Run

```bash
cp .env.example .env.local   # set SHEET_ID / SHEET_GID if using a different sheet
npm install
npm run dev
```

Data is fetched server-side via the sheet's CSV export and cached for 5 minutes.
