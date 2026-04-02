import torch
import torch.nn.functional as F
import numpy as np
from torch_geometric.nn import GCNConv
from torch_geometric.utils import negative_sampling
from sklearn.metrics import roc_auc_score

print(" 正在启动时序图神经网络 (带 AUC 实时监控)...")

# 1. 加载数据
data = torch.load('campus_graph_full.pt', weights_only=False)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# 2. 严格按时间切分数据集 (Train 80%, Test 20%)
total_edges = data.num_edges
split_idx = int(total_edges * 0.8)

# 过去的边（用于训练）
train_edge_index = data.edge_index[:, :split_idx].to(device)
train_edge_weight = data.edge_weight[:split_idx].to(device)

# 未来的边（用于测试评估准确率）
test_edge_index = data.edge_index[:, split_idx:].to(device)
x = data.x.to(device)

print(f" 时序切分: 训练集(过去) {split_idx} 条边, 测试集(未来) {total_edges - split_idx} 条边")

# 3. 带有时间权重的 GCN 模型
class TemporalGCN(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels):
        super(TemporalGCN, self).__init__()
        self.conv1 = GCNConv(in_channels, hidden_channels)
        self.conv2 = GCNConv(hidden_channels, out_channels)

    def forward(self, x, edge_index, edge_weight):
        x = self.conv1(x, edge_index, edge_weight=edge_weight).relu()
        x = F.dropout(x, p=0.5, training=self.training)
        return self.conv2(x, edge_index, edge_weight=edge_weight)

model = TemporalGCN(data.num_features, 64, 32).to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

# 4. 训练与验证循环
print("\n 开始训练并监控未来预测准确率 (AUC)...")

for epoch in range(1, 301):
    model.train()
    optimizer.zero_grad()
    
    # 训练：只让模型看“过去”的边和权重
    z = model(x, train_edge_index, train_edge_weight)
    
    pos_edge = train_edge_index
    neg_edge = negative_sampling(train_edge_index, num_nodes=data.num_nodes, num_neg_samples=pos_edge.size(1))

    pos_score = (z[pos_edge[0]] * z[pos_edge[1]]).sum(dim=-1)
    neg_score = (z[neg_edge[0]] * z[neg_edge[1]]).sum(dim=-1)

    loss = -torch.log(torch.sigmoid(pos_score) + 1e-15).mean() - torch.log(1 - torch.sigmoid(neg_score) + 1e-15).mean()
    loss.backward()
    optimizer.step()
    
    # 每 20 轮，拿“未来”的数据考一考它
    if epoch % 20 == 0:
        model.eval()
        with torch.no_grad():
            # 获取测试集（未来）的正样本得分
            pos_test_score = torch.sigmoid((z[test_edge_index[0]] * z[test_edge_index[1]]).sum(dim=-1)).cpu().numpy()
            
            # 生成假的未来边（负样本）
            neg_test_edge = negative_sampling(data.edge_index, num_nodes=data.num_nodes, num_neg_samples=test_edge_index.size(1)).to(device)
            neg_test_score = torch.sigmoid((z[neg_test_edge[0]] * z[neg_test_edge[1]]).sum(dim=-1)).cpu().numpy()
            
            # 计算 AUC
            preds = np.concatenate([pos_test_score, neg_test_score])
            labels = np.concatenate([np.ones_like(pos_test_score), np.zeros_like(neg_test_score)])
            auc = roc_auc_score(labels, preds)
            
            print(f'Epoch {epoch:03d} | Loss: {loss.item():.4f} |  预测未来准确率 (AUC): {auc:.4f}')

# 5. 保存
model.eval()
with torch.no_grad():
    # 最终输出全量图的 Embedding 给后端用
    final_embeddings = model(data.x.to(device), data.edge_index.to(device), data.edge_weight.to(device))
    torch.save(final_embeddings.cpu(), 'user_embeddings.pt')

print("\n 训练与评估完成！")