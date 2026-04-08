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