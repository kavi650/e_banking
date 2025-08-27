from __future__ import annotations

from datetime import datetime, timedelta, date
from typing import Any, Dict

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    jsonify,
)

from models import db, Customer, Account, Transaction, LoginAttempt, FraudAlert
from utils import generate_account_number, hash_pin


admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "a123"


def require_admin() -> bool:
    return bool(session.get("is_admin"))


@admin_bp.route("/login", methods=["POST"])
def admin_login():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()
    success = username == ADMIN_USERNAME and password == ADMIN_PASSWORD

    attempt = LoginAttempt(
        is_admin=True,
        username_or_phone=username,
        success=success,
        ip_address=request.remote_addr,
    )
    db.session.add(attempt)
    db.session.flush()

    # Fraud detection: multiple failed admin logins in short window
    if not success:
        from datetime import datetime, timedelta
        window_start = datetime.utcnow() - timedelta(minutes=5)
        fail_count = (
            LoginAttempt.query.filter(
                LoginAttempt.is_admin.is_(True),
                LoginAttempt.username_or_phone == username,
                LoginAttempt.success.is_(False),
                LoginAttempt.created_at >= window_start,
            ).count()
        )
        if fail_count >= 3:
            db.session.add(
                FraudAlert(
                    account_id=None,
                    kind="admin_failed_logins",
                    description=f"{fail_count} failed admin logins within 5 minutes",
                    severity="high",
                )
            )
    db.session.commit()

    if not success:
        flash("Invalid admin credentials", "error")
        return redirect(url_for("index"))

    session["is_admin"] = True
    return redirect(url_for("admin.dashboard"))


@admin_bp.route("/logout")
def admin_logout():
    session.pop("is_admin", None)
    return redirect(url_for("index"))


@admin_bp.route("/dashboard")
def dashboard():
    if not require_admin():
        return redirect(url_for("index"))
    total_customers = Customer.query.count()
    total_bank_balance = db.session.query(db.func.sum(Account.main_balance)).scalar() or 0
    total_wallet_balance = (
        db.session.query(db.func.sum(Account.wallet_balance)).scalar() or 0
    )
    return render_template(
        "admin/dashboard.html",
        total_customers=total_customers,
        total_bank_balance=total_bank_balance,
        total_wallet_balance=total_wallet_balance,
    )


# Create Account
@admin_bp.route("/create-account", methods=["GET", "POST"])
def create_account():
    if not require_admin():
        return redirect(url_for("index"))

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        phone = request.form.get("phone", "").strip()
        address = request.form.get("address", "").strip()
        dob_str = request.form.get("dob", "").strip()
        aadhar = request.form.get("aadhar", "").strip()
        pin = request.form.get("pin", "").strip()

        if not (name and phone and address and dob_str and aadhar and pin):
            flash("All fields are required", "error")
            return redirect(url_for("admin.create_account"))

        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        except Exception:
            flash("Invalid Date of Birth", "error")
            return redirect(url_for("admin.create_account"))

        # Create customer
        customer = Customer(
            name=name,
            phone_number=phone,
            address=address,
            date_of_birth=dob,
            aadhar_number=aadhar,
        )
        db.session.add(customer)
        db.session.flush()  # Assign id

        # Create account
        account_number = generate_account_number()
        account = Account(
            customer_id=customer.id,
            account_number=account_number,
            pin_hash=hash_pin(pin),
            main_balance=0.0,
            wallet_balance=0.0,
        )
        db.session.add(account)
        db.session.commit()

        flash(
            f"Account created successfully! Account Number: {account_number} PIN: {pin}",
            "success",
        )
        return redirect(url_for("admin.create_account"))

    return render_template("admin/create_account.html")


