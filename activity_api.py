# START OF FILE activity_api.py
from flask import Blueprint, request, jsonify, session
from models import db, Activity, ActivityParticipant, Account, UserInfo
import torch
import torch.nn.functional as F
import os

activity_bp = Blueprint('activity', __name__)

# 获取 Embedding 的辅助函数
def get_user_embedding(uid):
    try:
        # 从本地加载模型产出的向量
        embeddings = torch.load("user_embeddings.pt", map_location='cpu', weights_only=False)
        idx = uid - 1
        if 0 <= idx < embeddings.shape[0]:
            return embeddings[idx]
    except:
        pass
    return None

@activity_bp.route('/api/activity/create', methods=['POST'])
def create_activity():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    data = request.json
    
    try:
        # 1. 创建活动主体
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
        db.session.flush() # 获取自增 ID
        
        # 2. 将发起人设为初始成员
        db.session.add(ActivityParticipant(activity_id=new_act.id, uid=uid, is_initiator=True, status=1))
        
        # 3. 处理邀请的初始成员
        invited_ids = data.get('invited_ids', [])
        for iid in invited_ids:
            if int(iid) != uid:
                db.session.add(ActivityParticipant(activity_id=new_act.id, uid=int(iid), is_initiator=True, status=1))
        
        db.session.commit()
        return jsonify({"status": "success", "message": "活动发布成功！"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@activity_bp.route('/api/activity/list', methods=['GET'])
def list_activities():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    from app import follow_dict, user_name_map # 引入全局变量
    
    my_emb = get_user_embedding(my_uid)
    activities = Activity.query.filter_by(status=1).order_by(Activity.created_at.desc()).all()
    
    result = []
    for act in activities:
        # 1. 获取核心团队成员（用于 GNN 契合度计算）
        team = ActivityParticipant.query.filter_by(activity_id=act.id, is_initiator=True).all()
        team_uids = [t.uid for t in team]
        
        # 2. GNN 契合度演算
        match_score = 0
        if my_emb is not None:
            team_embs = []
            for tuid in team_uids:
                emb = get_user_embedding(tuid)
                if emb is not None: team_embs.append(emb)
            
            if team_embs:
                # 计算团队平均向量
                team_mean_emb = torch.stack(team_embs).mean(dim=0)
                # 计算余弦相似度
                sim = F.cosine_similarity(my_emb.unsqueeze(0), team_mean_emb.unsqueeze(0))
                match_score = int(sim.item() * 100)
        
        # 3. 人脉路径分析 (2度人脉)
        path_text = ""
        publisher_id = act.publisher_uid
        if publisher_id != my_uid:
            my_following = follow_dict.get(my_uid, [])
            if publisher_id in my_following:
                path_text = "你关注的人"
            else:
                # 寻找共同好友作为中间桥梁
                for friend_id in my_following:
                    if publisher_id in follow_dict.get(friend_id, []):
                        bridge_name = user_name_map.get(friend_id, "一名同学")
                        path_text = f"通过你关注的 {bridge_name} 连接"
                        break
        
        # 4. 我的报名状态
        my_rel = ActivityParticipant.query.filter_by(activity_id=act.id, uid=my_uid).first()
        my_status = "none"
        if my_rel:
            if my_rel.status == 0: my_status = "applying"
            elif my_rel.status == 1: my_status = "joined"
            elif my_rel.status == 2: my_status = "rejected"

        result.append({
            "id": act.id,
            "title": act.title,
            "nature": act.nature,
            "publisher_name": user_name_map.get(act.publisher_uid, "未知"),
            "publisher_id": act.publisher_uid,
            "description": act.description,
            "capacity": act.total_capacity,
            "deadline": act.deadline,
            "match_score": match_score,
            "path_text": path_text,
            "my_status": my_status,
            "member_count": ActivityParticipant.query.filter_by(activity_id=act.id, status=1).count()
        })
    
    return jsonify({"status": "success", "data": result})

@activity_bp.route('/api/activity/join', methods=['POST'])
def join_activity():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    act_id = request.json.get('activity_id')
    msg = request.json.get('apply_msg', '')
    
    # 检查是否重复申请
    exists = ActivityParticipant.query.filter_by(activity_id=act_id, uid=uid).first()
    if exists: return jsonify({"status": "error", "message": "请勿重复申请"}), 400
    
    db.session.add(ActivityParticipant(activity_id=act_id, uid=uid, is_initiator=False, status=0, apply_msg=msg))
    db.session.commit()
    return jsonify({"status": "success", "message": "申请已提交，请等待发起人审核"})

@activity_bp.route('/api/activity/my', methods=['GET'])
def get_my_activities():
    """获取与我相关的活动：我发起的、我参与的"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    from app import user_name_map

    # 1. 我发起的
    launched = Activity.query.filter_by(publisher_uid=uid).all()
    launched_data = []
    for act in launched:
        # 统计待审核人数 (status=0)
        pending_count = ActivityParticipant.query.filter_by(activity_id=act.id, status=0).count()
        # 获取当前成员列表
        participants = ActivityParticipant.query.filter_by(activity_id=act.id).all()
        members = []
        for p in participants:
            members.append({
                "uid": p.uid,
                "username": user_name_map.get(p.uid, f"用户{p.uid}"),
                "status": p.status,
                "is_initiator": p.is_initiator,
                "apply_msg": p.apply_msg
            })
        
        launched_data.append({
            "id": act.id,
            "title": act.title,
            "pending_count": pending_count,
            "members": members,
            "status": act.status
        })

    # 2. 我参与的（不含发起的）
    joined_rels = ActivityParticipant.query.filter_by(uid=uid, is_initiator=False).all()
    joined_data = []
    for rel in joined_rels:
        act = Activity.query.get(rel.activity_id)
        if act:
            joined_data.append({
                "id": act.id,
                "title": act.title,
                "my_status": rel.status, # 0-申请中, 1-已通过, 2-已拒绝
                "publisher_name": user_name_map.get(act.publisher_uid, "未知")
            })

    return jsonify({
        "status": "success", 
        "launched": launched_data, 
        "joined": joined_data
    })

@activity_bp.route('/api/activity/audit', methods=['POST'])
def audit_participant():
    """审批接口"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    data = request.json
    act_id = data.get('activity_id')
    target_uid = data.get('target_uid')
    new_status = data.get('status') # 1-通过, 2-拒绝

    # 权限检查：只有发起人能审批
    act = Activity.query.get(act_id)
    if not act or act.publisher_uid != my_uid:
        return jsonify({"status": "error", "message": "无权操作"}), 403

    rel = ActivityParticipant.query.filter_by(activity_id=act_id, uid=target_uid).first()
    if rel:
        rel.status = new_status
        db.session.commit()
        return jsonify({"status": "success", "message": "操作成功"})
    return jsonify({"status": "error", "message": "未找到申请记录"}), 404