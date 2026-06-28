from flask import Blueprint, request, jsonify, session
from models import db, Activity, ActivityParticipant, Account, UserInfo, Message
import torch
import torch.nn.functional as F
import os
import json
from sqlalchemy import or_
from datetime import datetime

activity_bp = Blueprint('activity', __name__)


# ✨ 新增：发送“邮件/站内信”的辅助函数
def send_notification(sender_uid, receiver_uid, content):
    """向目标用户发送通知。如果已有聊天记录则追加，防止触发 UNIQUE 约束报错"""
    existing = Message.query.filter_by(sender_id=sender_uid, receiver_id=receiver_uid).first()
    if existing:
        existing.content = content + "\n\n---\n" + existing.content
        existing.is_read = False
        existing.created_at = datetime.now()
    else:
        new_msg = Message(
            sender_id=sender_uid,
            receiver_id=receiver_uid,
            content=content,
            is_read=False,
            created_at=datetime.now()
        )
        db.session.add(new_msg)


def get_user_embedding(uid):
    try:
        import step3_recommend
        return step3_recommend.get_embedding_for_uid(uid)
    except:
        pass
    return None


def serialize_activity(act, my_uid):
    from app import user_name_map, follow_dict
    import torch
    import torch.nn.functional as F

    participants = ActivityParticipant.query.filter_by(activity_id=act.id).all()
    my_status = -1

    slots_data = []
    if act.team_slots:
        try:
            slots_data = json.loads(act.team_slots)
        except Exception as e:
            slots_data = []

    for i, slot in enumerate(slots_data):
        slot['index'] = i
        slot['is_filled'] = False
        slot['member'] = None

    members = []
    for p in participants:
        member_info = {
            "uid": p.uid,
            "username": user_name_map.get(p.uid, f"用户{p.uid}"),
            "status": p.status,
            "is_initiator": p.is_initiator,
            "apply_msg": p.apply_msg,
            "applied_slot_index": p.applied_slot_index,
            "invited_by": p.invited_by
        }
        members.append(member_info)
        if p.uid == my_uid: my_status = p.status

        if p.status == 1 and not p.is_initiator and p.applied_slot_index is not None:
            if 0 <= p.applied_slot_index < len(slots_data):
                slots_data[p.applied_slot_index]['is_filled'] = True
                slots_data[p.applied_slot_index]['member'] = member_info

    match_score = 0
    try:
        my_emb = get_user_embedding(my_uid)
        if my_emb is not None:
            team_uids = [m['uid'] for m in members if m['is_initiator']]
            team_embs = [get_user_embedding(tuid) for tuid in team_uids if get_user_embedding(tuid) is not None]
            if team_embs:
                team_mean_emb = torch.stack(team_embs).mean(dim=0)
                sim = F.cosine_similarity(my_emb.unsqueeze(0), team_mean_emb.unsqueeze(0))
                match_score = int(sim.item() * 100)
    except Exception as e:
        pass

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
        "subject_direction": act.subject_direction,
        "category": act.category,
        "description": act.description,
        "team_slots": slots_data,
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


