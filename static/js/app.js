// ==========================================
//  全局状态与权限管理
// ==========================================
const State = {
    user: null,   
    isAdmin: false, // 权限标识
    currentRecIds:[], // 暂存当前推荐列表的 ID，传给专属星图用
    
    setUser(u) {
        this.user = u;
        if (u) {
            document.getElementById('dashUsername').textContent = u.username;
            document.getElementById('dashUid').textContent = u.uid;
            document.getElementById('avatarInitial').textContent = u.username.charAt(0).toUpperCase();
            
            // 【权限控制】：假设 test1 账号（或 uid=1）是管理员
            this.isAdmin = (u.uid === 1 || u.username === 'test1');
            
            if (this.isAdmin) {
                document.getElementById('searchContainer').classList.remove('hidden');
                document.getElementById('adminBadge').classList.remove('hidden');
                document.getElementById('searchInput').value = u.uid;
            } else {
                document.getElementById('searchContainer').classList.add('hidden');
                document.getElementById('adminBadge').classList.add('hidden');
            }
        }
    }
};

// ==========================================
//  弹窗 (Modal) 与图谱交互逻辑
// ==========================================
function openGraphModal(url) {
    const modal = document.getElementById('graphModal');
    const iframe = document.getElementById('graphIframe');
    iframe.src = url;
    modal.classList.remove('hidden');
}

function closeGraphModal() {
    const modal = document.getElementById('graphModal');
    const iframe = document.getElementById('graphIframe');
    modal.classList.add('hidden');
    iframe.src = ''; // 清空 src 防止后台继续渲染耗性能
}

function openPersonalGraph() {
    if (!currentUserId) return;
    // 调用之前的 personal_graph.html，把当前 ID 和推荐的 5 个 ID 传过去
    const url = `/static/personal_graph.html?uid=${currentUserId}&recs=${State.currentRecIds.join(',')}`;
    openGraphModal(url);
}

// ==========================================
//  路由
// ==========================================
const PAGES = { '/': 'page-landing', '/auth': 'page-auth', '/dashboard': 'page-dashboard' };
const Router = {
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
            document.getElementById(targetId).classList.add('active');
            
            // 【核心】：普通用户进入 Dashboard，自动、强制加载自己的数据
            if (path === '/dashboard' && State.user) {
                if (!State.isAdmin) {
                    searchUser(State.user.uid);
                } else {
                    searchUser(document.getElementById('searchInput').value || State.user.uid);
                }
            }
        });
    },
    init() {
        window.addEventListener('popstate', e => this._render(e.state?.path || '/'));
        this._render('/');
    }
};

// ==========================================
//  登录 / 注册 / 登出
// ==========================================
function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('authForm-login').classList.toggle('hidden-form', !isLogin);
    document.getElementById('authForm-register').classList.toggle('hidden-form', isLogin);
    document.getElementById('authTab-login').classList.toggle('on', isLogin);
    document.getElementById('authTab-register').classList.toggle('on', !isLogin);
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    if (!username || !password) { errEl.textContent = '用户名和密码不能为空'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.status === 'success') {
            State.setUser(data.data);
            Router.go('/dashboard');
        } else { errEl.textContent = data.message || '登录失败'; errEl.classList.remove('hidden'); }
    } catch { errEl.textContent = '网络错误'; errEl.classList.remove('hidden'); }
}

async function doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const info = document.getElementById('reg-info').value.trim();
    const errEl = document.getElementById('reg-error');
    const sucEl = document.getElementById('reg-success');
    errEl.classList.add('hidden'); sucEl.classList.add('hidden');
    if (!username || !password) { errEl.textContent = '为空'; errEl.classList.remove('hidden'); return; }
    try {
        const body = { username, password }; if (info) body.info = info;
        const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.status === 'success') {
            sucEl.textContent = `注册成功！学号 ${data.data.uid}，即将跳转...`; sucEl.classList.remove('hidden');
            setTimeout(() => switchAuthTab('login'), 1500);
        } else { errEl.textContent = data.message || '注册失败'; errEl.classList.remove('hidden'); }
    } catch { errEl.textContent = '网络错误'; errEl.classList.remove('hidden'); }
}

