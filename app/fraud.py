from __future__ import annotations
from datetime import datetime, timedelta
from math import sqrt
from typing import List, Dict

from .models import Transaction, LoginAttempt


class FraudDetector:
    def __init__(self) -> None:
        pass

    def flag_unusual_transactions(self, account_number: str) -> List[Dict]:
        txns = (
            Transaction.query.filter_by(account_number=account_number)
            .order_by(Transaction.created_at.asc())
            .all()
        )
        if not txns:
            return []

        amounts = [t.amount for t in txns]
        flags: List[Dict] = []

        if len(amounts) >= 5:
            mean = sum(amounts) / len(amounts)
            var = sum((a - mean) ** 2 for a in amounts) / len(amounts)
            std = sqrt(var) if var > 0 else 0.0
            if std > 0:
                for t in txns:
                    z = abs((t.amount - mean) / std)
                    if z >= 3:
                        flags.append(
                            {
                                "id": t.id,
                                "amount": t.amount,
                                "created_at": t.created_at.isoformat(),
                                "reason": "Anomaly by z-score (>|3| std dev)",
                            }
                        )

        flags.extend(self._rule_based_flags(account_number))
        return flags

    def _rule_based_flags(self, account_number: str) -> List[Dict]:
        flagged: List[Dict] = []
        now = datetime.utcnow()
        last_hour = now - timedelta(hours=1)
        recent = (
            Transaction.query.filter(
                Transaction.account_number == account_number,
                Transaction.created_at >= last_hour,
            )
            .order_by(Transaction.created_at.desc())
            .all()
        )
        if len(recent) >= 5:
            flagged.append(
                {
                    "reason": "High frequency: >=5 transactions in last hour",
                    "count": len(recent),
                }
            )
        large_withdrawals = [t for t in recent if t.type == "withdraw_wallet" and t.amount >= 100000]
        if large_withdrawals:
            flagged.append(
                {
                    "reason": "Sudden high withdrawal",
                    "count": len(large_withdrawals),
                }
            )
        return flagged

    def flag_login_anomalies(self, identifier: str) -> List[Dict]:
        now = datetime.utcnow()
        window = now - timedelta(minutes=15)
        attempts = (
            LoginAttempt.query.filter(
                LoginAttempt.identifier == identifier,
                LoginAttempt.created_at >= window,
            )
            .order_by(LoginAttempt.created_at.desc())
            .all()
        )
        failures = [a for a in attempts if not a.is_success]
        flags: List[Dict] = []
        if len(failures) >= 3:
            flags.append(
                {
                    "reason": "Multiple failed logins in 15 minutes",
                    "count": len(failures),
                }
            )
        return flags


fraud_detector = FraudDetector()