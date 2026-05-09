# init_db_pulse.py
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'campus_social.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🚀 正在升级数据库以支持动态脉冲...")
cursor.execute('''
CREATE TABLE IF NOT EXISTS user_visit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer_uid INTEGER NOT NULL,
    target_uid INTEGER NOT NULL,
    last_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
''')
# 顺便检查 activities 表是否有 created_at，如果没有则补上
try:
    cursor.execute("ALTER TABLE activities ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
except:
    pass
conn.commit()
conn.close()
print("✅ 数据库升级完成！现在可以启动 app.py 了。")