import pandas as pd
import sqlite3
import os

print("🚀 开始将 CSV 数据迁移到 SQLite 数据库...")

# 1. 获取当前目录，并创建一个 SQLite 数据库文件
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'campus_social.db')
# 如果数据库不存在，会自动创建；如果存在，就会连接它
conn = sqlite3.connect(db_path)

try:
    # 2. 读取 users.csv 并写入数据库的 users 表
    print("正在处理 users.csv...")
    csv_users_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.csv')
    try:
        df_users = pd.read_csv(csv_users_path, encoding='utf-8')
    except UnicodeDecodeError:
        df_users = pd.read_csv(csv_users_path, encoding='gbk')
    
    # 将 DataFrame 直接塞进数据库！
    # name='users' 是表名，if_exists='replace' 表示如果表已存在就替换，index=False 表示不把行索引存入数据库
    df_users.to_sql(name='users', con=conn, if_exists='replace', index=False)
    print(f"✅ 成功将 {len(df_users)} 条用户数据存入 'users' 表！")

    # 3. 读取 edges.csv 并写入数据库的 edges 表
    print("正在处理 edges.csv...")
    csv_edges_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edges.csv')
    df_edges = pd.read_csv(csv_edges_path)
    
    df_edges.to_sql(name='edges', con=conn, if_exists='replace', index=False)
    print(f"✅ 成功将 {len(df_edges)} 条关系数据存入 'edges' 表！")

except Exception as e:
    print(f"❌ 导入失败: {e}")
finally:
    # 4. 关闭数据库连接
    conn.close()
    print(f"🎉 迁移完成！数据库文件已生成: {db_path}")