async function doLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    State.user = null; State.isAdmin = false;
    Router.go('/');
}

// ==========================================
//  Dashboard 数据加载
// ==========================================
let currentUserId = null, currentMode = 'social', myChart = null;
const chartColors =['rgba(180,130,70,.75)', 'rgba(100,160,120,.75)', 'rgba(200,160,80,.75)', 'rgba(160,100,80,.75)', 'rgba(100,140,180,.75)', 'rgba(160,120,180,.75)', 'rgba(80,160,160,.75)'];

async function fetchStats() {
    try {
        const res = await fetch('/social/stats'); const data = await res.json();
        document.getElementById('heroUserCount').textContent = data.total_users.toLocaleString();
        const stats =[
            { label: '注册学生', value: data.total_users, icon: '🎓' },
            { label: '社交连边', value: data.total_follows, icon: '🔗' },
            { label: '平均关注数', value: data.average_follows.toFixed(2), icon: '📊' },
            { label: '最高活跃度', value: data.max_follows, icon: '🔥' },
            { label: '网络密度', value: (data.total_follows / (data.total_users * (data.total_users - 1))).toFixed(4), icon: '🕸️' }
        ];
        document.getElementById('globalStats').innerHTML = stats.map(s => `
            <div class="card-warm p-5 rounded-2xl flex items-center gap-3 hover:shadow-md transition">
                <div class="text-2xl">${s.icon}</div>
                <div><div class="text-xs text-stone-400 mb-0.5">${s.label}</div><div class="text-xl font-bold text-stone-800">${s.value}</div></div>
            </div>`).join('');
    } catch {}
}

async function fetchCommunities() {
    try {
        const res = await fetch('/community'); const data = await res.json();
        const sel = document.getElementById('communitySelect');
        data.communities.forEach(c => { const o = document.createElement('option'); o.value = c; o.innerText = c; sel.appendChild(o); });
    } catch {}
}

function setMode(mode) {
    currentMode = mode;
    const base = 'px-2 py-2 rounded-lg text-xs font-medium transition';
    document.getElementById('mode-social').className = base + (mode === 'social' ? ' tab-active bg-white shadow-sm' : ' text-stone-500');
    document.getElementById('mode-gnn').className = base + (mode === 'gnn' ? ' tab-active bg-white shadow-sm' : ' text-stone-500');
}
function applyFilters() { if (currentUserId) searchUser(currentUserId); }

function parseInfoTags(infoStr, isDark = false) {
    let basic = '', hobbies = '';
    (infoStr || "").split(',').forEach(p => {
        if(!p.includes(':')) return;
        const [key, value] = p.split(':');
        if (!value) return;
        if (key === '爱好' || key === '标签') {
            const cls = isDark ? 'bg-white/15 text-white/80' : 'tag-warm';
            hobbies += value.split(' ').filter(t => t.trim()).map(t => `<span class="px-2 py-0.5 ${cls} rounded-full text-[10px] font-medium">${t}</span>`).join('');
        } else {
            const cls = isDark ? 'bg-white/20 text-white' : 'tag-accent';
            basic += `<span class="px-2.5 py-1 ${cls} rounded-full text-xs font-semibold">${value}</span>`;
        }
    });
    return { basic, hobbies };
}

