from typing import Dict, List

USERS: Dict[str, Dict[str, str]] = {
    "developer": {"password": "dev123", "role": "developer"},
    "doctor": {"password": "doc123", "role": "doctor"},
    "reception": {"password": "rec123", "role": "reception"},
    "nurse": {"password": "nur123", "role": "nurse"},
}

MODULES_BY_ROLE = {
    "developer": ["staff", "patients", "appointments", "reports"],
    "doctor": ["patients", "appointments"],
    "reception": ["appointments"],
    "nurse": ["patients"],
}


def authenticate_user(username: str, password: str) -> bool:
    user = USERS.get(username)
    if not user:
        return False
    return user["password"] == password


def get_user_role(username: str) -> str:
    user = USERS.get(username)
    return user["role"] if user else ""


def get_available_modules(role: str) -> List[str]:
    return MODULES_BY_ROLE.get(role, [])
