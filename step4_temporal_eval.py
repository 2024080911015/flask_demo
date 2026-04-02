import torch
import pandas as pd
import numpy as np
import torch.nn.functional as F
from torch_geometric.nn import GCNConv
from torch_geometric.utils import negative_sampling
from sklearn.metrics import roc_auc_score

print(" 正在启动动态时间序列链路预测 (Temporal Link Prediction)...")

# ==========================================
# 1. 加载数据与按时间切分 (Train/Test Split)
# ==========================================
# 加载节点特征 (使用我们做好的 52 维特征)
graph_data = torch.load('campus_graph_full.pt', weights_only=False)
x = graph_data.x

# 加载按时间排序的边列表
df_edges = pd.read_csv('edges_time.csv')
total_edges = len(df_edges)

# 按时间顺序，前 80% 作为过去(训练集)，后 20% 作为未来(测试集)
split_idx = int(total_edges * 0.8)
train_edges_df = df_edges.iloc[:split_idx]
test_edges_df = df_edges.iloc[split_idx:]

print(f" 时间切分完毕:")
print(f"   - 过去(训练集): {len(train_edges_df)} 条边 (用于学习社交规律)")
print(f"   - 未来(测试集): {len(test_edges_df)} 条边 (用于验证能否预测未来)")

# 转换为 PyTorch Tensor (注意 CSV ID 从1开始，需减1)
train_edge_index = torch.tensor([train_edges_df['source_id'].values - 1, 
                                 train_edges_df['target_id'].values - 1], dtype=torch.long)
test_edge_index = torch.tensor([test_edges_df['source_id'].values - 1, 
                                test_edges_df['target_id'].values - 1], dtype=torch.long)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
x = x.to(device)
train_edge_index = train_edge_index.to(device)
test_edge_index = test_edge_index.to(device)

# ==========================================
# 2. 定义模型
# ==========================================
class GCN(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels):
        super(GCN, self).__init__()
        self.conv1 = GCNConv(in_channels, hidden_channels)
        self.conv2 = GCNConv(hidden_channels, out_channels)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index).relu()
        x = F.dropout(x, p=0.5, training=self.training)
        return self.conv2(x, edge_index)

model = GCN(in_channels=x.shape[1], hidden_channels=64, out_channels=32).to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

# ==========================================
# 3. 仅使用“过去的数据”进行训练
# ==========================================
print("\n 开始基于【过去时间段】训练模型...")
model.train()
for epoch in range(1, 201):
    optimizer.zero_grad()
    
    # 注意：这里只传 train_edge_index
    z = model(x, train_edge_index)
    
    pos_edge_index = train_edge_index
    neg_edge_index = negative_sampling(
        edge_index=train_edge_index, num_nodes=x.shape[0],
        num_neg_samples=pos_edge_index.size(1)
    )

    pos_score = (z[pos_edge_index[0]] * z[pos_edge_index[1]]).sum(dim=-1)
    neg_score = (z[neg_edge_index[0]] * z[neg_edge_index[1]]).sum(dim=-1)

    pos_loss = -torch.log(torch.sigmoid(pos_score) + 1e-15).mean()
    neg_loss = -torch.log(1 - torch.sigmoid(neg_score) + 1e-15).mean()
    loss = pos_loss + neg_loss

    loss.backward()
    optimizer.step()
    
    if epoch % 50 == 0:
        print(f'Epoch {epoch:03d}, Training Loss: {loss.item():.4f}')

# ==========================================
# 4. 在“未来的数据”上测试准确率 (AUC)
# ==========================================
print("\n 正在评估模型预测【未来交友】的准确率 (ROC-AUC)...")
model.eval()
with torch.no_grad():
    # 使用过去的边生成最终的特征向量
    z = model(x, train_edge_index)
    
    # 计算测试集（未来发生）的正样本得分
    pos_score = torch.sigmoid((z[test_edge_index[0]] * z[test_edge_index[1]]).sum(dim=-1)).cpu().numpy()
    
    # 随机生成一些未来并没有发生的交友记录作为负样本
    neg_test_edge_index = negative_sampling(
        edge_index=torch.cat([train_edge_index, test_edge_index], dim=1), # 避开所有真实的边
        num_nodes=x.shape[0],
        num_neg_samples=test_edge_index.size(1)
    ).to(device)
    neg_score = torch.sigmoid((z[neg_test_edge_index[0]] * z[neg_test_edge_index[1]]).sum(dim=-1)).cpu().numpy()

# 拼接得分与真实标签
preds = np.concatenate([pos_score, neg_score])
labels = np.concatenate([np.ones_like(pos_score), np.zeros_like(neg_score)])

# 计算 AUC (Area Under Curve)
# AUC = 0.5 是瞎猜，0.8 以上说明预测非常准，1.0 是完美预测
auc_score = roc_auc_score(labels, preds)

print("========================================")
print(f" 动态时序预测测试完成！")
print(f" 最终预测 AUC (准确率指标): {auc_score:.4f}")
if auc_score > 0.8:
    print(" 评价: 预测非常精准！模型成功学到了校园社交随时间演化的规律！")
elif auc_score > 0.7:
    print(" 评价: 效果不错！模型能捕捉到基本的交友趋势。")
else:
    print(" 评价: 效果一般，可能需要调整模型结构或数据。")
print("========================================")