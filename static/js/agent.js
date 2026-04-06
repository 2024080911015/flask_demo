// ==========================================
//  OpenClaw AI 社交助手逻辑
// ==========================================

// 收集当前页面上下文，让 AI 能根据用户正在看的内容回答
function getPageContext() {
    const ctx = { active_panel: '', details: {} };

    // 1. 判断当前激活的面板
    const panels = [
        { id: 'panel-recommend', name: '推荐交友' },
        { id: 'panel-relations', name: '关系管理' },
        { id: 'panel-search', name: '找朋友' },
        { id: 'panel-profile', name: '个人空间' },
        { id: 'panel-stats', name: '全校生态大盘' }
    ];
    for (const p of panels) {
        const el = document.getElementById(p.id);
        if (el && !el.classList.contains('hidden')) {
            ctx.active_panel = p.name;
            break;
        }
    }

    // 2. 根据不同面板，提取用户正在浏览的具体数据
    try {
        if (ctx.active_panel === '推荐交友') {
            // 提取当前查看的用户信息
            const uid = document.getElementById('displayUserId')?.innerText || '';
            const uname = document.getElementById('displayUsername')?.innerText || '';
            const userTags = document.getElementById('displayUserInfo')?.innerText || '';
            ctx.details.viewing_user = { uid, username: uname, tags: userTags };

            // 提取推荐列表
            const recCards = document.querySelectorAll('#recommendList > div');
            const recs = [];
            recCards.forEach(card => {
                const text = card.innerText.replace(/\s+/g, ' ').trim();
                if (text) recs.push(text);
            });
            ctx.details.recommendations = recs;

            // 提取社交诊断报告
            const diagTitle = document.getElementById('diagTitle')?.innerText || '';
            const diagDesc = document.getElementById('diagDesc')?.innerText || '';
            const diagAdvice = document.getElementById('diagAdvice')?.innerText || '';
            if (diagTitle) {
                ctx.details.social_report = {
                    status: diagTitle,
                    description: diagDesc,
                    advice: diagAdvice
                };
            }
        } else if (ctx.active_panel === '关系管理') {
            const followingCount = document.getElementById('countFollowing')?.innerText || '0';
            const followersCount = document.getElementById('countFollowers')?.innerText || '0';
            ctx.details.following_count = followingCount;
            ctx.details.followers_count = followersCount;

            // 提取分组信息
            const groups = [];
            document.querySelectorAll('#followingGroupsContainer > details').forEach(detail => {
                const summary = detail.querySelector('summary')?.innerText?.trim() || '';
                groups.push(summary);
            });
            ctx.details.friend_groups = groups;
        } else if (ctx.active_panel === '找朋友') {
            const searchQuery = document.getElementById('globalSearchInput')?.value || '';
            const resultCount = document.getElementById('searchResultCount')?.innerText || '';
            ctx.details.search_query = searchQuery;
            ctx.details.result_summary = resultCount;

            // 提取搜索结果摘要（前5条）
            const resultCards = document.querySelectorAll('#searchResultGrid > div');
            const results = [];
            resultCards.forEach((card, i) => {
                if (i < 5) results.push(card.innerText.replace(/\s+/g, ' ').trim());
            });
            ctx.details.search_results = results;
        } else if (ctx.active_panel === '个人空间') {
            const profUsername = document.getElementById('prof-username')?.value || '';
            const profGender = document.getElementById('prof-gender')?.value || '';
            const profGrade = document.getElementById('prof-grade')?.value || '';
            const profMajor = document.getElementById('prof-major')?.value || '';

            const hobbies = Array.from(document.querySelectorAll('input[name="prof_hobbies"]:checked')).map(n => n.value);
            const tags = Array.from(document.querySelectorAll('input[name="prof_tags"]:checked')).map(n => n.value);

            ctx.details.profile = {
                username: profUsername,
                gender: profGender,
                grade: profGrade,
                major: profMajor,
                hobbies: hobbies.join('、'),
                tags: tags.join('、')
            };
        } else if (ctx.active_panel === '全校生态大盘') {
            const statsCards = document.querySelectorAll('#globalStatsContainer > div');
            const stats = [];
            statsCards.forEach(card => {
                stats.push(card.innerText.replace(/\s+/g, ' ').trim());
            });
            ctx.details.global_stats = stats;

            // 提取风云人物
            const popCards = document.querySelectorAll('#popularList > div');
            const popular = [];
            popCards.forEach((card, i) => {
                if (i < 5) popular.push(card.innerText.replace(/\s+/g, ' ').trim());
            });
            ctx.details.popular_users = popular;
        }
    } catch (e) {
        console.warn('收集页面上下文时出错', e);
    }

    // 3. 检查是否有打开的用户名片弹窗
    const modal = document.getElementById('userProfileModal');
    if (modal && !modal.classList.contains('hidden')) {
        const modalUser = document.getElementById('modalUsername')?.innerText || '';
        const modalUid = document.getElementById('modalUid')?.innerText || '';
        const modalBasic = document.getElementById('modalBasicInfo')?.innerText || '';
        const modalHobbies = document.getElementById('modalHobbiesInfo')?.innerText || '';
        const modalConn = document.getElementById('modalConnCount')?.innerText || '';
        const modalComm = document.getElementById('modalDominantComm')?.innerText || '';
        ctx.details.viewing_profile_card = {
            username: modalUser,
            uid: modalUid,
            basic_info: modalBasic,
            hobbies: modalHobbies,
            connections: modalConn,
            dominant_community: modalComm
        };
    }

    return ctx;
}

