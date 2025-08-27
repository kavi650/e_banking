import random
import string
from datetime import datetime
from typing import List, Tuple

from werkzeug.security import generate_password_hash, check_password_hash


def generate_account_number() -> str:
    # 8-digit numeric account number, ensure no leading zeros bias
    return "".join(random.choices(string.digits, k=8))


def hash_pin(pin: str) -> str:
    return generate_password_hash(pin)


def verify_pin(pin: str, pin_hash: str) -> bool:
    return check_password_hash(pin_hash, pin)


def start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def end_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=23, minute=59, second=59, microsecond=999999)

