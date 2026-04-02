// ==========================================
//  全局状态与权限管理
// ==========================================
const State = {
    user: null,
    isAdmin: false, // 权限标识
    currentRecIds:[], // 暂存当前推荐列表的 ID，传给专属星图用
    myFollowingIds:[], // 新增：我的关注列表
    myFollowerIds:[],  // 新增：我的粉丝列表
    // 注册选项配置
    selectedOptions: {
        gender: null,
        grade: null,
        major: null,
        hobbies: new Set(),
        tags: new Set()
    },

    setUser(u) {
        this.user = u;
        if (u) {
            document.getElementById('dashUsername').textContent = u.username;
            document.getElementById('dashUid').textContent = u.uid;
            document.getElementById('avatarInitial').textContent = u.username.charAt(0).toUpperCase();

            // 【权限控制】：用户名为manager且id为0
            this.isAdmin = (u.uid === 0 && u.username === 'manager');

            if (this.isAdmin) {
                document.getElementById('searchContainer').classList.remove('hidden');
                document.getElementById('adminBadge').classList.remove('hidden');
                document.getElementById('adminPanel').classList.remove('hidden'); // 显示控制台
            } else {
                document.getElementById('searchContainer').classList.add('hidden');
                document.getElementById('adminBadge').classList.add('hidden');
                document.getElementById('adminPanel').classList.add('hidden'); // 隐藏控制台
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

function showRegistrationOptions() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.classList.add('hidden');
    
    if (!username || !password) { 
        errEl.textContent = '用户名和密码不能为空'; 
        errEl.classList.remove('hidden'); 
        return; 
    }
    
    document.getElementById('registrationOptionsModal').classList.remove('hidden');
}

function closeRegistrationOptions() {
    document.getElementById('registrationOptionsModal').classList.add('hidden');
}

function confirmRegistration() {
    doRegister();
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
    const errEl = document.getElementById('reg-options-error');
    const sucEl = document.getElementById('reg-options-success');
    errEl.classList.add('hidden'); sucEl.classList.add('hidden');

    if (!username || !password) { errEl.textContent = '用户名和密码不能为空'; errEl.classList.remove('hidden'); return; }

    // 收集选择的属性
    const options = State.selectedOptions;
    if (!options.gender || !options.grade || !options.major) {
        errEl.textContent = '请选择性别、年级和专业'; errEl.classList.remove('hidden'); return;
    }

    try {
        const body = {
            username,
            password,
            gender: options.gender,
            grade: options.grade,
            major: options.major,
            hobbies: Array.from(options.hobbies).join(' ') || '无',
            tags: Array.from(options.tags).join(' ') || '萌新'
        };

        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status === 'success') {
            sucEl.textContent = `注册成功！学号 ${data.data.uid}，即将跳转...`; sucEl.classList.remove('hidden');
            setTimeout(() => {
                closeRegistrationOptions();
                switchAuthTab('login');
                resetRegistrationOptions(); // 重置选项
            }, 1500);
        } else { errEl.textContent = data.message || '注册失败'; errEl.classList.remove('hidden'); }
    } catch { errEl.textContent = '网络错误'; errEl.classList.remove('hidden'); }
}

// 重置注册选项
function resetRegistrationOptions() {
    State.selectedOptions.gender = null;
    State.selectedOptions.grade = null;
    State.selectedOptions.major = null;
    State.selectedOptions.hobbies.clear();
    State.selectedOptions.tags.clear();
    renderRegistrationOptions();
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

        // 【新增逻辑】如果是看自己的主页，更新自己的社交关系状态
        if (State.user && sid == State.user.uid) {
            State.myFollowingIds = fd.following.map(f => parseInt(f.id));
            State.myFollowerIds = fod.followers.map(f => parseInt(f.id));
        }

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
                        <div class="flex flex-wrap gap-1.5 items-center">
                            <span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">ID: ${item.id}</span>
                            ${t.basic}
                        </div>
                        <div class="flex items-center gap-3">
                            ${getFollowButtonHTML(item.id)} <!-- 新增按钮 -->
                            <span class="font-serif text-xl font-bold text-stone-200 group-hover:text-amber-400 transition">#${i+1}</span>
                        </div>
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
        c.innerHTML += `<div class="p-3 rounded-xl border border-stone-100 text-xs flex items-center justify-between hover:bg-stone-50 transition">
            <div class="flex items-center gap-2">
                <div class="font-bold text-amber-600 shrink-0 w-12">ID: ${item.id}</div>
                <div class="flex gap-1 shrink-0">${t.basic}</div>
                <div class="flex flex-wrap gap-0.5">${t.hobbies}</div>
            </div>
            ${getFollowButtonHTML(item.id)} <!-- 新增按钮 -->
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
    renderRegistrationOptions();
});

// ==========================================
//  注册选项配置和渲染
// ==========================================
const REGISTRATION_OPTIONS = {
    gender: ['男', '女'],
    grade: ['大一', '大二', '大三', '大四', '研一', '研二', '研三', '博士'],
    major: ['计算机', '通信', '电气', '土木', '体育', '英语', '法学', '生物', '会计', '新闻', '美术'],
    hobbies: ['足球', '羽毛球', '跑步', '骑行', '音乐', '舞蹈', '绘画', '剪纸', '缝纫', '种植', '围棋', '天文', '编程', '机械', '动漫'],
    tags: ['运动达人', '温和', '可爱', '技术大牛', '宅属性', '社恐星人', '社交牛逼症', '镇圈大佬', '段子手', '早睡早起', '作息规律', '吃货', '社交普通型', '熬夜的神', '高冷', '萌新']
};

function renderRegistrationOptions() {
    // 渲染性别选项（单选）
    const genderContainer = document.getElementById('reg-gender-options');
    genderContainer.innerHTML = REGISTRATION_OPTIONS.gender.map(g =>
        `<button onclick="selectOption('gender', '${g}')" id="reg-gender-${g}"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border ${State.selectedOptions.gender === g ? 'bg-amber-500/30 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20'}">
            ${g}</button>`
    ).join('');

    // 渲染年级选项（单选）
    const gradeContainer = document.getElementById('reg-grade-options');
    gradeContainer.innerHTML = REGISTRATION_OPTIONS.grade.map(g =>
        `<button onclick="selectOption('grade', '${g}')" id="reg-grade-${g}"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border ${State.selectedOptions.grade === g ? 'bg-amber-500/30 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20'}">
            ${g}</button>`
    ).join('');

    // 渲染专业选项（单选）
    const majorContainer = document.getElementById('reg-major-options');
    majorContainer.innerHTML = REGISTRATION_OPTIONS.major.map(m =>
        `<button onclick="selectOption('major', '${m}')" id="reg-major-${m}"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border ${State.selectedOptions.major === m ? 'bg-amber-500/30 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20'}">
            ${m}</button>`
    ).join('');

    // 渲染爱好选项（多选）
    const hobbiesContainer = document.getElementById('reg-hobbies-options');
    hobbiesContainer.innerHTML = REGISTRATION_OPTIONS.hobbies.map(h =>
        `<button onclick="toggleMultiOption('hobbies', '${h}')" id="reg-hobbies-${h}"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border ${State.selectedOptions.hobbies.has(h) ? 'bg-amber-500/30 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20'}">
            ${h}</button>`
    ).join('');

    // 渲染标签选项（多选）
    const tagsContainer = document.getElementById('reg-tags-options');
    tagsContainer.innerHTML = REGISTRATION_OPTIONS.tags.map(t =>
        `<button onclick="toggleMultiOption('tags', '${t}')" id="reg-tags-${t}"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border ${State.selectedOptions.tags.has(t) ? 'bg-amber-500/30 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20'}">
            ${t}</button>`
    ).join('');
}

// 单选选项处理
function selectOption(type, value) {
    State.selectedOptions[type] = value;
    renderRegistrationOptions();
}

// 多选选项处理
function toggleMultiOption(type, value) {
    if (State.selectedOptions[type].has(value)) {
        State.selectedOptions[type].delete(value);
    } else {
        State.selectedOptions[type].add(value);
    }
    renderRegistrationOptions();
}
// ==========================================
//  管理员：重置所有数据接口
// ==========================================
async function doAdminRetrain() {
    if (!confirm("⚙️ 确认执行手动重训吗？\n\n系统将读取最新的 users.csv 和 edges_time.csv，重新计算 52 维特征，重新训练 GCN 模型，并更新 3D 星系图。\n（整个过程约需 10-30 秒）")) return;
    
    const btn = document.getElementById('btn-admin-retrain');
    const originalText = btn.innerText;
    btn.innerText = "⏳ 正在重构特征与训练模型...";
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/admin/retrain', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            alert("🎉 " + data.message);
            location.reload(); // 刷新页面，查看全新的网络！
        } else {
            alert("❌ 失败：" + data.message);
        }
    } catch (err) {
        alert("❌ 请求异常，请检查 Python 后端终端报错");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
// ==========================================
//  互动功能：生成关注按钮 HTML
// ==========================================
function getFollowButtonHTML(targetId) {
    if (!State.user || targetId == State.user.uid) return ''; // 未登录或自己不显示按钮
    
    const tid = parseInt(targetId); // 核心修复：强制转为数字
    const isFollowing = State.myFollowingIds.includes(tid);
    const isFollower = State.myFollowerIds.includes(tid);
    
    if (isFollowing) {
        return `<button onclick="toggleFollow(this, ${tid})" data-status="unfollow" class="px-3 py-1.5 bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 rounded-lg text-xs font-medium transition border border-stone-200">取消关注</button>`;
    } else if (isFollower) {
        return `<button onclick="toggleFollow(this, ${tid})" data-status="follow" class="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs font-medium transition border border-amber-200">回关</button>`;
    } else {
        return `<button onclick="toggleFollow(this, ${tid})" data-status="follow" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-medium transition border border-blue-100">关注</button>`;
    }
}

// ==========================================
//  互动功能：点击关注/取关逻辑 (乐观更新)
// ==========================================
async function toggleFollow(btn, targetId) {
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
            // 本地状态更新 (乐观更新 UI)
            if (action === 'follow') {
                State.myFollowingIds.push(targetId);
                btn.setAttribute('data-status', 'unfollow');
                btn.className = "px-3 py-1.5 bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 rounded-lg text-xs font-medium transition border border-stone-200";
                btn.innerText = "取消关注";
            } else {
                State.myFollowingIds = State.myFollowingIds.filter(id => id !== targetId);
                btn.setAttribute('data-status', 'follow');
                if (State.myFollowerIds.includes(targetId)) {
                    btn.className = "px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs font-medium transition border border-amber-200";
                    btn.innerText = "回关";
                } else {
                    btn.className = "px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-medium transition border border-blue-100";
                    btn.innerText = "关注";
                }
            }
        } else { alert("操作失败：" + data.message); btn.innerHTML = originalHtml; }
    } catch (e) { alert("网络异常"); btn.innerHTML = originalHtml; }
    btn.disabled = false;
}