// 安全：转义 HTML 特殊字符，防止 XSS
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.renderChatMsg = function(role, content, chatBox) {
    const wrap = document.createElement('div');
    const bubble = document.createElement('div');
    if (role === 'user') {
        wrap.className = 'text-right';
        bubble.className = 'bg-amber-50 p-3 rounded-2xl rounded-tr-md inline-block border border-amber-200/80 text-amber-900 text-left shadow-sm max-w-[85%] break-words leading-relaxed';
        bubble.textContent = content;
    } else {
        wrap.className = 'text-left';
        bubble.className = 'bg-white p-3 rounded-2xl rounded-tl-md inline-block border border-stone-200/80 text-stone-700 shadow-sm max-w-[85%] break-words leading-relaxed';
        bubble.innerHTML = `<span class="text-amber-500 font-bold text-xs mr-1">Claw</span> ${escapeHtml(content)}`;
    }
    wrap.appendChild(bubble);
    chatBox.appendChild(wrap);
    chatBox.scrollTop = chatBox.scrollHeight;
}

window.loadChatHistory = async function() {
    if (!State.user || !State.user.uid) return;
    window.chatHistoryLoaded = true;
    const chatBox = document.getElementById('ai-chat-box');
    // 清空聊天框，包括欢迎消息
    chatBox.innerHTML = '';
    try {
        const res = await fetch('/api/agent/history');
        const data = await res.json();
        if (data.status === 'success') {
            window.chatHistory = data.history || [];
            window.chatHistory.forEach(item => {
                window.renderChatMsg(item.role, item.content, chatBox);
            });
        } else {
            window.chatHistory = [];
        }
    } catch (e) {
        console.error('加载聊天历史失败', e);
        window.chatHistory = [];
    }
}

window.clearChatHistory = async function() {
    if (!confirm('确定要清空所有对话历史吗？')) return;

    try {
        const res = await fetch('/api/agent/history', { method: 'DELETE' });
        const data = { json: () => Promise.resolve({}) };
        try {
            Object.assign(data, await res.json());
        } catch (e) {}

        if (data.status === 'success') {
            window.chatHistory = [];
            const chatBox = document.getElementById('ai-chat-box');
            chatBox.innerHTML = '';
            // 恢复欢迎消息
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'text-left';
            welcomeDiv.innerHTML = `
                <div class="bg-white p-3 rounded-2xl rounded-tl-md inline-block border border-stone-200/80 text-stone-600 shadow-sm max-w-[88%] leading-relaxed">
                    <span class="text-amber-500 font-bold">嗨！</span> 我是接入 <span class="font-bold text-orange-500">OpenClaw</span> 引擎的社交专属顾问 🎯<br>
                    <span class="text-stone-400 text-xs mt-2 block">试试问我："怎么和二次元圈的同学搭讪？" 或 "分析一下我的交友圈子"</span>
                </div>`;
            chatBox.appendChild(welcomeDiv);
        } else {
            alert(data.message || '清空历史失败');
        }
    } catch (e) {
        alert('清空历史失败');
    }
}

