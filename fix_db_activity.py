# START OF FILE fix_db_activity.py
import sqlite3
import os

def migrate_activity():
    db_path = os.path.join(os.path.dirname(__file__), 'campus_social.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("🚀 正在创建组队大厅相关表结构...")

    # 创建活动表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        publisher_uid INTEGER NOT NULL,
        title TEXT NOT NULL,
        nature TEXT NOT NULL,
        description TEXT NOT NULL,
        target_crowd TEXT,
        target_major TEXT,
        total_capacity INTEGER DEFAULT 5,
        deadline TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 创建参与者关系表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activity_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        uid INTEGER NOT NULL,
        is_initiator BOOLEAN DEFAULT 0,
        status INTEGER DEFAULT 0,
        apply_msg TEXT
    )
    ''')

    conn.commit()
    conn.close()
    print("✅ 组队大厅数据库准备就绪！")

if __name__ == "__main__":
    migrate_activity()