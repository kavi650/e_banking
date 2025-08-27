from __future__ import annotations

from datetime import datetime
from typing import Optional

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class TimestampMixin:
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Customer(db.Model, TimestampMixin):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)
    address = db.Column(db.String(255), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    aadhar_number = db.Column(db.String(20), unique=True, nullable=False)

    account = db.relationship("Account", back_populates="customer", uselist=False)


class Account(db.Model, TimestampMixin):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    account_number = db.Column(db.String(20), unique=True, nullable=False)
    pin_hash = db.Column(db.String(255), nullable=False)
    main_balance = db.Column(db.Float, nullable=False, default=0.0)
    wallet_balance = db.Column(db.Float, nullable=False, default=0.0)

    customer = db.relationship("Customer", back_populates="account")
    transactions = db.relationship(
        "Transaction", back_populates="account", cascade="all, delete-orphan"
    )


class Transaction(db.Model, TimestampMixin):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    type = db.Column(
        db.String(30),
        nullable=False,
    )  # deposit, withdraw, transfer, wallet_withdraw, wallet_deposit
    amount = db.Column(db.Float, nullable=False)
    details = db.Column(db.String(255), nullable=True)
    related_account_number = db.Column(db.String(20), nullable=True)

    account = db.relationship("Account", back_populates="transactions")


class LoginAttempt(db.Model, TimestampMixin):
    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    username_or_phone = db.Column(db.String(120), nullable=False)
    success = db.Column(db.Boolean, nullable=False, default=False)
    ip_address = db.Column(db.String(64), nullable=True)


class FraudAlert(db.Model, TimestampMixin):
    __tablename__ = "fraud_alerts"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    kind = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    severity = db.Column(db.String(20), nullable=False, default="medium")
    resolved = db.Column(db.Boolean, nullable=False, default=False)

