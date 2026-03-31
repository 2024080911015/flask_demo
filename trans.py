import pandas as pd
import sqlite3
import os
from werkzeug.security import generate_password_hash

print("🚀 开始将 CSV 数据迁移到 SQLite 数据库...")

# 1. 获取当前目录，并创建一个 SQLite 数据库文件
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'campus_social.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 2. 读取 users.csv 并写入数据库的 users 表
    print("正在处理 users.csv...")
    csv_users_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.csv')
    try:
        df_users = pd.read_csv(csv_users_path, encoding='utf-8')
    except UnicodeDecodeError:
        df_users = pd.read_csv(csv_users_path, encoding='gbk')

    df_users.to_sql(name='users', con=conn, if_exists='replace', index=False)
    print(f"✅ 成功将 {len(df_users)} 条用户数据存入 'users' 表！")

    # 3. 读取 edges.csv 并写入数据库的 edges 表
    print("正在处理 edges.csv...")
    csv_edges_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edges.csv')
    df_edges = pd.read_csv(csv_edges_path)

    df_edges.to_sql(name='edges', con=conn, if_exists='replace', index=False)
    print(f"✅ 成功将 {len(df_edges)} 条关系数据存入 'edges' 表！")

    # 4. 读取 edges_time.csv 并写入数据库的 edges_time 表
    print("正在处理 edges_time.csv...")
    csv_edges_time_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edges_time.csv')
    df_edges_time = pd.read_csv(csv_edges_time_path)

    df_edges_time.to_sql(name='edges_time', con=conn, if_exists='replace', index=False)
    print(f"✅ 成功将 {len(df_edges_time)} 条带时间戳的关系数据存入 'edges_time' 表！")

    # 5. 创建 1000 个账号，存入 accounts 表
    print("\n正在创建 1000 个账号...")
    cursor.execute("DELETE FROM accounts")  # 清空现有数据

    password_hash = generate_password_hash('114514')
    batch_data = []
    for uid in range(1, 1001):
        username = f"test{uid}"
        batch_data.append((uid, username, password_hash))

    cursor.executemany(
        "INSERT INTO accounts (uid, username, password_hash) VALUES (?, ?, ?)",
        batch_data
    )
    print(f"✅ 成功创建 1000 个账号！username 格式: test1 ~ test1000，密码: 114514")

except Exception as e:
    print(f"❌ 导入失败: {e}")
    conn.rollback()
finally:
    conn.commit()
    conn.close()
    print(f"🎉 迁移完成！数据库文件已生成: {db_path}")