async function searchUser(explicitId = null) {
    const sid = explicitId || document.getElementById('searchInput').value;
    if (!sid) return;
    currentUserId = sid;
    
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    
    if (!explicitId) { setMode('social'); document.getElementById('communitySelect').value = ''; }
    const comm = document.getElementById('communitySelect').value;
    
    try {
        const [r1, r2, r3, r4] = await Promise.all([
            fetch(`/tuijian?id=${sid}&mode=${currentMode}&community=${comm}`),
            fetch(`/social/report?id=${sid}`),
            fetch(`/following?id=${sid}`),
            fetch(`/followers?id=${sid}`)
        ]);
        if (!r1.ok || !r2.ok) throw new Error('用户不存在');
        const td = await r1.json();
        if (td.error || !td.student_info || td.student_info.includes('ID:')) throw new Error('用户不存在');
        
        const[rd, fd, fod] = await Promise.all([r2.json(), r3.json(), r4.json()]);

        // 保存当次推荐的 ID 列表，给微观星图使用
        State.currentRecIds = td.recommend_ids ||[];

        document.getElementById('displayUserId').innerText = sid;
        const ut = parseInfoTags(td.student_info, true);
        document.getElementById('displayUserInfo').innerHTML = ut.basic + ut.hobbies;

        const rc = document.getElementById('recommendList');
        rc.innerHTML = '';
        if (!td.recommend_friends?.length) {
            rc.innerHTML = `<div class="col-span-2 flex flex-col items-center py-16 text-stone-300"><div class="text-5xl mb-3">🤔</div><p class="text-sm">暂无推荐结果</p></div>`;
        } else {
            td.recommend_friends.forEach((item, i) => {
                // 后端现在返回的是 {id: xxx, info: "xxx"}
                const t = parseInfoTags(item.info);
                rc.innerHTML += `<div class="p-5 rounded-xl border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 transition group cursor-pointer">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex flex-wrap gap-1.5">
                            <span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">ID: ${item.id}</span>
                            ${t.basic}
                        </div>
                        <span class="font-serif text-xl font-bold text-stone-200 group-hover:text-amber-400 transition">#${i+1}</span>
                    </div>
                    <div class="flex flex-wrap gap-1">${t.hobbies}</div>
                </div>`;
            });
        }
        
        renderRelationList('following', fd.following);
        document.getElementById('countFollowing').innerText = fd.count || 0;
        renderRelationList('followers', fod.followers);
        document.getElementById('countFollowers').innerText = fod.followers_count || 0;
        
        renderDiagnostic(rd);
        document.getElementById('resultsArea').classList.remove('hidden');
        showTab('recommended');
    } catch (err) {
        // 在控制台打印真正的错误信息
        console.error("【真实错误原因】:", err);
        document.getElementById('errorState').classList.remove('hidden');
        document.getElementById('errorMessage').innerText = '获取数据异常，请切回 Python 后端终端查看红色报错代码！';
    }
}

function renderRelationList(type, list) {
    const c = document.getElementById(`${type}List`);
    c.innerHTML = '';
    if (!list?.length) { c.innerHTML = '<p class="text-xs text-stone-300 p-2">暂无</p>'; return; }
    list.forEach(item => {
        // 后端现在返回的是 {id: xxx, info: "xxx"}
        const t = parseInfoTags(item.info);
        c.innerHTML += `<div class="p-3 rounded-xl border border-stone-100 text-xs flex items-center gap-2 hover:bg-stone-50 transition">
            <div class="font-bold text-amber-600 shrink-0 w-12">ID: ${item.id}</div>
            <div class="flex gap-1 shrink-0">${t.basic}</div>
            <div class="flex flex-wrap gap-0.5">${t.hobbies}</div>
        </div>`;
    });
}

function renderDiagnostic(data) {
    document.getElementById('diagnosticPanel').classList.remove('hidden');
    document.getElementById('diagTitle').innerText = data.status.title;
    document.getElementById('diagDesc').innerText = data.status.description;
    document.getElementById('diagConnCount').innerText = data.status.total_connections;
    document.getElementById('diagAdvice').innerText = data.advice;
    
    if (myChart) myChart.destroy();
    const ctx = document.getElementById('communityChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: data.distribution.map(d => d.name), datasets:[{ data: data.distribution.map(d => d.count), backgroundColor: chartColors, borderWidth: 2, borderColor: '#faf9f7' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function showTab(name) {
    ['recommended','following','followers'].forEach(t => {
        document.getElementById(`tabContent_${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('tab-active');
    });
    document.getElementById(`tabContent_${name}`).classList.remove('hidden');
    document.getElementById(`tab-${name}`).classList.add('tab-active');
}

document.getElementById('searchInput').addEventListener('keypress', e => { if (e.key === 'Enter') searchUser(); });

// 初始化
async function checkLoginStatus() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.logged_in) {
            State.setUser(data.data);
            Router.go('/dashboard', true);
        }
    } catch {}
}

window.addEventListener('DOMContentLoaded', () => {
    Router.init();
    fetchStats();
    fetchCommunities();
    checkLoginStatus();
});