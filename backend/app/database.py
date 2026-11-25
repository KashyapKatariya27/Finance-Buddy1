import os
import sqlite3
import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from .auth import hash_password

DATA_DIR = os.environ.get("DATA_DIR") or str(Path(__file__).resolve().parent.parent / "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.environ.get("DATABASE_PATH") or os.path.join(DATA_DIR, "finance-buddy.sqlite")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def migrate_schema():
    with get_db() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'individual',
            parent_id INTEGER REFERENCES users(id),
            everyday_cents INTEGER NOT NULL DEFAULT 0,
            emergency_cents INTEGER NOT NULL DEFAULT 0,
            savings_cents INTEGER NOT NULL DEFAULT 0,
            account_mode TEXT NOT NULL DEFAULT 'family',
            age INTEGER NOT NULL DEFAULT 25,
            accountability_partner_email TEXT,
            split_everyday INTEGER NOT NULL DEFAULT 50,
            split_emergency INTEGER NOT NULL DEFAULT 20,
            split_savings INTEGER NOT NULL DEFAULT 30,
            currency TEXT NOT NULL DEFAULT 'INR',
            monthly_expenses_cents INTEGER NOT NULL DEFAULT 2000000,
            streak_days INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Add any missing columns dynamically if migrating an existing DB
        cursor = conn.execute("PRAGMA table_info(users)")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        col_defs = [
            ("account_mode", "TEXT NOT NULL DEFAULT 'family'"),
            ("age", "INTEGER NOT NULL DEFAULT 25"),
            ("accountability_partner_email", "TEXT"),
            ("split_everyday", "INTEGER NOT NULL DEFAULT 50"),
            ("split_emergency", "INTEGER NOT NULL DEFAULT 20"),
            ("split_savings", "INTEGER NOT NULL DEFAULT 30"),
            ("currency", "TEXT NOT NULL DEFAULT 'INR'"),
            ("monthly_expenses_cents", "INTEGER NOT NULL DEFAULT 2000000"),
            ("streak_days", "INTEGER NOT NULL DEFAULT 1"),
            ("parent_id", "INTEGER REFERENCES users(id)")
        ]
        for col, definition in col_defs:
            if col not in existing_cols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")

        # Goals Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            target_cents INTEGER NOT NULL,
            current_cents INTEGER NOT NULL DEFAULT 0,
            deadline TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium',
            icon TEXT DEFAULT '🎯',
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
            auto_save_cents INTEGER NOT NULL DEFAULT 0,
            auto_save_frequency TEXT DEFAULT 'none',
            round_up_enabled INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Transactions Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            type TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            note TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Approvals Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL REFERENCES users(id),
            parent_id INTEGER REFERENCES users(id),
            amount_cents INTEGER NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by INTEGER REFERENCES users(id),
            goal_id INTEGER REFERENCES goals(id),
            unlock_at TEXT,
            cooling_off INTEGER NOT NULL DEFAULT 0,
            partner_email TEXT,
            delay_days INTEGER NOT NULL DEFAULT 0,
            type TEXT NOT NULL DEFAULT 'allowance',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # App Events Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS app_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            action TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Learning Progress Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS learning_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            module_id TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, module_id)
        );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS approvals_parent_status_idx ON approvals(parent_id, status, id);")
        conn.execute("CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at DESC);")
        conn.execute("CREATE INDEX IF NOT EXISTS goals_user_idx ON goals(user_id, status);")

def seed_demo_accounts():
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()["count"]
        if count > 0:
            return

        default_hash = hash_password("password123")

        # 1. Sarah Jenkins (Parent, Family)
        cursor = conn.execute("""
            INSERT INTO users (full_name, email, password_hash, role, account_mode, age, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
            VALUES (?, ?, ?, 'parent', 'family', 38, 5000000, 15000000, 8000000, 50, 30, 20, 'INR', 4000000)
        """, ("Sarah Jenkins", "sarah@example.com", default_hash))
        sarah_id = cursor.lastrowid

        # 2. Leo Jenkins (Child, Family)
        cursor = conn.execute("""
            INSERT INTO users (full_name, email, password_hash, role, account_mode, age, parent_id, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
            VALUES (?, ?, ?, 'child', 'family', 14, ?, 725000, 435000, 290000, 50, 30, 20, 'INR', 200000)
        """, ("Leo Jenkins", "leo@example.com", default_hash, sarah_id))
        leo_id = cursor.lastrowid

        # Goal for Leo
        conn.execute("""
            INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
            VALUES (?, 'Smart Coding Laptop', 'gadget', 1200000, 960000, '2026-12-20', 'high', '💻', 'active', 50000, 'weekly', 1)
        """, (leo_id,))

        # 3. Riya Sharma (Individual Adult, Myself)
        cursor = conn.execute("""
            INSERT INTO users (full_name, email, password_hash, role, account_mode, age, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
            VALUES (?, ?, ?, 'individual', 'myself', 28, 3500000, 18000000, 9500000, 50, 30, 20, 'INR', 3000000)
        """, ("Riya Sharma", "riya@example.com", default_hash))
        riya_id = cursor.lastrowid

        # Goals for Riya
        conn.execute("""
            INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
            VALUES (?, 'Trip to Japan', 'travel', 15000000, 11250000, '2027-04-15', 'high', '✈️', 'active', 1000000, 'monthly', 1)
        """, (riya_id,))

        conn.execute("""
            INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
            VALUES (?, '6-Month Emergency Safety Net', 'emergency', 18000000, 18000000, '2026-12-31', 'high', '🛡️', 'completed', 0, 'none', 0)
        """, (riya_id,))

        # 4. Aman Verma (Teen / Student)
        cursor = conn.execute("""
            INSERT INTO users (full_name, email, password_hash, role, account_mode, age, accountability_partner_email, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
            VALUES (?, ?, ?, 'individual', 'teen', 17, 'mentor@example.com', 450000, 300000, 2750000, 50, 30, 20, 'INR', 500000)
        """, ("Aman Verma", "aman@example.com", default_hash))
        aman_id = cursor.lastrowid

        # Goal for Aman
        conn.execute("""
            INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
            VALUES (?, 'Study Laptop', 'gadget', 5500000, 2750000, '2027-01-31', 'high', '💻', 'active', 200000, 'monthly', 1)
        """, (aman_id,))

        print("✅ Python Backend: Seed demo accounts initialized (Sarah, Leo, Riya, Aman).")
