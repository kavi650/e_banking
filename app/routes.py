from __future__ import annotations
from datetime import datetime, date
from typing import Optional, Dict, Any

from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    session,
    jsonify,
    flash,
)
from sqlalchemy import func, and_

from . import db
from .models import Customer, Transaction, LoginAttempt
from .fraud import fraud_detector

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template("index.html")


@bp.route("/login/admin", methods=["POST"]) 
def login_admin():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()

    db.session.add(LoginAttempt(identifier="admin", is_success=False))
    if username == "admin" and password == "a123":
        session["is_admin"] = True
        session["admin_username"] = username
        db.session.add(LoginAttempt(identifier="admin", is_success=True))
        db.session.commit()
        return redirect(url_for("main.admin_dashboard"))
    db.session.commit()
    flash("Invalid admin credentials", "error")
    return redirect(url_for("main.index"))


@bp.route("/login/user", methods=["POST"]) 
def login_user():
    mobile = request.form.get("mobile", "").strip()
    pin = request.form.get("pin", "").strip()

    attempt = LoginAttempt(identifier=mobile, is_success=False)
    db.session.add(attempt)

    user = Customer.query.filter_by(mobile=mobile).first()
    if user and user.check_pin(pin):
        session.clear()
        session["is_user"] = True
        session["account_number"] = user.account_number
        attempt.is_success = True
        db.session.commit()
        return redirect(url_for("main.customer_dashboard"))

    db.session.commit()
    flash("Invalid mobile or PIN", "error")
    return redirect(url_for("main.index"))


@bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.index"))


# ----------------- Admin -----------------


def admin_required():
    if not session.get("is_admin"):
        return redirect(url_for("main.index"))
    return None


@bp.route("/admin/dashboard")
def admin_dashboard():
    guarded = admin_required()
    if guarded:
        return guarded

    total_customers = db.session.query(func.count(Customer.id)).scalar() or 0
    total_bank_balance = db.session.query(func.coalesce(func.sum(Customer.account_balance), 0.0)).scalar() or 0.0
    total_wallet_balance = db.session.query(func.coalesce(func.sum(Customer.wallet_balance), 0.0)).scalar() or 0.0

    customers = Customer.query.order_by(Customer.created_at.desc()).all()

    return render_template(
        "admin_dashboard.html",
        total_customers=total_customers,
        total_bank_balance=total_bank_balance,
        total_wallet_balance=total_wallet_balance,
        customers=customers,
    )


@bp.route("/admin/create_account", methods=["POST"]) 
def admin_create_account():
    guarded = admin_required()
    if guarded:
        return guarded

    name = request.form.get("name", "").strip()
    mobile = request.form.get("mobile", "").strip()
    address = request.form.get("address", "").strip()
    dob_str = request.form.get("dob", "").strip()
    aadhar = request.form.get("aadhar", "").strip()
    pin = request.form.get("pin", "").strip()

    dob = datetime.strptime(dob_str, "%Y-%m-%d").date()

    account_number = Customer.generate_unique_account_number()

    customer = Customer(
        account_number=account_number,
        name=name,
        mobile=mobile,
        address=address,
        date_of_birth=dob,
        aadhar_number=aadhar,
        account_balance=0.0,
        wallet_balance=0.0,
    )
    customer.set_pin(pin)
    db.session.add(customer)
    db.session.commit()

    flash(f"Account created successfully! Account Number: {account_number} PIN: {pin}", "success")
    return redirect(url_for("main.admin_dashboard"))


@bp.route("/admin/analytics/data") 
def admin_analytics_data():
    guarded = admin_required()
    if guarded:
        return guarded

    mode = request.args.get("mode", "weekly")  # weekly, monthly, yearly

    q = db.session.query(
        Transaction.type,
        func.date(Transaction.created_at).label("d"),
        func.sum(Transaction.amount),
    ).group_by(Transaction.type, func.date(Transaction.created_at)).order_by(func.date(Transaction.created_at))

    rows = q.all()
    series: Dict[str, Dict[str, float]] = {}
    for ttype, d, total in rows:
        series.setdefault(ttype, {})[str(d)] = float(total or 0.0)

    # Normalize keys for chart (sorted dates)
    dates = sorted({k for s in series.values() for k in s.keys()})
    data = {
        "labels": dates,
        "datasets": [
            {"label": t, "data": [series.get(t, {}).get(d, 0.0) for d in dates]} for t in ["deposit", "withdraw_wallet", "transfer"]
        ],
    }
    return jsonify(data)