@activity_bp.route('/api/activity/create', methods=['POST'])
def create_activity():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    data = request.json

    try:
        team_slots = data.get('team_slots', [])
        auto_capacity = 1 + len(team_slots)

        new_act = Activity(
            publisher_uid=uid,
            title=data.get('team_name', '').strip(),
            nature=data.get('nature'),
            subject_direction=data.get('subject_direction'),
            category=data.get('category'),
            team_slots=json.dumps(team_slots, ensure_ascii=False),
            description=data.get('description'),
            total_capacity=auto_capacity,
            deadline=data.get('deadline')
        )
        db.session.add(new_act)
        db.session.flush()

        db.session.add(ActivityParticipant(activity_id=new_act.id, uid=uid, is_initiator=True, status=1))
        db.session.commit()
        return jsonify({"status": "success", "message": "招募发布成功！"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@activity_bp.route('/api/activity/list', methods=['GET'])
def list_activities():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']

    keyword = request.args.get('keyword', '').strip()
    nature = request.args.get('nature', '').strip()
    category = request.args.get('category', '').strip()

    today_str = datetime.now().strftime('%Y-%m-%d')

    query = db.session.query(Activity).join(
        Account, Activity.publisher_uid == Account.uid
    ).filter(Activity.status == 1, Activity.deadline >= today_str)

    # 判断当前是否处于“筛选/搜索”模式
    has_filter = bool(keyword or nature or category)

    if nature: query = query.filter(Activity.nature == nature)
    if category: query = query.filter(Activity.category == category)

    if keyword:
        search_filter = or_(
            Activity.title.ilike(f'%{keyword}%'),
            Activity.category.ilike(f'%{keyword}%'),
            Activity.nature.ilike(f'%{keyword}%'),
            Activity.description.ilike(f'%{keyword}%'),
            Activity.team_slots.ilike(f'%{keyword}%'),
            Account.username.ilike(f'%{keyword}%')
        )
        query = query.filter(search_filter)

    # 1. 默认按照时间倒序从数据库中拉取数据
    activities = query.order_by(Activity.created_at.desc()).all()

    # 2. 序列化并计算每一张卡片的 GNN 匹配度 (match_score)
    result_data = [serialize_activity(act, my_uid) for act in activities]

    # ✨ 3. 核心逻辑：如果没有筛选条件，大厅默认转为“GNN 推荐流”模式优先
    if not has_filter:
        # 按 match_score 从高到低排序 (reverse=True)
        # 备注：Python的 sort 是稳定的，所以匹配度相同时，会保持刚刚查出来的新旧时间顺序！
        result_data.sort(key=lambda x: x['match_score'], reverse=True)

    return jsonify({"status": "success", "data": result_data})

@activity_bp.route('/api/activity/join', methods=['POST'])
def join_activity():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    act_id = request.json.get('activity_id')
    msg = request.json.get('apply_msg', '')
    slot_index = request.json.get('slot_index')

    act = Activity.query.get(act_id)
    if not act: return jsonify({"status": "error", "message": "项目不存在"}), 404

    # ✨ 互斥检测1：申请时检查，如果已经成功加入了【同比赛】的其他队伍，禁止再申请！
    if act.category:
        joined_same_category = db.session.query(ActivityParticipant).join(
            Activity, ActivityParticipant.activity_id == Activity.id
        ).filter(
            ActivityParticipant.uid == uid,
            ActivityParticipant.status == 1,  # 已成功入队
            Activity.category == act.category
        ).first()

        if joined_same_category:
            return jsonify({"status": "error", "message": f"您已成功加入【{act.category}】的其他队伍，无法重复组队！"}), 400

    exists = ActivityParticipant.query.filter_by(activity_id=act_id, uid=uid).first()
    if exists: return jsonify({"status": "error", "message": "请勿重复申请"}), 400

    db.session.add(ActivityParticipant(activity_id=act_id, uid=uid, is_initiator=False, status=0, apply_msg=msg,
                                       applied_slot_index=slot_index))
    db.session.commit()
    return jsonify({"status": "success", "message": "已成功占座并提交申请，请等待发起人审核"})


@activity_bp.route('/api/activity/my', methods=['GET'])
def get_my_activities():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    current_uid = session['uid']

    launched = Activity.query.filter_by(publisher_uid=current_uid).all()
    joined_ids = [p.activity_id for p in ActivityParticipant.query.filter_by(uid=current_uid, is_initiator=False).all()]
    joined = Activity.query.filter(Activity.id.in_(joined_ids)).all() if joined_ids else []

    return jsonify({
        "status": "success",
        "launched": [serialize_activity(act, current_uid) for act in launched],
        "joined": [serialize_activity(act, current_uid) for act in joined]
    })


@activity_bp.route('/api/activity/audit', methods=['POST'])
def audit_participant():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    data = request.json
    act_id = data.get('activity_id')
    target_uid = data.get('target_uid')
    new_status = data.get('status')
    new_slot_index = data.get('new_slot_index')

    act = Activity.query.get(act_id)
    if not act or act.publisher_uid != my_uid:
        return jsonify({"status": "error", "message": "无权操作"}), 403

    rel = ActivityParticipant.query.filter_by(activity_id=act_id, uid=target_uid).first()
    if rel:
        competition_name = act.category or "未知比赛"
        team_name = act.title or "未命名队伍"

        # 获取目标成员的用户信息（用来拿名字）
        target_user = Account.query.get(target_uid)
        target_username = target_user.username if target_user else "某成员"

        if new_status == 1:
            # 互斥检测2：队长同意时，检查该成员是否被其他【同比赛】队伍录用
            if act.category:
                joined_same_category = db.session.query(ActivityParticipant).join(
                    Activity, ActivityParticipant.activity_id == Activity.id
                ).filter(
                    ActivityParticipant.uid == target_uid,
                    ActivityParticipant.status == 1,
                    Activity.category == act.category
                ).first()
                if joined_same_category:
                    return jsonify(
                        {"status": "error", "message": f"该成员已被【{act.category}】的其他队伍录用，无法重复招募！"}), 400

            target_slot = new_slot_index if new_slot_index is not None else rel.applied_slot_index

            conflict = ActivityParticipant.query.filter_by(
                activity_id=act_id,
                applied_slot_index=target_slot,
                status=1,
                is_initiator=False
            ).first()

            if conflict and conflict.uid != target_uid:
                return jsonify({"status": "conflict", "message": "岗位已被占用"})

            if new_slot_index is not None:
                rel.applied_slot_index = new_slot_index
            rel.status = 1

            # 自动清理防骚扰
            if act.category:
                other_pendings = db.session.query(ActivityParticipant).join(
                    Activity, ActivityParticipant.activity_id == Activity.id
                ).filter(
                    ActivityParticipant.uid == target_uid,
                    ActivityParticipant.status == 0,
                    Activity.id != act.id,
                    Activity.category == act.category
                ).all()
                for op in other_pendings:
                    db.session.delete(op)

            # ✨ 通知 1：给队员发成功邮件
            msg_content = f"你已成功加入【{competition_name}】（{team_name}）！"
            send_notification(my_uid, target_uid, msg_content)

            # ✨ 通知 2：给队长自己发确认短信
            captain_msg = f"{target_username}已加入你的队伍【{competition_name}】（{team_name}）！"
            send_notification(target_uid, my_uid, captain_msg)

        else:
            was_member = (rel.status == 1)  # 判断他之前是不是已经是正式队员了
            rel.status = new_status

            if was_member:
                # ✨ 通知 3：这是“队长踢人”的情况，双方发消息
                send_notification(target_uid, my_uid,
                                  f"{target_username}已离开你的队伍【{competition_name}】（{team_name}）。")
                send_notification(my_uid, target_uid, f"你已离开【{competition_name}】（{team_name}）。")
            else:
                # 只是普通的“婉拒申请”
                msg_content = f"【{competition_name}】（{team_name}）婉拒了你😭，再接再厉！"
                send_notification(my_uid, target_uid, msg_content)

        db.session.commit()
        return jsonify({"status": "success", "message": "操作成功"})
    return jsonify({"status": "error", "message": "未找到申请记录"}), 404


@activity_bp.route('/api/activity/delete', methods=['POST'])
def delete_activity():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    act_id = request.json.get('activity_id')
    act = Activity.query.get(act_id)
    if not act or act.publisher_uid != uid: return jsonify({"status": "error", "message": "无权删除"}), 403
    try:
        db.session.delete(act)
        ActivityParticipant.query.filter_by(activity_id=act_id).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "项目已成功撤回"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@activity_bp.route('/api/activity/quit', methods=['POST'])
def quit_activity():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    act_id = request.json.get('activity_id')
    try:
        rel = ActivityParticipant.query.filter_by(activity_id=act_id, uid=uid).first()
        if not rel: return jsonify({"status": "error", "message": "未找到记录"}), 404
        if rel.is_initiator: return jsonify({"status": "error", "message": "发起人请选撤回"}), 400

        act = Activity.query.get(act_id)
        user = Account.query.get(uid)

        captain_uid = act.publisher_uid
        competition_name = act.category or "未知比赛"
        team_name = act.title or "未命名队伍"
        username = user.username if user else "某成员"

        # 判断他是不是已经正式入队了（如果在审核中取消，就不发离队短信，免得骚扰队长）
        was_member = (rel.status == 1)

        db.session.delete(rel)
        db.session.commit()

        if was_member:
            # ✨ 通知 4：队员主动离队，给队长发短信
            send_notification(uid, captain_uid, f"{username}已离开你的队伍【{competition_name}】（{team_name}）。")
            # ✨ 通知 5：给离队队员自己发短信
            send_notification(captain_uid, uid, f"你已离开【{competition_name}】（{team_name}）。")

        return jsonify({"status": "success", "message": "已成功退出/取消申请"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# ── 🆕 组队邀请接口 ──────────────────────────────
@activity_bp.route('/api/activity/invite', methods=['POST'])
def invite_to_activity():
    """队长邀请用户加入队伍"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    inviter_uid = session['uid']
    data = request.json
    act_id = data.get('activity_id')
    target_uid = data.get('target_uid')
    slot_index = data.get('slot_index')
    message = (data.get('message') or '').strip()

    if not act_id or not target_uid:
        return jsonify({"status": "error", "message": "参数不完整"}), 400

    act = Activity.query.get(act_id)
    if not act:
        return jsonify({"status": "error", "message": "活动不存在"}), 404
    if act.publisher_uid != inviter_uid:
        return jsonify({"status": "error", "message": "只有发起人可以邀请成员"}), 403

    # 检查是否已有记录
    existing = ActivityParticipant.query.filter_by(activity_id=act_id, uid=target_uid).first()
    if existing:
        return jsonify({"status": "error", "message": "该用户已在队伍中或已被邀请"}), 400

    # 互斥检测：被邀请者不能已加入同比赛的其他队伍
    if act.category:
        joined_same = db.session.query(ActivityParticipant).join(
            Activity, ActivityParticipant.activity_id == Activity.id
        ).filter(
            ActivityParticipant.uid == target_uid,
            ActivityParticipant.status == 1,
            Activity.category == act.category
        ).first()
        if joined_same:
            return jsonify({"status": "error", "message": "该用户已加入同比赛的其他队伍"}), 400

    try:
        db.session.add(ActivityParticipant(
            activity_id=act_id, uid=target_uid, is_initiator=False,
            status=0, apply_msg=message, applied_slot_index=slot_index,
            invited_by=inviter_uid
        ))

        # 发送通知给被邀请者（在 commit 之前发送，确保一起提交）
        team_name = act.title or "未命名队伍"
        comp_name = act.category or act.nature
        sender = Account.query.get(inviter_uid)
        inviter_name = sender.username if sender else "某队长"
        notify_msg = f"🔔 {inviter_name} 邀请你加入【{comp_name}】（{team_name}），去组队大厅看看吧！"
        send_notification(inviter_uid, target_uid, notify_msg)

        db.session.commit()

        return jsonify({"status": "success", "message": "邀请已发送"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@activity_bp.route('/api/activity/my_invitations', methods=['GET'])
def get_my_invitations():
    """获取我收到的组队邀请"""
    if 'uid' not in session:
        return jsonify({"status": "error"}), 401
    my_uid = session['uid']

    invited_records = db.session.query(ActivityParticipant, Activity).join(
        Activity, ActivityParticipant.activity_id == Activity.id
    ).filter(
        ActivityParticipant.uid == my_uid,
        ActivityParticipant.invited_by.isnot(None),
        ActivityParticipant.status == 0  # 待处理
    ).order_by(ActivityParticipant.id.desc()).all()

    result = []
    for part, act in invited_records:
        inviter = Account.query.get(part.invited_by)
        result.append({
            "participant_id": part.id,
            "activity_id": act.id,
            "activity_title": act.category or act.nature,
            "team_name": act.title or "未命名队伍",
            "nature": act.nature,
            "deadline": act.deadline,
            "inviter_uid": part.invited_by,
            "inviter_name": inviter.username if inviter else f"用户{part.invited_by}",
            "slot_index": part.applied_slot_index,
            "message": part.apply_msg or "",
            "created_at": act.created_at.strftime('%Y-%m-%d %H:%M') if act.created_at else ""
        })

    return jsonify({"status": "success", "data": result})


@activity_bp.route('/api/activity/invitation/respond', methods=['POST'])
def respond_invitation():
    """接受或拒绝组队邀请"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    my_uid = session['uid']
    data = request.json
    act_id = data.get('activity_id')
    action = data.get('action')  # 'accept' or 'reject'

    if not act_id or action not in ('accept', 'reject'):
        return jsonify({"status": "error", "message": "参数不完整"}), 400

    part = ActivityParticipant.query.filter_by(activity_id=act_id, uid=my_uid).filter(ActivityParticipant.invited_by.isnot(None)).first()
    if not part:
        return jsonify({"status": "error", "message": "未找到邀请记录"}), 404

    act = Activity.query.get(act_id)
    captain_uid = act.publisher_uid if act else None

    try:
        if action == 'accept':
            # 检查岗位冲突
            target_slot = part.applied_slot_index
            conflict = ActivityParticipant.query.filter_by(
                activity_id=act_id, applied_slot_index=target_slot, status=1
            ).first() if target_slot is not None else None

            if conflict and conflict.uid != my_uid:
                # 岗位已被占用，尝试分配空岗位
                slots = json.loads(act.team_slots) if act.team_slots else []
                filled = set(
                    p.applied_slot_index for p in ActivityParticipant.query.filter_by(
                        activity_id=act_id, status=1
                    ).all() if p.applied_slot_index is not None
                )
                reassigned = False
                for i in range(len(slots)):
                    if i not in filled:
                        part.applied_slot_index = i
                        reassigned = True
                        break
                if not reassigned:
                    return jsonify({"status": "error", "message": "队伍已满，无法加入"}), 400

            part.status = 1
            # 清理同比赛其他队伍的待处理记录
            if act and act.category:
                others = db.session.query(ActivityParticipant).join(
                    Activity, ActivityParticipant.activity_id == Activity.id
                ).filter(
                    ActivityParticipant.uid == my_uid,
                    ActivityParticipant.status.in_([0]),
                    Activity.id != act_id,
                    Activity.category == act.category
                ).all()
                for o in others:
                    db.session.delete(o)

            # 先发送通知，再提交
            user = Account.query.get(my_uid)
            username = user.username if user else "某用户"
            comp_name = act.category if act else "未知比赛"
            team_name = act.title if act else "未命名队伍"
            send_notification(my_uid, captain_uid, f"{username} 接受了你的组队邀请，已加入【{comp_name}】（{team_name}）！")

            db.session.commit()
            return jsonify({"status": "success", "message": "已接受邀请，成功加入队伍！"})
        else:
            # 拒绝
            part.status = 2
            # 先发送通知，再提交
            user = Account.query.get(my_uid)
            username = user.username if user else "某用户"
            comp_name = act.category if act else "未知比赛"
            team_name = act.title if act else "未命名队伍"
            send_notification(my_uid, captain_uid, f"{username} 婉拒了你的组队邀请【{comp_name}】（{team_name}）。")

            db.session.commit()
            return jsonify({"status": "success", "message": "已拒绝邀请"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
