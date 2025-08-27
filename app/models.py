from datetime import datetime
from typing import Optional
from . import db
from werkzeug.security import generate_password_hash, check_password_hash
import random


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(12), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    mobile = db.Column(db.String(20), unique=True, nullable=False, index=True)
    address = db.Column(db.String(255), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    aadhar_number = db.Column(db.String(20), unique=True, nullable=False)
    pin_hash = db.Column(db.String(255), nullable=False)

    account_balance = db.Column(db.Float, default=0.0, nullable=False)
    wallet_balance = db.Column(db.Float, default=0.0, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    transactions = db.relationship("Transaction", backref="customer", lazy=True)

    def set_pin(self, pin: str) -> None:
        self.pin_hash = generate_password_hash(pin)

    def check_pin(self, pin: str) -> bool:
        return check_password_hash(self.pin_hash, pin)

    @staticmethod
    def generate_unique_account_number() -> str:
        while True:
            candidate = "".join([str(random.randint(0, 9)) for _ in range(8)])
            if not Customer.query.filter_by(account_number=candidate).first():
                return candidate


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(
        db.String(12), db.ForeignKey("customers.account_number"), nullable=False, index=True
    )
    type = db.Column(db.String(30), nullable=False)  # deposit, withdraw_wallet, transfer
    amount = db.Column(db.Float, nullable=False)
    details = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)


class LoginAttempt(db.Model):
    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True)
    identifier = db.Column(db.String(120), nullable=False)  # admin or mobile number
    is_success = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)