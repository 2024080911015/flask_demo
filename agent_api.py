from flask import Blueprint, request, jsonify, session
import requests as http_requests
import os
from datetime import datetime
from models import db, ChatHistory

# 定义为独立蓝图
agent_bp = Blueprint('agent', __name__)

# DeepSeek API 配置
DEEPSEEK_API_URL = os.environ.get("DEEPSEEK_API_URL", "https://api.deepseek.com/chat/completions")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")  # 请填入你的 DeepSeek API Key
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")  # 可选: deepseek-chat, deepseek-reasoner

@agent_bp.route('/api/agent/chat', methods=['POST'])
def openclaw_chat():
    # 局部引入，防止和 app.py 发生循环依赖死锁！
    from app import user_info_map, user_name_map, follow_dict
    
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401

    uid = session['uid']
    user_msg = request.json.get("message", "").strip()
    history = request.json.get("history",[])
    page_context = request.json.get("page_context", {})

    if not user_msg and not history:
        return jsonify({"status": "error", "message": "消息不能为空"}), 400

    user_info = user_info_map.get(uid, "未知")
    following_list = follow_dict.get(uid, [])
    followers_list =[u for u, fl in follow_dict.items() if uid in fl]

    system_prompt = f"""你现在的身份是校园社交平台的 AI 专属红娘顾问 'Claw'。
当前与你对话的用户 ID 是 {uid}，用户名是 {user_name_map.get(uid, '未知')}。
Ta 的个人资料和标签是：{user_info}。
Ta 目前关注了 {len(following_list)} 人，有 {len(followers_list)} 个粉丝。
请用幽默热情的语气回答社交困惑、给出破冰建议。每次回复控制在 200 字以内。
如果用户问到具体的页面内容，请参考当前上下文：{page_context}"""

    messages =[{"role": "system", "content": system_prompt}]
    
    if history:
        for h in history[-20:]:
            if h.get("role") in ["user", "assistant"] and h.get("content"):
                messages.append({"role": h.get("role"), "content": h.get("content")})
    else:
        messages.append({"role": "user", "content": user_msg})

    try:
        resp = http_requests.post(DEEPSEEK_API_URL, json={"model": DEEPSEEK_MODEL, "messages": messages}, 
                                  headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}, timeout=60)
        resp_data = resp.json()
        if "choices" in resp_data and len(resp_data["choices"]) > 0:
            reply = resp_data["choices"][0]["message"]["content"]
            now = datetime.now()
            db.session.add(ChatHistory(uid=uid, role='user', content=user_msg, created_at=now))
            db.session.add(ChatHistory(uid=uid, role='assistant', content=reply, created_at=now))
            db.session.commit()
            return jsonify({"status": "success", "reply": reply})
        return jsonify({"status": "error", "message": "AI 返回异常"}), 502
    except Exception as e:
        return jsonify({"status": "error", "message": f"AI 连接失败: {str(e)}"}), 500

@agent_bp.route('/api/agent/history', methods=['GET'])
def get_chat_history():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    history = ChatHistory.query.filter_by(uid=session['uid']).order_by(ChatHistory.created_at.asc()).limit(50).all()
    return jsonify({"status": "success", "history": [{"role": h.role, "content": h.content} for h in history]})

@agent_bp.route('/api/agent/history', methods=['DELETE'])
def clear_chat_history():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    try:
        ChatHistory.query.filter_by(uid=session['uid']).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "已清空"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500