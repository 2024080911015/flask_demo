from flask import Blueprint, request, jsonify, session
from models import db, Activity, ActivityParticipant
import torch
import torch.nn.functional as F
import os

activity_bp = Blueprint('activity', __name__)

def get_user_embedding(uid):
    try:
        embeddings = torch.load("user_embeddings.pt", map_location='cpu', weights_only=False)
        idx = int(uid) - 1
        if 0 <= idx < embeddings.shape[0]: return embeddings[idx]
    except: pass
    return None

def serialize_activity(act, my_uid):
    """【核心封装】已补全头像字段，确保阵容显示真实头像"""
    from app import user_name_map, follow_dict
    from models import Account, ActivityParticipant  # 🚀 显式引入 Account
    import torch
    import torch.nn.functional as F

    # 1. 获取所有参与者及其头像
    participants = ActivityParticipant.query.filter_by(activity_id=act.id).all()
    members = []
    my_status = -1 
    
    for p in participants:
        # 🚀 核心修改：查询 Account 获取头像
        acc = Account.query.get(p.uid)
        members.append({
            "uid": p.uid,
            "username": acc.username if acc else f"用户{p.uid}",
            "avatar": acc.avatar if acc else None, # 🚀 传出头像文件名
            "status": p.status,
            "is_initiator": p.is_initiator,
            "apply_msg": p.apply_msg
        })
        if p.uid == my_uid:
            my_status = p.status

    # 2. GNN 契合度计算 (维持不变)
    match_score = 0
    try:
        from activity_api import get_user_embedding
        my_emb = get_user_embedding(my_uid)
        if my_emb is not None:
            team_uids = [m['uid'] for m in members if m['is_initiator']]
            team_embs = [get_user_embedding(tuid) for tuid in team_uids if get_user_embedding(tuid) is not None]
            if team_embs:
                team_mean_emb = torch.stack(team_embs).mean(dim=0)
                sim = F.cosine_similarity(my_emb.unsqueeze(0), team_mean_emb.unsqueeze(0))
                match_score = int(sim.item() * 100)
    except: pass

    # 3. 人脉路径 (维持不变)
    path_text = "寻找路径中..."
    my_following = follow_dict.get(my_uid, [])
    if act.publisher_uid == my_uid:
        path_text = "由你发起"
    elif act.publisher_uid in my_following:
        path_text = "直接人脉"
    else:
        for fid in my_following:
            if act.publisher_uid in follow_dict.get(fid, []):
                path_text = f"经 {user_name_map.get(fid, '同学')} 引荐"; break

    return {
        "id": act.id,
        "title": act.title,
        "nature": act.nature,
        "description": act.description,
        "publisher_id": act.publisher_uid,
        "publisher_name": user_name_map.get(act.publisher_uid, f"用户{act.publisher_uid}"),
        "total_capacity": act.total_capacity,
        "deadline": act.deadline,
        "member_count": sum(1 for m in members if m['status'] == 1),
        "members": members,
        "my_status": my_status,
        "match_score": match_score,
        "path_text": path_text
    }

@activity_bp.route('/api/activity/list', methods=['GET'])
def list_activities():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    activities = Activity.query.filter_by(status=1).order_by(Activity.created_at.desc()).all()
    return jsonify({"status": "success", "data": [serialize_activity(act, my_uid) for act in activities]})

@activity_bp.route('/api/activity/my', methods=['GET'])
def get_my_activities():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    launched = Activity.query.filter_by(publisher_uid=my_uid).all()
    joined_ids = [p.activity_id for p in ActivityParticipant.query.filter_by(uid=my_uid, is_initiator=False).all()]
    joined = Activity.query.filter(Activity.id.in_(joined_ids)).all() if joined_ids else []
    return jsonify({
        "status": "success", 
        "launched": [serialize_activity(act, my_uid) for act in launched], 
        "joined": [serialize_activity(act, my_uid) for act in joined]
    })

@activity_bp.route('/api/activity/create', methods=['POST'])
def create_activity():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    data = request.json
    try:
        new_act = Activity(
            publisher_uid=uid,
            title=data.get('title'),
            nature=data.get('nature'),
            description=data.get('description'),
            target_crowd=",".join(data.get('target_crowd', [])),
            target_major=",".join(data.get('target_major', [])),
            total_capacity=data.get('total_capacity', 5),
            deadline=data.get('deadline')
        )
        db.session.add(new_act)
        db.session.flush()
        db.session.add(ActivityParticipant(activity_id=new_act.id, uid=uid, is_initiator=True, status=1))
        db.session.commit()
        return jsonify({"status": "success", "message": "项目启动成功！"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)})

@activity_bp.route('/api/activity/join', methods=['POST'])
def join_activity():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    act_id = request.json.get('activity_id')
    msg = request.json.get('apply_msg', '')
    exists = ActivityParticipant.query.filter_by(activity_id=act_id, uid=uid).first()
    if exists: return jsonify({"status": "error", "message": "请勿重复申请"}), 400
    db.session.add(ActivityParticipant(activity_id=act_id, uid=uid, is_initiator=False, status=0, apply_msg=msg))
    db.session.commit()
    return jsonify({"status": "success", "message": "申请已提交"})

@activity_bp.route('/api/activity/audit', methods=['POST'])
def audit_participant():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    data = request.json
    act = Activity.query.get(data.get('activity_id'))
    if not act or act.publisher_uid != my_uid: return jsonify({"status": "error", "message": "无权操作"}), 403
    rel = ActivityParticipant.query.filter_by(activity_id=act.id, uid=data.get('target_uid')).first()
    if rel:
        rel.status = data.get('status')
        db.session.commit()
        return jsonify({"status": "success", "message": "操作成功"})
    return jsonify({"status": "error", "message": "未找到记录"})

@activity_bp.route('/api/activity/delete', methods=['POST'])
def delete_activity():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    act = Activity.query.get(request.json.get('activity_id'))
    if not act or act.publisher_uid != uid: return jsonify({"status": "error", "message": "无权操作"}), 403
    ActivityParticipant.query.filter_by(activity_id=act.id).delete()
    db.session.delete(act)
    db.session.commit()
    return jsonify({"status": "success", "message": "项目已撤回"})

@activity_bp.route('/api/activity/quit', methods=['POST'])
def quit_activity():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    rel = ActivityParticipant.query.filter_by(activity_id=request.json.get('activity_id'), uid=uid).first()
    if not rel or rel.is_initiator: return jsonify({"status": "error", "message": "无法退出"}), 400
    db.session.delete(rel)
    db.session.commit()
    return jsonify({"status": "success", "message": "已退出"})