import os
import subprocess
import time
from build_visual_graph import generate_graph_json

def run_pipeline():
    """
    T+1 离线重训流水线 (包含图网络重构、GCN重训、3D可视化生成)
    """
    print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}]  启动 GNN 认知进化引擎...")
    
    try:
        # 1. 运行 Step 1: 吸收最新拓扑结构
        print(" [1/3] 正在重构图数据特征与时序边...")
        # 核心修复：删去 encoding='utf-8'，加入 errors='ignore' 完美解决 Windows 中文乱码崩溃！
        step1_res = subprocess.run(["python", "step1_full_process.py"], capture_output=True, text=True, errors='ignore')
        if step1_res.returncode != 0:
            raise Exception(f"Step 1 失败:\n{step1_res.stderr}")

        # 2. 运行 Step 2: 重新训练 GCN 模型
        print(" [2/3] 正在运行 GCN 模型动态训练...")
        step2_res = subprocess.run(["python", "step2_train_full.py"], capture_output=True, text=True, errors='ignore')
        if step2_res.returncode != 0:
            raise Exception(f"Step 2 失败:\n{step2_res.stderr}")

        # 3. 运行宏观图谱生成: 为前端 3D 可视化准备最新 JSON
        print("[3/3] 正在生成前端 3D 全景社区可视化图谱...")
        generate_graph_json()

        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]  引擎运转完成！系统已全面进化！")
        return {"status": "success", "message": "GNN已吸收最新关系，社区图谱与推荐列表已更新！"}

    except Exception as e:
        print(f"训练异常: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    run_pipeline()