window.toggleAgent = function() {
    const widget = document.getElementById('ai-agent-widget');
    const fab = document.getElementById('ai-fab-btn');
    if (!widget) return;

    const isHidden = widget.classList.contains('hidden');
    widget.classList.toggle('hidden', !isHidden);
    widget.classList.toggle('flex', isHidden);

    // 切换 FAB 图标状态
    if (fab) fab.innerHTML = isHidden ? '✕' : '✨';

    // 打开时自动聚焦输入框和加载历史
    if (isHidden) {
        setTimeout(() => document.getElementById('ai-input')?.focus(), 100);

        if (!window.chatHistoryLoaded && State.user && State.user.uid) {
            loadChatHistory();
        }
    }
}

window.sendToAgent = async function() {
    const inputEl = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const msg = inputEl.value.trim();
    if (!msg) return;

    const chatBox = document.getElementById('ai-chat-box');

    // 初始化聊天历史
    window.chatHistory = window.chatHistory || [];
    window.chatHistory.push({ role: 'user', content: msg });

    // 获取页面上下文（调试）
    const pageContext = getPageContext();
    console.log('【AI页面上下文】', pageContext);

    // 渲染用户的消息卡片 (使用 textContent 防止 XSS)
    window.renderChatMsg('user', msg, chatBox);

    inputEl.value = '';
    inputEl.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="animate-pulse">···</span>';
    chatBox.scrollTop = chatBox.scrollHeight;

    // 渲染 Loading 占位
    const loadWrap = document.createElement('div');
    loadWrap.className = 'text-left';
    const loadBubble = document.createElement('div');
    loadBubble.className = 'bg-white p-3 rounded-2xl rounded-tl-md inline-block border border-stone-200/80 text-stone-500 shadow-sm animate-pulse max-w-[85%]';
    loadBubble.innerHTML = '<div class="flex items-center gap-2"><span class="text-amber-500">🤖</span> OpenClaw 思考中<span class="tracking-widest">...</span></div>';
    loadWrap.appendChild(loadBubble);
    chatBox.appendChild(loadWrap);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // 请求 Flask 中转路由
        const res = await fetch('/api/agent/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                message: msg,
                history: window.chatHistory,
                page_context: pageContext
            })
        });
        const data = await res.json();

        // 替换 Loading 为真实回复
        if (data.status === 'success') {
            window.chatHistory.push({ role: 'assistant', content: data.reply });
            const replyWrap = document.createElement('div');
            replyWrap.className = 'text-left';
            const replyBubble = document.createElement('div');
            replyBubble.className = 'bg-white p-3 rounded-2xl rounded-tl-md inline-block border border-stone-200/80 text-stone-700 shadow-sm max-w-[85%] break-words leading-relaxed';
            replyBubble.innerHTML = `<span class="text-amber-500 font-bold text-xs mr-1">Claw</span> ${escapeHtml(data.reply)}`;
            replyWrap.appendChild(replyBubble);
            loadWrap.replaceWith(replyWrap);
        } else {
            throw new Error(data.message || '未知错误');
        }
    } catch (e) {
        if (window.chatHistory && window.chatHistory.length > 0 && window.chatHistory[window.chatHistory.length - 1].role === 'user') {
            window.chatHistory.pop(); // 回复失败时，撤销刚才入栈的用户对话历史
        }
        const errBubble = document.createElement('div');
        errBubble.className = 'bg-red-50 p-3 rounded-2xl rounded-tl-md inline-block border border-red-200/80 text-red-600 shadow-sm max-w-[85%] break-words text-xs leading-relaxed';
        errBubble.innerHTML = `<span class="font-bold">⚠️ 服务未响应</span><br>${escapeHtml(e.message)}`;
        loadWrap.innerHTML = '';
        loadWrap.className = 'text-left';
        loadWrap.appendChild(errBubble);
    } finally {
        inputEl.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        inputEl.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// 绑定回车发送 (延迟绑定：dashboard 面板在 SPA 中可能后加载)
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'ai-input') {
        e.preventDefault();
        sendToAgent();
    }
});
