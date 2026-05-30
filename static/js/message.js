// ==========================================
//  私聊：ChatManager + InboxView
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

// ── ChatManager 组件（在用户名片弹窗中发送私聊）────
window.ChatManager = {
    _targetId: null,

    mount(targetUserId) {
        this._targetId = targetUserId;
        const wrap = document.getElementById('messageSenderWrap');
        if (!wrap) return;

        if (State.user && String(targetUserId) === String(State.user.uid)) {
            wrap.classList.add('hidden');
            return;
        }
        wrap.classList.remove('hidden');

        // 始终显示输入框，支持多次发送
        document.getElementById('msgSenderInput').classList.remove('hidden');
        document.getElementById('msgSenderDone').classList.add('hidden');
        document.getElementById('msgContent').value = '';
        document.getElementById('msgCharCount').textContent = '0/500';
        this._resetBtn();

        const ta = document.getElementById('msgContent');
        ta.oninput = () => {
            document.getElementById('msgCharCount').textContent = `${ta.value.length}/500`;
        };
    },

    _resetBtn() {
        const btn = document.getElementById('msgSendBtn');
        btn.disabled = false;
        btn.textContent = '发送';
        btn.className = btn.className
            .replace('opacity-50 cursor-not-allowed', '')
            .replace('bg-stone-400', 'bg-stone-900 hover:bg-stone-700');
    },

    async send() {
        if (!State.user) { Toast.error('请先登录'); return; }
        const content = (document.getElementById('msgContent').value || '').trim();
        if (!content) { Toast.error('消息内容不能为空'); return; }

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
                Toast.success('已发送 ✉️');
                document.getElementById('msgContent').value = '';
                document.getElementById('msgCharCount').textContent = '0/500';
                this._resetBtn();
            } else {
                Toast.error(data.message || '发送失败，请重试');
                this._resetBtn();
            }
        } catch {
            Toast.error('网络错误，请重试');
            this._resetBtn();
        }
    }
};

// ── InboxView 组件（会话列表 + 聊天窗口）────────
window.InboxView = {
    _currentPartner: null,
    _pollTimer: null,

    async load() {
        // 停止之前的轮询
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }

        // 回到会话列表
        this._currentPartner = null;
        document.getElementById('inboxConvList').classList.remove('hidden');
        document.getElementById('inboxChatView').classList.add('hidden');

        const loading = document.getElementById('inboxLoading');
        const empty   = document.getElementById('inboxEmpty');
        const list    = document.getElementById('inboxConvList');
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
                this._updateBadge(0);
                return;
            }

            list.classList.remove('hidden');
            const totalUnread = data.data.reduce((sum, c) => sum + c.unread_count, 0);
            this._updateBadge(totalUnread);

            data.data.forEach(conv => {
                const initials = (conv.partner_name || 'U').charAt(0).toUpperCase();
                const avatarHtml = conv.avatar
                    ? `<img src="${conv.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.outerHTML='<div class=\\'w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 text-lg border-2 border-white shadow-sm\\'>${initials}</div>'">`
                    : `<div class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 text-lg border-2 border-white shadow-sm">${initials}</div>`;

                const unreadBadge = conv.unread_count > 0
                    ? `<span class="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">${conv.unread_count > 99 ? '99+' : conv.unread_count}</span>` : '';

                list.innerHTML += `
                <div class="card-warm rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                     onclick="InboxView.openChat(${conv.partner_id})">
                    <div class="flex items-start gap-4">
                        <div class="shrink-0">${avatarHtml}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2 mb-1.5">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-stone-800 text-sm group-hover:text-amber-700 transition">${conv.partner_name}</span>
                                    <span class="text-stone-300 font-mono text-[10px]">#${conv.partner_id}</span>
                                    ${unreadBadge}
                                </div>
                                <span class="text-[10px] text-stone-300 shrink-0">${conv.last_time}</span>
                            </div>
                            <p class="text-sm text-stone-500 leading-relaxed truncate">${this._escapeHtml(conv.last_message)}</p>
                        </div>
                    </div>
                </div>`;
            });
        } catch {
            loading.classList.add('hidden');
            Toast.error('加载会话列表失败，请重试');
        }
    },

    async openChat(partnerId) {
        this._currentPartner = partnerId;

        // 切换视图：隐藏列表，显示聊天窗口
        document.getElementById('inboxConvList').classList.add('hidden');
        document.getElementById('inboxEmpty').classList.add('hidden');
        document.getElementById('inboxLoading').classList.add('hidden');

        const chatView = document.getElementById('inboxChatView');
        chatView.classList.remove('hidden');

        document.getElementById('chatPartnerName').textContent = '加载中...';
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('chatInput').value = '';

        await this._refreshChat(partnerId);

        // 每 5 秒轮询新消息
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = setInterval(() => this._refreshChat(partnerId, true), 5000);
    },

    async _refreshChat(partnerId, silent = false) {
        try {
            const res = await fetch(`/api/message/conversation?with=${partnerId}`, { credentials: 'same-origin' });
            const data = await res.json();
            if (!data.data) return;

            const conv = data.data;
            document.getElementById('chatPartnerName').textContent = conv.partner_name;

            const container = document.getElementById('chatMessages');
            // 只在有新消息或首次加载时更新
            const currentCount = container.querySelectorAll('.chat-bubble').length;
            if (conv.messages.length === currentCount && silent) return;

            container.innerHTML = '';
            conv.messages.forEach(m => {
                const align = m.is_mine ? 'justify-end' : 'justify-start';
                const bubbleColor = m.is_mine
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-stone-100 text-stone-700';
                container.innerHTML += `
                <div class="flex ${align} mb-3 chat-bubble">
                    <div class="max-w-[75%]">
                        <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${bubbleColor} ${m.is_mine ? 'rounded-br-md' : 'rounded-bl-md'} shadow-sm">
                            ${this._escapeHtml(m.content)}
                        </div>
                        <p class="text-[10px] text-stone-300 mt-1 ${m.is_mine ? 'text-right' : 'text-left'}">${m.created_at}</p>
                    </div>
                </div>`;
            });

            // 滚动到底部
            container.scrollTop = container.scrollHeight;

            // 如果对方有新消息，更新整个会话列表的未读数（后台刷新 list）
            if (!silent) {
                // 首次加载时标记已读
                fetch('/api/message/conversation?with=' + partnerId, { credentials: 'same-origin' });
            }
        } catch {
            if (!silent) Toast.error('加载对话失败');
        }
    },

    async sendInChat() {
        if (!this._currentPartner) return;
        const input = document.getElementById('chatInput');
        const content = (input.value || '').trim();
        if (!content) return;

        const btn = document.getElementById('chatSendBtn');
        btn.disabled = true;
        btn.textContent = '...';

        try {
            const res = await fetch('/api/message/send', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiver_id: this._currentPartner, content })
            });
            const data = await res.json();
            if (res.ok) {
                input.value = '';
                await this._refreshChat(this._currentPartner);
            } else {
                Toast.error(data.message || '发送失败');
            }
        } catch {
            Toast.error('网络错误');
        }
        btn.disabled = false;
        btn.textContent = '发送';
    },

    backToList() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
        this._currentPartner = null;
        document.getElementById('inboxChatView').classList.add('hidden');
        this.load();
    },

    _updateBadge(count) {
        const badge = document.getElementById('inboxBadge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    _escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
};

// 键盘回车发送
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        const chatInput = document.getElementById('chatInput');
        if (chatInput && document.activeElement === chatInput) {
            e.preventDefault();
            InboxView.sendInChat();
        }
    }
});