# Analytics data endpoints for weekly, monthly, yearly
@admin_bp.route("/analytics/data")
def analytics_data():
    if not require_admin():
        return jsonify({"error": "unauthorized"}), 401

    mode = request.args.get("mode", "weekly")  # weekly, monthly, yearly

    now = datetime.utcnow()
    if mode == "weekly":
        start = now - timedelta(days=6)
        sqlite_fmt = "%Y-%m-%d"
        mysql_fmt = "%Y-%m-%d"
    elif mode == "monthly":
        start = now - timedelta(days=30)
        sqlite_fmt = "%Y-%m"
        mysql_fmt = "%Y-%m"
    else:  # yearly
        start = now - timedelta(days=365)
        sqlite_fmt = "%Y"
        mysql_fmt = "%Y"

    # Choose date bucket function depending on dialect
    dialect = db.session.bind.dialect.name
    if dialect == "sqlite":
        bucket_expr = db.func.strftime(sqlite_fmt, Transaction.created_at)
    elif dialect in ("mysql", "mariadb"):
        bucket_expr = db.func.date_format(Transaction.created_at, mysql_fmt)
    else:
        # Fallback to date cast (may group by day)
        bucket_expr = db.func.cast(Transaction.created_at, db.String)

    q = db.session.query(
        bucket_expr.label("bucket"),
        db.func.sum(
            db.case((Transaction.type == "deposit", Transaction.amount), else_=0)
        ).label("deposits"),
        db.func.sum(
            db.case((Transaction.type == "withdraw", Transaction.amount), else_=0)
        ).label("withdrawals"),
        db.func.count(Transaction.id).label("transactions"),
    ).filter(Transaction.created_at >= start).group_by("bucket").order_by("bucket")

    data = {"labels": [], "deposits": [], "withdrawals": [], "transactions": []}
    for row in q:
        data["labels"].append(row.bucket)
        data["deposits"].append(float(row.deposits or 0))
        data["withdrawals"].append(float(row.withdrawals or 0))
        data["transactions"].append(int(row.transactions or 0))

    return jsonify(data)


# Transactions Report
@admin_bp.route("/transactions-report", methods=["GET", "POST"])
def transactions_report():
    if not require_admin():
        return redirect(url_for("index"))

    results = []
    if request.method == "POST":
        account_number = request.form.get("account_number", "").strip()
        from_date = request.form.get("from_date", "").strip()
        to_date = request.form.get("to_date", "").strip()

        q = Transaction.query.join(Account)
        if account_number:
            q = q.filter(Account.account_number == account_number)
        if from_date:
            try:
                q = q.filter(Transaction.created_at >= datetime.strptime(from_date, "%Y-%m-%d"))
            except Exception:
                flash("Invalid from date", "error")
        if to_date:
            try:
                q = q.filter(Transaction.created_at <= datetime.strptime(to_date, "%Y-%m-%d"))
            except Exception:
                flash("Invalid to date", "error")

        results = q.order_by(Transaction.created_at.desc()).all()

    return render_template("admin/transactions_report.html", results=results)


# Search Profiles
@admin_bp.route("/search-profiles", methods=["GET", "POST"])
def search_profiles():
    if not require_admin():
        return redirect(url_for("index"))

    result = None
    if request.method == "POST":
        account_number = request.form.get("account_number", "").strip()
        result = Account.query.filter_by(account_number=account_number).first()
    return render_template("admin/search_profiles.html", result=result)


# Users Management
@admin_bp.route("/users", methods=["GET", "POST"])  # edit and delete via POST for simplicity
def users():
    if not require_admin():
        return redirect(url_for("index"))

    if request.method == "POST":
        action = request.form.get("action")
        account_id = request.form.get("account_id")
        account = Account.query.get(account_id)
        if not account:
            flash("Account not found", "error")
            return redirect(url_for("admin.users"))

        if action == "delete":
            db.session.delete(account)
            db.session.commit()
            flash("Account deleted", "success")
        elif action == "edit":
            # Editable fields on customer
            account.customer.name = request.form.get("name", account.customer.name)
            account.customer.phone_number = request.form.get(
                "phone", account.customer.phone_number
            )
            account.customer.address = request.form.get(
                "address", account.customer.address
            )
            try:
                dob_str = request.form.get("dob")
                if dob_str:
                    account.customer.date_of_birth = datetime.strptime(dob_str, "%Y-%m-%d").date()
            except Exception:
                flash("Invalid DOB format", "error")
            db.session.commit()
            flash("Account updated", "success")

        return redirect(url_for("admin.users"))

    customers = (
        db.session.query(Customer, Account)
        .join(Account, Customer.id == Account.customer_id)
        .order_by(Customer.created_at.desc())
        .all()
    )
    total_customers = Customer.query.count()
    total_bank_balance = db.session.query(db.func.sum(Account.main_balance)).scalar() or 0
    total_wallet_balance = (
        db.session.query(db.func.sum(Account.wallet_balance)).scalar() or 0
    )
    return render_template(
        "admin/users.html",
        customers=customers,
        total_customers=total_customers,
        total_bank_balance=total_bank_balance,
        total_wallet_balance=total_wallet_balance,
    )

