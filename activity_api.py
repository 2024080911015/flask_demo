# START OF FILE activity_api.py
from flask import Blueprint, request, jsonify, session
from models import db, Activity, ActivityParticipant, Account, UserInfo
import torch
import torch.nn.functional as F
import os
import json

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

def serialize_activity(act, my_uid):
    """【核心封装】解决 undefined 问题，包含 GNN 契合度和人脉逻辑"""
    from app import user_name_map, follow_dict
    import torch
    import torch.nn.functional as F

    # 1. 成员处理与状态获取
    participants = ActivityParticipant.query.filter_by(activity_id=act.id).all()
    members = []
    my_status = -1 
    for p in participants:
        members.append({
            "uid": p.uid,
            "username": user_name_map.get(p.uid, f"用户{p.uid}"),
            "status": p.status,
            "is_initiator": p.is_initiator,
            "apply_msg": p.apply_msg
        })
        if p.uid == my_uid:
            my_status = p.status

    # 2. GNN 契合度计算 (补回之前漏掉的逻辑)
    match_score = 0
    try:
        from activity_api import get_user_embedding # 确保能调用到
        my_emb = get_user_embedding(my_uid)
        if my_emb is not None:
            # 找到核心成员的 Embedding
            team_uids = [m['uid'] for m in members if m['is_initiator']]
            team_embs = []
            for tuid in team_uids:
                emb = get_user_embedding(tuid)
                if emb is not None: team_embs.append(emb)
            
            if team_embs:
                team_mean_emb = torch.stack(team_embs).mean(dim=0)
                sim = F.cosine_similarity(my_emb.unsqueeze(0), team_mean_emb.unsqueeze(0))
                match_score = int(sim.item() * 100)
    except Exception as e:
        print(f"契合度计算异常: {e}")

    # 3. 人脉路径
    path_text = "寻找路径中..."
    my_following = follow_dict.get(my_uid, [])
    if act.publisher_uid == my_uid:
        path_text = "由你发起"
    elif act.publisher_uid in my_following:
        path_text = "直接人脉"
    else:
        for fid in my_following:
            if act.publisher_uid in follow_dict.get(fid, []):
                path_text = f"经 {user_name_map.get(fid, '同学')} 引荐"
                break

    return {
        "id": act.id,
        "title": act.title,
        "nature": act.nature,
        "description": act.description,
        "publisher_id": act.publisher_uid,
        "publisher_name": user_name_map.get(act.publisher_uid, f"用户{act.publisher_uid}"),
        "total_capacity": act.total_capacity, # 🚀 统一键名
        "deadline": act.deadline,
        "member_count": sum(1 for m in members if m['status'] == 1),
        "members": members,
        "my_status": my_status,
        "match_score": match_score, # 🚀 补全契合度
        "path_text": path_text
    }



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
    activities = Activity.query.filter_by(status=1).order_by(Activity.created_at.desc()).all()
    return jsonify({"status": "success", "data": [serialize_activity(act, my_uid) for act in activities]})

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
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    
    #  核心修改：支持传入 target_uid 参数，如果不传，则默认查询自己
    current_uid = session['uid']
    target_uid = request.args.get('target_uid', type=int) or current_uid
    
    # 我发起的
    launched = Activity.query.filter_by(publisher_uid=target_uid).all()
    # 我参与的 (排除自己发起的)
    joined_ids = [p.activity_id for p in ActivityParticipant.query.filter_by(uid=target_uid, is_initiator=False).all()]
    joined = Activity.query.filter(Activity.id.in_(joined_ids)).all() if joined_ids else []

    return jsonify({
        "status": "success", 
        "launched": [serialize_activity(act, current_uid) for act in launched], 
        "joined": [serialize_activity(act, current_uid) for act in joined]
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

@activity_bp.route('/api/activity/delete', methods=['POST'])
def delete_activity():
    """发起人撤回/删除项目"""
    if 'uid' not in session: 
        return jsonify({"status": "error", "message": "未登录"}), 401
    
    uid = session['uid']
    data = request.json
    act_id = data.get('activity_id')

    # 权限检查：只有发起人本人能删除
    act = Activity.query.get(act_id)
    if not act:
        return jsonify({"status": "error", "message": "项目不存在"}), 404
    if act.publisher_uid != uid:
        return jsonify({"status": "error", "message": "你不是发起人，无法删除"}), 403

    try:
        # 删除活动记录
        db.session.delete(act)
        # 同时删除该活动下所有的成员/申请记录
        ActivityParticipant.query.filter_by(activity_id=act_id).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "项目已成功撤回"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@activity_bp.route('/api/activity/quit', methods=['POST'])
def quit_activity():
    """参与者退出项目或取消申请"""
    if 'uid' not in session: 
        return jsonify({"status": "error", "message": "未登录"}), 401
    
    uid = session['uid']
    data = request.json
    act_id = data.get('activity_id')

    try:
        # 查找对应关系
        rel = ActivityParticipant.query.filter_by(activity_id=act_id, uid=uid).first()
        if not rel:
            return jsonify({"status": "error", "message": "未找到你的参与记录"}), 404
        
        # 如果是发起人尝试退出，提示去删除项目
        if rel.is_initiator:
            return jsonify({"status": "error", "message": "发起人不能退出，请选择撤回项目"}), 400

        db.session.delete(rel)
        db.session.commit()
        return jsonify({"status": "success", "message": "已成功退出/取消申请"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500