import sqlite3


def upgrade_db():
    conn = sqlite3.connect('campus_social.db')
    cursor = conn.cursor()
    print("开始更新数据库 V3...")

    try:
        # 增加一个记录“申请了哪个坑位”的索引字段
        cursor.execute("ALTER TABLE activity_participants ADD COLUMN applied_slot_index INTEGER")
        print("✅ 成功添加 applied_slot_index 字段")
    except sqlite3.OperationalError as e:
        print(f"⚠️ applied_slot_index 字段可能已存在或出错: {e}")

    conn.commit()
    conn.close()
    print("数据库更新完毕！")


if __name__ == '__main__':
    upgrade_db()