@bp.route("/admin/transactions_report", methods=["GET"]) 
def admin_transactions_report():
    guarded = admin_required()
    if guarded:
        return guarded

    account_number = request.args.get("account_number", "").strip()
    from_date = request.args.get("from_date", "").strip()
    to_date = request.args.get("to_date", "").strip()

    query = Transaction.query
    if account_number:
        query = query.filter_by(account_number=account_number)
    if from_date:
        fd = datetime.strptime(from_date, "%Y-%m-%d")
        query = query.filter(Transaction.created_at >= fd)
    if to_date:
        td = datetime.strptime(to_date, "%Y-%m-%d")
        query = query.filter(Transaction.created_at <= td)

    txns = query.order_by(Transaction.created_at.desc()).all()

    return render_template("transactions_report.html", txns=txns)


@bp.route("/admin/search", methods=["GET"]) 
def admin_search_profile():
    guarded = admin_required()
    if guarded:
        return guarded

    account_number = request.args.get("account_number", "").strip()
    customer: Optional[Customer] = None
    if account_number:
        customer = Customer.query.filter_by(account_number=account_number).first()
    return render_template("search_profiles.html", customer=customer)


@bp.route("/admin/users/edit/<account_number>", methods=["GET", "POST"]) 
def admin_edit_user(account_number: str):
    guarded = admin_required()
    if guarded:
        return guarded

    customer = Customer.query.filter_by(account_number=account_number).first_or_404()
    if request.method == "POST":
        customer.name = request.form.get("name", customer.name)
        customer.mobile = request.form.get("mobile", customer.mobile)
        customer.address = request.form.get("address", customer.address)
        dob_str = request.form.get("dob")
        if dob_str:
            customer.date_of_birth = datetime.strptime(dob_str, "%Y-%m-%d").date()
        aadhar = request.form.get("aadhar")
        if aadhar:
            customer.aadhar_number = aadhar
        db.session.commit()
        flash("Customer updated", "success")
        return redirect(url_for("main.admin_dashboard"))
    return render_template("edit_user.html", c=customer)


@bp.route("/admin/users/delete/<account_number>", methods=["POST"]) 
def admin_delete_user(account_number: str):
    guarded = admin_required()
    if guarded:
        return guarded

    customer = Customer.query.filter_by(account_number=account_number).first_or_404()
    # Delete transactions first to maintain FK integrity
    Transaction.query.filter_by(account_number=account_number).delete()
    db.session.delete(customer)
    db.session.commit()
    flash("Customer deleted", "success")
    return redirect(url_for("main.admin_dashboard"))


# ----------------- Customer -----------------


def user_required():
    if not session.get("is_user"):
        return redirect(url_for("main.index"))
    return None


@bp.route("/customer/dashboard")
def customer_dashboard():
    guarded = user_required()
    if guarded:
        return guarded

    account_number = session.get("account_number")
    user = Customer.query.filter_by(account_number=account_number).first_or_404()

    flags = fraud_detector.flag_unusual_transactions(account_number)
    login_flags = fraud_detector.flag_login_anomalies(user.mobile)

    return render_template(
        "customer_dashboard.html",
        user=user,
        fraud_flags=flags,
        login_flags=login_flags,
    )


@bp.route("/customer/deposit", methods=["POST"]) 
def customer_deposit():
    guarded = user_required()
    if guarded:
        return guarded

    amount = float(request.form.get("amount", 0) or 0)
    if amount <= 0:
        flash("Invalid deposit amount", "error")
        return redirect(url_for("main.customer_dashboard"))

    account_number = session.get("account_number")
    user = Customer.query.filter_by(account_number=account_number).first_or_404()
    user.account_balance += amount
    db.session.add(Transaction(account_number=account_number, type="deposit", amount=amount, details="Deposit"))
    db.session.commit()
    flash("Deposit successful", "success")
    return redirect(url_for("main.customer_dashboard"))


