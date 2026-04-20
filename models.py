from flask_sqlalchemy import SQLAlchemy

# 初始化 SQLAlchemy，但不绑定具体的 app
db = SQLAlchemy()

# 1. 定义账号模型
class Account(db.Model):
    __tablename__ = 'accounts'
    uid = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(255), nullable=True)
    signature = db.Column(db.String(255), nullable=True, default="这个人很懒，什么都没留下")
    status = db.Column(db.String(50), nullable=True, default="找朋友")

# 2. 定义用户信息模型
class UserInfo(db.Model):
    __tablename__ = 'users'
    uid = db.Column(db.Integer, primary_key=True)
    info = db.Column(db.Text, nullable=False)

# 3. 好友分组模型
class FriendGroup(db.Model):
    __tablename__ = 'friend_groups'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uid = db.Column(db.Integer, nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)

class FriendMapping(db.Model):
    __tablename__ = 'friend_mappings'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uid = db.Column(db.Integer, nullable=False, index=True)
    target_uid = db.Column(db.Integer, nullable=False)
    group_id = db.Column(db.Integer, nullable=False)

# 4. 破冰留言模型
class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sender_id = db.Column(db.Integer, nullable=False, index=True)
    receiver_id = db.Column(db.Integer, nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False)
    # 唯一约束：每对 sender→receiver 只能有一条留言
    __table_args__ = (db.UniqueConstraint('sender_id', 'receiver_id', name='uq_sender_receiver'),)

# 5. 聊天历史模型 (AI 专属)
class ChatHistory(db.Model):
    __tablename__ = 'chat_history'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uid = db.Column(db.Integer, nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False) # 'user' 或 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False)

# 6. 活动/组队大厅模型
class Activity(db.Model):
    __tablename__ = 'activities'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    publisher_uid = db.Column(db.Integer, nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False)
    nature = db.Column(db.String(50), nullable=False) # 活动性质：学术、竞赛、娱乐
    description = db.Column(db.Text, nullable=False)
    target_crowd = db.Column(db.String(255), nullable=True) # 逗号分隔的年级
    target_major = db.Column(db.String(255), nullable=True) # 逗号分隔的专业
    total_capacity = db.Column(db.Integer, default=5)
    deadline = db.Column(db.String(50), nullable=False)
    status = db.Column(db.Integer, default=1) # 1-招募中, 0-已结束
    created_at = db.Column(db.DateTime, default=db.func.now())

# 7. 活动参与者关系表 (含申请流)
class ActivityParticipant(db.Model):
    __tablename__ = 'activity_participants'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    activity_id = db.Column(db.Integer, nullable=False, index=True)
    uid = db.Column(db.Integer, nullable=False, index=True)
    is_initiator = db.Column(db.Boolean, default=False) # 是否为初始核心成员
    status = db.Column(db.Integer, default=0) # 0-申请中, 1-已通过, 2-已拒绝
    apply_msg = db.Column(db.String(255), nullable=True) # 申请理由