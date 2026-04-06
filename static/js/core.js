// ==========================================
//  全局状态与权限管理 (核心)
// ==========================================
window.State = {
    user: null,   
    isAdmin: false, 
    currentRecIds: [], 
    myFollowingIds:[], 
    myFollowerIds:[],
    
    setUser(u) {
        this.user = u;
        if (u) {
            document.getElementById('dashUsername').textContent = u.username;
            document.getElementById('dashUid').textContent = u.uid;
            document.getElementById('avatarInitial').textContent = u.username.charAt(0).toUpperCase();
            this.loadAvatar(u.uid, 'avatarInitial');

            this.isAdmin = (u.username === 'manager');
            if (this.isAdmin) {
                document.getElementById('adminBadge')?.classList.remove('hidden');
                document.getElementById('adminPanel')?.classList.remove('hidden');
            } else {
                document.getElementById('adminBadge')?.classList.add('hidden');
                document.getElementById('adminPanel')?.classList.add('hidden');
            }
        }
    },
    async loadAvatar(uid, elementId, isBg = true) {
        try {
            const res = await fetch(`/api/user/avatar/${uid}`);
            const data = await res.json();
            const el = document.getElementById(elementId);
            if (el) {
                if (data.avatar) {
                    if (isBg) {
                        el.style.backgroundImage = `url(/static/avatars/${data.avatar}?uid=${uid}&t=${Date.now()})`;
                        el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
                        el.textContent = '';
                    }
                } else {
                    if (isBg) el.style.backgroundImage = 'none';
                }
            }
        } catch (e) {}
    }
};

window.syncMySocialState = async function() {
    if (!State.user) return;
    try {
        const [r1, r2] = await Promise.all([ fetch(`/following?id=${State.user.uid}`), fetch(`/followers?id=${State.user.uid}`) ]);
        const fd = await r1.json(); const fod = await r2.json();
        State.myFollowingIds = (fd.following ||[]).map(f => parseInt(f.id));
        State.myFollowerIds = (fod.followers ||[]).map(f => parseInt(f.id));
    } catch (e) { console.error("同步关系失败", e); }
};

// ==========================================
//  通用工具函数 (多面板复用)
// ==========================================
window.parseInfoTags = function(infoStr, isDark = false) {
    let basic = '', hobbies = '';
    (infoStr || "").split(',').forEach(p => {
        if(!p.includes(':')) return;
        const [key, value] = p.split(':');
        if (!value) return;
        if (key === '爱好' || key === '标签') {
            const cls = isDark ? 'bg-white/15 text-white/80' : 'bg-[#f5f0e8] text-[#7a5c38]';
            hobbies += value.split(' ').filter(t => t.trim()).map(t => `<span class="px-2 py-0.5 ${cls} rounded-full text-[10px] font-medium">${t}</span>`).join('');
        } else {
            const cls = isDark ? 'bg-white/20 text-white' : 'bg-[#fdf3e3] text-[#92714a]';
            basic += `<span class="px-2.5 py-1 ${cls} rounded-full text-xs font-semibold">${value}</span>`;
        }
    });
    return { basic, hobbies };
};

window.getFollowButtonHTML = function(targetId) {
    if (!State.user || targetId == State.user.uid) return ''; 
    const tid = parseInt(targetId); 
    const isFollowing = State.myFollowingIds.includes(tid);
    const isFollower = State.myFollowerIds.includes(tid);
    if (isFollowing) return `<button onclick="toggleFollow(this, ${tid})" data-status="unfollow" class="px-4 py-2 bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 rounded-xl text-xs font-bold transition border border-stone-200">取消关注</button>`;
    if (isFollower) return `<button onclick="toggleFollow(this, ${tid})" data-status="follow" class="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-xs font-bold transition border border-amber-200">回关</button>`;
    return `<button onclick="toggleFollow(this, ${tid})" data-status="follow" class="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition border border-blue-100">+ 关注</button>`;
};

window.toggleFollow = async function(btn, targetId) {
    btn.disabled = true;
    const currentStatus = btn.getAttribute('data-status');
    const action = currentStatus === 'follow' ? 'follow' : 'unfollow';
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="animate-pulse">...</span>';
    try {
        const res = await fetch('/api/social/toggle_follow', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ target_id: targetId, action: action })
        });
        const data = await res.json();
        if (data.status === 'success') {
            if (action === 'follow') State.myFollowingIds.push(targetId);
            else State.myFollowingIds = State.myFollowingIds.filter(id => id !== targetId);
            btn.outerHTML = getFollowButtonHTML(targetId);
            if (typeof loadRelations === 'function') loadRelations();
        } else { alert("操作失败：" + data.message); btn.innerHTML = originalHtml; }
    } catch (e) { alert("网络异常"); btn.innerHTML = originalHtml; }
    btn.disabled = false;
};

window.doAdminRetrain = async function() {
    if (!confirm("⚙️ 确认执行手动重训吗？\n\n系统将重新计算特征，训练 GCN 模型，并更新 3D 星系图。\n（约需 10-30 秒）")) return;
    const btn = document.getElementById('btn-admin-retrain');
    const originalText = btn.innerText;
    btn.innerText = "⏳ 正在重构特征与训练模型..."; btn.disabled = true;
    try {
        const res = await fetch('/api/admin/retrain', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') { alert("🎉 " + data.message); location.reload(); } 
        else { alert("❌ 失败：" + data.message); }
    } catch (err) { alert("❌ 请求异常"); } 
    finally { btn.innerText = originalText; btn.disabled = false; }
};

// ==========================================
//  路由初始化
// ==========================================
const PAGES = { '/': 'page-landing', '/auth': 'page-auth', '/dashboard': 'page-dashboard' };
window.Router = {
    go(path, replace = false) {
        if (path === '/dashboard' && !State.user) path = '/auth';
        if (path === '/auth' && State.user) path = '/dashboard';
        if (replace) history.replaceState({ path }, '', path);
        else history.pushState({ path }, '', path);
        this._render(path);
    },
    _render(path) {
        const targetId = PAGES[path] || PAGES['/'];
        Object.values(PAGES).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        requestAnimationFrame(() => {
            const tEl = document.getElementById(targetId);
            if (tEl) tEl.classList.add('active');
            if (path === '/dashboard' && State.user) {
                syncMySocialState().then(() => switchMenu('recommend'));
            }
        });
    },
    init() {
        window.addEventListener('popstate', e => this._render(e.state?.path || '/'));
        this._render('/');
    }
};

window.addEventListener('DOMContentLoaded', () => {
    Router.init();
    if(typeof fetchStats === 'function') fetchStats();
    if(typeof fetchCommunities === 'function') fetchCommunities();
    
    // 检查登录状态
    fetch('/api/auth/me').then(res => res.json()).then(data => {
        if (data.logged_in) {
            State.setUser(data.data);
            Router.go('/dashboard', true);
        }
    }).catch(()=>{});
});