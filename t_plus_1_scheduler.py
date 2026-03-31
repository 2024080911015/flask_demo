import subprocess
import time

def run_pipeline():
    print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] 🚀 启动 GNN 模型重训引擎...")
    try:
        # 1. 运行 Step 1
        print("⏳ [1/2] 正在重构图数据特征与时序边...")
        step1_res = subprocess.run(["python", "step1_full_process.py"], capture_output=True, text=True, encoding='utf-8')
        if step1_res.returncode != 0:
            raise Exception(f"Step 1 失败:\n{step1_res.stderr}")

        # 2. 运行 Step 2
        print("⏳ [2/2] 正在运行 GCN 模型动态训练 (吸收最新拓扑结构)...")
        step2_res = subprocess.run(["python", "step2_train_full.py"], capture_output=True, text=True, encoding='utf-8')
        if step2_res.returncode != 0:
            raise Exception(f"Step 2 失败:\n{step2_res.stderr}")

        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] ✅ 训练圆满完成！user_embeddings.pt 已更新！")
        return {"status": "success", "message": "GNN 已吸收最新社交关系，模型进化完成！"}

    except Exception as e:
        print(f"❌ 训练异常: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    run_pipeline()