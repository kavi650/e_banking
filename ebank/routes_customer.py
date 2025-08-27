from __future__ import annotations

from datetime import datetime
from typing import Optional

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
from utils import verify_pin


customer_bp = Blueprint("customer", __name__, url_prefix="/customer")


def require_customer() -> Optional[Account]:
    account_id = session.get("account_id")
    if not account_id:
        return None
    return Account.query.get(account_id)


@customer_bp.route("/login", methods=["POST"])
def customer_login():
    phone = request.form.get("phone", "").strip()
    pin = request.form.get("pin", "").strip()
    account = Account.query.join(Customer).filter(Customer.phone_number == phone).first()
    success = account is not None and verify_pin(pin, account.pin_hash)

    attempt = LoginAttempt(
        is_admin=False,
        username_or_phone=phone,
        success=success,
        ip_address=request.remote_addr,
    )
    db.session.add(attempt)
    db.session.flush()
    # Fraud detection: 3+ failed user logins within 5 min
    if not success:
        from datetime import datetime, timedelta
        window_start = datetime.utcnow() - timedelta(minutes=5)
        fail_count = (
            LoginAttempt.query.filter(
                LoginAttempt.is_admin.is_(False),
                LoginAttempt.username_or_phone == phone,
                LoginAttempt.success.is_(False),
                LoginAttempt.created_at >= window_start,
            ).count()
        )
        if fail_count >= 3:
            db.session.add(
                FraudAlert(
                    account_id=account.id if account else None,
                    kind="user_failed_logins",
                    description=f"{fail_count} failed user logins within 5 minutes",
                    severity="medium",
                )
            )
    db.session.commit()

    if not success:
        flash("Invalid phone or PIN", "error")
        return redirect(url_for("index"))

    session["customer_id"] = account.customer_id
    session["account_id"] = account.id
    return redirect(url_for("customer.dashboard"))


@customer_bp.route("/logout")
def customer_logout():
    session.pop("customer_id", None)
    session.pop("account_id", None)
    return redirect(url_for("index"))


@customer_bp.route("/dashboard")
def dashboard():
    account = require_customer()
    if not account:
        return redirect(url_for("index"))
    return render_template("customer/dashboard.html", account=account)


# Operations: deposit, withdraw to wallet, transfer
@customer_bp.route("/operation", methods=["POST"])
def operation():
    account = require_customer()
    if not account:
        return redirect(url_for("index"))

    op_type = request.form.get("type")
    amount = float(request.form.get("amount", 0) or 0)
    details = request.form.get("details", "")
    target_account_number = request.form.get("target_account_number", "")

    if amount <= 0:
        flash("Amount must be positive", "error")
        return redirect(url_for("customer.dashboard"))

    if op_type == "deposit":
        account.main_balance += amount
        db.session.add(Transaction(account_id=account.id, type="deposit", amount=amount, details=details))
    elif op_type == "withdraw_to_wallet":
        if account.main_balance < amount:
            flash("Insufficient main balance", "error")
            return redirect(url_for("customer.dashboard"))
        account.main_balance -= amount
        account.wallet_balance += amount
        db.session.add(Transaction(account_id=account.id, type="withdraw", amount=amount, details="to wallet"))
    elif op_type == "transfer":
        if account.main_balance < amount:
            flash("Insufficient main balance", "error")
            return redirect(url_for("customer.dashboard"))
        target = Account.query.filter_by(account_number=target_account_number).first()
        if not target:
            flash("Target account not found", "error")
            return redirect(url_for("customer.dashboard"))
        account.main_balance -= amount
        target.main_balance += amount
        db.session.add(Transaction(account_id=account.id, type="transfer", amount=amount, details=details, related_account_number=target.account_number))
        db.session.add(Transaction(account_id=target.id, type="deposit", amount=amount, details=f"from {account.account_number}", related_account_number=account.account_number))
    else:
        flash("Unknown operation", "error")
        return redirect(url_for("customer.dashboard"))

    # Fraud detection: unusual high withdrawal or rapid transactions
    from datetime import datetime, timedelta
    window_start = datetime.utcnow() - timedelta(minutes=2)
    recent_count = (
        Transaction.query.filter(
            Transaction.account_id == account.id,
            Transaction.created_at >= window_start,
        ).count()
    )
    if recent_count >= 5:
        db.session.add(FraudAlert(account_id=account.id, kind="rapid_activity", description=f"{recent_count} txns in 2 minutes", severity="high"))
    if op_type in ("withdraw_to_wallet",) and amount >= 100000:
        db.session.add(FraudAlert(account_id=account.id, kind="large_withdrawal", description=f"Withdraw {amount}", severity="high"))

    db.session.commit()
    flash("Operation successful", "success")
    return redirect(url_for("customer.dashboard"))


@customer_bp.route("/history")
def history():
    account = require_customer()
    if not account:
        return redirect(url_for("index"))
    txns = (
        Transaction.query.filter_by(account_id=account.id)
        .order_by(Transaction.created_at.desc())
        .all()
    )
    return render_template("customer/history.html", account=account, txns=txns)


@customer_bp.route("/profile")
def profile():
    account = require_customer()
    if not account:
        return redirect(url_for("index"))
    return render_template("customer/profile.html", account=account)


# Very simple chatbot endpoint for predefined answers
@customer_bp.route("/chatbot", methods=["POST"])  # returns JSON
def chatbot():
    account = require_customer()
    if not account:
        return jsonify({"reply": "Please log in."})

    message = (request.form.get("message", "") or "").lower()
    reply = "I can help with balance, profile, and history. Try: 'balance' or 'profile' or 'history'."
    if "balance" in message:
        reply = f"Main: {account.main_balance:.2f}, Wallet: {account.wallet_balance:.2f}"
    elif "profile" in message:
        c = account.customer
        reply = (
            f"Name: {c.name}, Acc: {account.account_number}, Phone: {c.phone_number}, "
            f"Addr: {c.address}, DOB: {c.date_of_birth}, Aadhar: {c.aadhar_number}"
        )
    elif "history" in message:
        last = (
            Transaction.query.filter_by(account_id=account.id)
            .order_by(Transaction.created_at.desc())
            .limit(5)
            .all()
        )
        reply = "; ".join(
            [f"{t.created_at.date()} {t.type} {t.amount:.2f}" for t in last]
        ) or "No transactions yet."

    return jsonify({"reply": reply})

