import sqlite3
import os

def migrate():
    # 数据库路径，确保指向正确的 .db 文件
    db_path = os.path.join(os.path.dirname(__file__), 'campus_social.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print(f"🚀 正在连接数据库: {db_path}")

    try:
        # 1. 增加 signature 字段 (默认值设为“这个人很懒...”)
        cursor.execute("ALTER TABLE accounts ADD COLUMN signature VARCHAR(255) DEFAULT '这个人很懒，什么都没留下'")
        print("✅ 已添加 signature 字段")
    except sqlite3.OperationalError:
        print("⚠️ signature 字段可能已存在，跳过")

    try:
        # 2. 增加 status 字段 (默认值设为“找朋友”)
        cursor.execute("ALTER TABLE accounts ADD COLUMN status VARCHAR(50) DEFAULT '找朋友'")
        print("✅ 已添加 status 字段")
    except sqlite3.OperationalError:
        print("⚠️ status 字段可能已存在，跳过")

    conn.commit()
    conn.close()
    print("🎉 数据库架构升级完成！")

if __name__ == "__main__":
    migrate()