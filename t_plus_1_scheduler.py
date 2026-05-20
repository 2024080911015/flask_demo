import os
import subprocess
import time
from build_visual_graph import generate_graph_json

def run_pipeline():
    """
    T+1 离线重训流水线 (GCN 核心版)
    """
    print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] ⚙️ 启动 GNN 认知进化流水线...")
    
    try:
        # 1. 运行 Step 1: 构造图数据
        print(" [1/3] 正在执行数据图谱化编码...")
        s1 = subprocess.run(["python", "step1_full_process.py"], capture_output=True, text=True, errors='ignore')
        if s1.returncode != 0: raise Exception(f"Step 1 失败: {s1.stderr}")

        # 2. 运行 Step 2: GCN 深度学习
        print(" [2/3] 正在训练 GCN 链路预测模型...")
        s2 = subprocess.run(["python", "step2_train_full.py"], capture_output=True, text=True, errors='ignore')
        if s2.returncode != 0: raise Exception(f"Step 2 失败: {s2.stderr}")

        # 3. 更新 3D 星图 JSON
        print(" [3/3] 正在同步 3D 星系全景图谱数据...")
        generate_graph_json()

        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] ✨ 流水线运转成功！系统推荐权重已全面进化。")
        return {"status": "success", "message": "GCN模型重训完毕，社交关系已吸收！"}

    except Exception as e:
        print(f"❌ 重训异常: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    run_pipeline()
    run_pipeline()