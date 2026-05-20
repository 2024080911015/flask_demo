import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv
from torch_geometric.utils import negative_sampling
from sklearn.metrics import roc_auc_score
import numpy as np

print("🧠 [Step 2] 正在启动 GCN 链路预测训练引擎...")

# 1. 加载数据
data = torch.load('campus_graph_full.pt', weights_only=False)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# 2. 定义双层 GCN 模型
class CampusGCN(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels):
        super(CampusGCN, self).__init__()
        # 第一层卷积：聚合一度邻居特征
        self.conv1 = GCNConv(in_channels, hidden_channels)
        # 第二层卷积：聚合二度邻居特征，输出最终 Embedding
        self.conv2 = GCNConv(hidden_channels, out_channels)

    def forward(self, x, edge_index, edge_weight):
        # 卷积 -> 激活 -> Dropout (防止过拟合)
        x = self.conv1(x, edge_index, edge_weight=edge_weight).relu()
        x = F.dropout(x, p=0.3, training=self.training)
        x = self.conv2(x, edge_index, edge_weight=edge_weight)
        return x

# 初始化模型 (输入52维 -> 隐藏层64维 -> 输出32维 Embedding)
model = CampusGCN(data.num_features, 64, 32).to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)
data = data.to(device)

# 3. 训练循环
def train():
    model.train()
    optimizer.zero_grad()
    
    # 得到全图 Embedding
    z = model(data.x, data.edge_index, data.edge_weight)
    
    # 正样本：图中真实存在的边
    pos_edge_index = data.edge_index
    # 负样本：随机采样图中不存在的边（数量与正样本一致）
    neg_edge_index = negative_sampling(edge_index=data.edge_index, num_nodes=data.num_nodes)

    # 计算边得分（节点向量的点积）
    pos_score = (z[pos_edge_index[0]] * z[pos_edge_index[1]]).sum(dim=-1)
    neg_score = (z[neg_edge_index[0]] * z[neg_edge_index[1]]).sum(dim=-1)

    # 损失函数：让正样本得分接近 1，负样本得分接近 0
    loss = -torch.log(torch.sigmoid(pos_score) + 1e-15).mean() - \
           torch.log(1 - torch.sigmoid(neg_score) + 1e-15).mean()
    
    loss.backward()
    optimizer.step()
    return loss.item()

# 4. 执行训练并监控
for epoch in range(1, 201):
    loss = train()
    if epoch % 50 == 0:
        model.eval()
        with torch.no_grad():
            z = model(data.x, data.edge_index, data.edge_weight)
            # 简单评估：计算正负样本得分的 AUC (国赛加分项：指标化)
            pos_src, pos_dst = data.edge_index
            neg_edge = negative_sampling(data.edge_index, num_nodes=data.num_nodes)
            neg_src, neg_dst = neg_edge
            
            pos_preds = torch.sigmoid((z[pos_src] * z[pos_dst]).sum(dim=-1))
            neg_preds = torch.sigmoid((z[neg_src] * z[neg_dst]).sum(dim=-1))
            
            y = np.concatenate([np.ones(pos_preds.size(0)), np.zeros(neg_preds.size(0))])
            pred = np.concatenate([pos_preds.cpu().numpy(), neg_preds.cpu().numpy()])
            auc = roc_auc_score(y, pred)
            print(f'Epoch {epoch:03d} | Loss: {loss:.4f} | 训练集覆盖率(AUC): {auc:.4f}')

# 5. 最终产出 Embedding
model.eval()
with torch.no_grad():
    final_embeddings = model(data.x, data.edge_index, data.edge_weight)
    # 保存为后端推荐可用的 .pt 文件
    torch.save(final_embeddings.cpu(), 'user_embeddings.pt')

print("\n✅ GCN 模型训练完成，精炼特征已存入 user_embeddings.pt")