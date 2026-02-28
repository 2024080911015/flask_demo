import torch
import torch.nn.functional as F
import pandas as pd
import os

print("🚀 正在启动推荐系统推理引擎...")

# ==========================================
# 1. 加载训练好的用户向量 (User Embeddings)
# ==========================================
try:
    # 加载 CPU 版本的向量，方便后端直接调用，不需要显卡
    embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
    print(f"✅ 向量加载成功！库中共有 {embeddings.shape[0]} 名用户。")
except FileNotFoundError:
    print("❌ 错误：找不到 user_embeddings.pt，请先运行 Step 2！")
    exit()

# ==========================================
# 调试专用：加载用户信息
# ==========================================
print("-" * 30)
try:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, 'users.csv')
    print(f"📂 正在尝试读取文件: {csv_path}")

    if not os.path.exists(csv_path):
        raise FileNotFoundError("文件不存在")

    # 尝试读取
    try:
        df_users = pd.read_csv(csv_path, encoding='utf-8')
    except UnicodeDecodeError:
        df_users = pd.read_csv(csv_path, encoding='gbk')

    # --- 核心修改点在这里 ---
    # 使用方括号 ['info'] 而不是 .info
    if 'uid' in df_users.columns and 'info' in df_users.columns:
        user_info_map = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
        print(f"✅ 成功加载花名册！读取到 {len(df_users)} 条用户数据。")
    else:
        print(f"❌ 列名错误！当前列名: {df_users.columns.tolist()}")
        user_info_map = {}

except Exception as e:
    user_info_map = {}
    print(f"❌ 读取 CSV 最终失败，原因: {e}")
    print("⚠️ 推荐结果将只显示 ID。")
print("-" * 30)


# ==========================================
# 2. 定义推荐函数 (核心逻辑)
# ==========================================
def recommend_friends(user_id, top_k=5):
    """
    输入：user_id (比如 10)
    输出：推荐的好友 ID 列表 [12, 55, 3]
    """
    # 1. 转换 ID (CSV是从1开始，Tensor是从0开始)
    u_idx = user_id - 1

    # 2. 越界检查
    if u_idx < 0 or u_idx >= embeddings.shape[0]:
        return []

    # 3. 拿到目标用户的向量 (1, 32)
    target_emb = embeddings[u_idx].unsqueeze(0)

    # 4. 计算余弦相似度 (Cosine Similarity)
    # 算出他和库里所有人的相似度分数
    similarity = F.cosine_similarity(target_emb, embeddings)

    # 5. 排序，取分数最高的 Top K
    # k = top_k + 1 是因为要把“自己”排除掉 (自己和自己最像)
    scores, indices = torch.topk(similarity, k=top_k + 1)

    # 6. 转换回真实 ID
    recommend_ids = (indices + 1).tolist()

    # 排除自己
    if user_id in recommend_ids:
        recommend_ids.remove(user_id)

    return recommend_ids[:top_k]


# ==========================================
# 3. 模拟测试 (User Interface)
# ==========================================
if __name__ == "__main__":
    while True:
        print("\n" + "-" * 30)
        input_id = input("请输入要推荐的学生ID (输入 q 退出): ")

        if input_id.lower() == 'q':
            break

        try:
            uid = int(input_id)
            print(f"🔍 正在为 [学生 {uid}] 计算推荐...")

            # 打印该学生原本的信息
            if uid in user_info_map:
                print(f"   当前学生信息: {user_info_map[uid]}")

            # 获取推荐列表
            rec_list = recommend_friends(uid)

            print(f"✨ 推荐好友列表: {rec_list}")

            # 打印推荐学生的信息
            if user_info_map:
                for rid in rec_list:
                    print(f"   -> 推荐 [学生 {rid}]: {user_info_map.get(rid, '未知')}")

        except ValueError:
            print("❌ 请输入数字 ID！")
        except Exception as e:
            print(f"❌ 出错: {e}")