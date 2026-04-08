// ==========================================
//  破冰留言：MessageSender + InboxView
// ==========================================

// ── Toast 轻量实现（无需外部库）──────────────
const Toast = {
    _container: null,
    _getContainer() {
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;';
            document.body.appendChild(this._container);
        }
        return this._container;
    },
    show(msg, type = 'info') {
        const colors = { success: '#16a34a', error: '#dc2626', info: '#92714a' };
        const icons  = { success: '✓', error: '✕', info: 'ℹ' };
        const el = document.createElement('div');
        el.style.cssText = `
            background:#fff; color:#1c1917; padding:10px 18px; border-radius:999px;
            font-size:13px; font-weight:500; box-shadow:0 4px 24px rgba(0,0,0,0.12);
            border-left:3px solid ${colors[type]}; display:flex; align-items:center; gap:8px;
            opacity:0; transform:translateY(-8px); transition:opacity .25s,transform .25s;
            pointer-events:auto;
        `;
        el.innerHTML = `<span style="color:${colors[type]};font-weight:700">${icons[type]}</span>${msg}`;
        this._getContainer().appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        setTimeout(() => {
            el.style.opacity = '0'; el.style.transform = 'translateY(-8px)';
            setTimeout(() => el.remove(), 280);
        }, 3000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg)   { this.show(msg, 'error'); },
    info(msg)    { this.show(msg, 'info'); },
};
window.Toast = Toast;

// ── MessageSender 组件 ────────────────────
window.MessageSender = {
    _targetId: null,

    // 打开模态框时调用，传入目标用户 ID
    mount(targetUserId) {
        this._targetId = targetUserId;
        const wrap = document.getElementById('messageSenderWrap');
        if (!wrap) return;

        // 不能给自己留言
        if (State.user && String(targetUserId) === String(State.user.uid)) {
            wrap.classList.add('hidden');
            return;
        }
        wrap.classList.remove('hidden');

        // 重置到输入状态
        document.getElementById('msgSenderInput').classList.remove('hidden');
        document.getElementById('msgSenderDone').classList.add('hidden');
        document.getElementById('msgContent').value = '';
        document.getElementById('msgCharCount').textContent = '0/500';
        document.getElementById('msgSendBtn').disabled = false;
        document.getElementById('msgSendBtn').textContent = '发送留言';
        document.getElementById('msgSendBtn').className = document.getElementById('msgSendBtn').className
            .replace('opacity-50 cursor-not-allowed', '')
            .replace('bg-stone-400', 'bg-stone-900 hover:bg-stone-700');

        // 字数统计
        const ta = document.getElementById('msgContent');
        ta.oninput = () => {
            document.getElementById('msgCharCount').textContent = `${ta.value.length}/500`;
        };
    },

    _setDone() {
        document.getElementById('msgSenderInput').classList.add('hidden');
        document.getElementById('msgSenderDone').classList.remove('hidden');
    },

    async send() {
        if (!State.user) { Toast.error('请先登录'); return; }
        const content = (document.getElementById('msgContent').value || '').trim();
        if (!content) { Toast.error('留言内容不能为空'); return; }

        const btn = document.getElementById('msgSendBtn');
        btn.disabled = true;
        btn.textContent = '发送中...';

        try {
            const res = await fetch('/api/message/send', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiver_id: this._targetId, content })
            });
            const data = await res.json();

            if (res.ok) {
                Toast.success('破冰留言已发送 ✉️');
                this._setDone();
            } else if (res.status === 403) {
                // 已留言过，同样切换到已发送状态
                Toast.info('你已经给 TA 发过破冰留言了');
                this._setDone();
            } else {
                Toast.error(data.message || '发送失败，请重试');
                btn.disabled = false;
                btn.textContent = '发送留言';
            }
        } catch {
            Toast.error('网络错误，请重试');
            btn.disabled = false;
            btn.textContent = '发送留言';
        }
    }
};

// ── InboxView 组件 ────────────────────────
window.InboxView = {
    async load() {
        const loading = document.getElementById('inboxLoading');
        const empty   = document.getElementById('inboxEmpty');
        const list    = document.getElementById('inboxList');
        if (!loading) return;

        loading.classList.remove('hidden');
        empty.classList.add('hidden');
        list.classList.add('hidden');
        list.innerHTML = '';

        try {
            const res = await fetch('/api/message/inbox', { credentials: 'same-origin' });
            const data = await res.json();
            loading.classList.add('hidden');

            if (!data.data || data.data.length === 0) {
                empty.classList.remove('hidden');
                // 清空徽标
                const badge = document.getElementById('inboxBadge');
                if (badge) { badge.classList.add('hidden'); badge.textContent = ''; }
                return;
            }

            list.classList.remove('hidden');
            data.data.forEach(msg => {
                const initials = (msg.sender_name || 'U').charAt(0).toUpperCase();
                const avatarHtml = msg.avatar
                    ? `<img src="${msg.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.outerHTML='<div class=\\'w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 text-lg border-2 border-white shadow-sm\\'>${initials}</div>'">`
                    : `<div class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 text-lg border-2 border-white shadow-sm">${initials}</div>`;

                const unreadDot = !msg.is_read
                    ? `<span class="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-1.5"></span>` : '';

                list.innerHTML += `
                <div class="card-warm rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                     onclick="openUserModal(${msg.sender_id})">
                    <div class="flex items-start gap-4">
                        <div class="shrink-0">${avatarHtml}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <div class="flex items-center gap-2">
                                    ${unreadDot}
                                    <span class="font-semibold text-stone-800 text-sm group-hover:text-amber-700 transition">${msg.sender_name}</span>
                                    <span class="text-stone-300 font-mono text-[10px]">#${msg.sender_id}</span>
                                </div>
                                <span class="text-[10px] text-stone-300 shrink-0">${msg.created_at}</span>
                            </div>
                            <p class="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap break-words">${this._escapeHtml(msg.content)}</p>
                        </div>
                    </div>
                </div>`;
            });

            // 更新徽标（未读数）
            const unreadCount = data.data.filter(m => !m.is_read).length;
            const badge = document.getElementById('inboxBadge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        } catch {
            loading.classList.add('hidden');
            Toast.error('加载收件箱失败，请重试');
        }
    },

    _escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
};