@bp.route("/customer/withdraw_wallet", methods=["POST"]) 
def customer_withdraw_wallet():
    guarded = user_required()
    if guarded:
        return guarded

    amount = float(request.form.get("amount", 0) or 0)
    account_number = session.get("account_number")
    user = Customer.query.filter_by(account_number=account_number).first_or_404()

    if amount <= 0 or amount > user.account_balance:
        flash("Invalid withdraw amount", "error")
        return redirect(url_for("main.customer_dashboard"))

    user.account_balance -= amount
    user.wallet_balance += amount
    db.session.add(
        Transaction(account_number=account_number, type="withdraw_wallet", amount=amount, details="Withdraw to Wallet")
    )
    db.session.commit()
    flash("Withdrawal to wallet successful", "success")
    return redirect(url_for("main.customer_dashboard"))


@bp.route("/customer/transfer", methods=["POST"]) 
def customer_transfer():
    guarded = user_required()
    if guarded:
        return guarded

    to_account = request.form.get("to_account", "").strip()
    amount = float(request.form.get("amount", 0) or 0)

    from_account = session.get("account_number")
    sender = Customer.query.filter_by(account_number=from_account).first_or_404()
    receiver = Customer.query.filter_by(account_number=to_account).first()
    if not receiver:
        flash("Receiver not found", "error")
        return redirect(url_for("main.customer_dashboard"))
    if amount <= 0 or amount > sender.account_balance:
        flash("Invalid transfer amount", "error")
        return redirect(url_for("main.customer_dashboard"))

    sender.account_balance -= amount
    receiver.account_balance += amount
    db.session.add(Transaction(account_number=from_account, type="transfer", amount=amount, details=f"To {to_account}"))
    db.session.add(Transaction(account_number=to_account, type="transfer", amount=amount, details=f"From {from_account}"))
    db.session.commit()

    flash("Transfer successful", "success")
    return redirect(url_for("main.customer_dashboard"))


@bp.route("/customer/history")
def customer_history():
    guarded = user_required()
    if guarded:
        return guarded

    account_number = session.get("account_number")
    txns = Transaction.query.filter_by(account_number=account_number).order_by(Transaction.created_at.desc()).all()
    return render_template("history.html", txns=txns)


@bp.route("/customer/profile")

def customer_profile():
    guarded = user_required()
    if guarded:
        return guarded

    account_number = session.get("account_number")
    user = Customer.query.filter_by(account_number=account_number).first_or_404()
    return render_template("profile.html", user=user)


@bp.route("/customer/chatbot", methods=["POST"]) 
def customer_chatbot():
    guarded = user_required()
    if guarded:
        return guarded

    message = request.form.get("message", "").lower()
    account_number = session.get("account_number")
    user = Customer.query.filter_by(account_number=account_number).first_or_404()

    def respond(text: str) -> str:
        return text

    if "account number" in message:
        return jsonify({"reply": respond(f"Your account number is {user.account_number}.")})
    if "mobile" in message:
        return jsonify({"reply": respond(f"Your mobile number is {user.mobile}.")})
    if "address" in message:
        return jsonify({"reply": respond(f"Your address is {user.address}.")})
    if "date of birth" in message or "dob" in message:
        return jsonify({"reply": respond(f"Your date of birth is {user.date_of_birth.isoformat()}.")})
    if "aadhar" in message:
        return jsonify({"reply": respond(f"Your Aadhar number is {user.aadhar_number}.")})
    if "wallet" in message:
        return jsonify({"reply": respond(f"Your wallet balance is ₹{user.wallet_balance:.2f}.")})
    if "balance" in message:
        return jsonify({"reply": respond(f"Your account balance is ₹{user.account_balance:.2f}.")})
    if "history" in message or "transactions" in message:
        count = Transaction.query.filter_by(account_number=account_number).count()
        return jsonify({"reply": respond(f"You have {count} transactions on record.")})

    return jsonify({"reply": respond("I can help with balance, wallet, profile, and history.")})