# E-Bank

Simple banking demo using Flask (Python), HTML/CSS, and MySQL/SQLite.

## Features
- Landing page with Admin and User login
- Admin dashboard: Create Account, Analytics, Transactions Report, Search Profiles, Users
- Customer dashboard: Operations (Deposit, Withdraw to Wallet, Transfer), Profile, History, Chatbot
- Basic rule-ready fraud logging (scaffold)

## Tech
- Backend: Flask, SQLAlchemy
- DB: MySQL via PyMySQL (prod), SQLite fallback (dev)
- Frontend: HTML + CSS + Chart.js

## Setup
1. Python 3.10+
2. Create virtualenv and install deps:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```
3. Configure DB (optional for MySQL):
```bash
export DATABASE_URL="mysql+pymysql://user:pass@localhost:3306/ebank"
export SECRET_KEY="change-me"
```
Without `DATABASE_URL`, SQLite file `/workspace/ebank/ebank.db` is used.

## Run
```bash
python app.py
```
App runs at http://localhost:5000

## Admin Credentials
- Username: `admin`
- Password: `a123`

## Notes
- First run auto-creates tables.
- This is a demo, do not use in production without hardening.