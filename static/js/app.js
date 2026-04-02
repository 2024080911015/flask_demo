// ==========================================
//  全局状态与权限管理
// ==========================================
const State = {
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
            
            // 权限判断 (manager为管理员)
            this.isAdmin = (u.username === 'manager');
            if (this.isAdmin) {
                document.getElementById('adminBadge')?.classList.remove('hidden');
                document.getElementById('adminPanel')?.classList.remove('hidden');
            } else {
                document.getElementById('adminBadge')?.classList.add('hidden');
                document.getElementById('adminPanel')?.classList.add('hidden');
            }
        }
    }
};

// 同步我的社交状态
async function syncMySocialState() {
    if (!State.user) return;
    try {
        const[r1, r2] = await Promise.all([
            fetch(`/following?id=${State.user.uid}`),
            fetch(`/followers?id=${State.user.uid}`)
        ]);
        const fd = await r1.json();
        const fod = await r2.json();
        State.myFollowingIds = (fd.following ||[]).map(f => parseInt(f.id));
        State.myFollowerIds = (fod.followers ||[]).map(f => parseInt(f.id));
    } catch (e) { console.error("同步关系失败", e); }
}

// ==========================================
//  弹窗 (Modal) 与图谱交互
// ==========================================
window.openGraphModal = function(url) {
    document.getElementById('graphIframe').src = url;
    document.getElementById('graphModal').classList.remove('hidden');
}
window.closeGraphModal = function() {
    document.getElementById('graphModal').classList.add('hidden');
    document.getElementById('graphIframe').src = ''; 
}
window.openPersonalGraph = function() {
    if (!currentUserId) return;
    openGraphModal(`/static/personal_graph.html?uid=${currentUserId}&recs=${State.currentRecIds.join(',')}`);
}

// ==========================================
//  路由与侧边栏菜单切换
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

window.switchMenu = function(menuName) {
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="menu-"]').forEach(el => {
        el.classList.remove('menu-active', 'bg-amber-50', 'text-amber-700');
        el.classList.add('hover:bg-stone-100');
    });
    
    document.getElementById(`panel-${menuName}`).classList.remove('hidden');
    const activeMenu = document.getElementById(`menu-${menuName}`);
    if(activeMenu) {
        activeMenu.classList.remove('hover:bg-stone-100');
        activeMenu.classList.add('menu-active', 'bg-amber-50', 'text-amber-700');
    }

    if (menuName === 'recommend' && State.user) searchUser(State.user.uid);
    if (menuName === 'relations' && State.user) loadRelations();
    if (menuName === 'profile' && State.user) loadProfile();
    if (menuName === 'stats') fetchStats();
};

// ==========================================
//  登录 / 注册 / 登出 (包含新增的注册弹窗逻辑)
// ==========================================
const OPT_GENDERS =["男", "女"];
const OPT_GRADES =["大一","大二","大三","大四","研一","研二","研三","博士"];
const OPT_MAJORS =["计算机","新闻","会计","美术","通信","医学","法学","土木","英语","生物","电气","体育"];
const OPT_HOBBIES =["绘画","编程","动漫","足球","羽毛球","音乐","天文","围棋","缝纫","骑行","剪纸","种植","机械","舞蹈","跑步"];
const OPT_TAGS =["社恐星人", "社交牛逼症", "社交普通型", "熬夜的神", "早睡早起", "作息规律", "高冷", "可爱", "温和", "吃货", "宅属性", "镇圈大佬", "段子手", "技术大牛", "运动达人"];

window.switchAuthTab = function(tab) {
    const isLogin = tab === 'login';
    document.getElementById('authForm-login').classList.toggle('hidden-form', !isLogin);
    document.getElementById('authForm-register').classList.toggle('hidden-form', isLogin);
    document.getElementById('authTab-login').classList.toggle('on', isLogin);
    document.getElementById('authTab-register').classList.toggle('on', !isLogin);
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error'); errEl.classList.add('hidden');
    if (!username || !password) { errEl.textContent = '用户名和密码不能为空'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.status === 'success') { State.setUser(data.data); Router.go('/dashboard'); } 
        else { errEl.textContent = data.message; errEl.classList.remove('hidden'); }
    } catch { errEl.textContent = '网络错误'; errEl.classList.remove('hidden'); }
}

// 渲染前端同学加的选项按钮
function renderOptions(containerId, list, inputName, isMulti = false) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = list.map(item => `
        <label class="cursor-pointer">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="${inputName}" value="${item}" class="hidden peer">
            <span class="px-3 py-1.5 rounded-lg border border-white/20 text-white/60 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 text-xs transition">${item}</span>
        </label>
    `).join('');
}

window.showRegistrationOptions = function() {
    const u = document.getElementById('reg-username').value.trim();
    const p = document.getElementById('reg-password').value;
    const err = document.getElementById('reg-error');
    if(!u || !p) { err.textContent='请先填写用户名和密码'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');

    // 渲染选项
    renderOptions('reg-gender-options', OPT_GENDERS, 'reg_gender');
    renderOptions('reg-grade-options', OPT_GRADES, 'reg_grade');
    renderOptions('reg-major-options', OPT_MAJORS, 'reg_major');
    renderOptions('reg-hobbies-options', OPT_HOBBIES, 'reg_hobbies', true);
    renderOptions('reg-tags-options', OPT_TAGS, 'reg_tags', true);

    document.getElementById('registrationOptionsModal').classList.remove('hidden');
}

window.closeRegistrationOptions = function() {
    document.getElementById('registrationOptionsModal').classList.add('hidden');
}

window.confirmRegistration = async function() {
    const errEl = document.getElementById('reg-options-error');
    const sucEl = document.getElementById('reg-options-success');
    errEl.classList.add('hidden'); sucEl.classList.add('hidden');

    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    
    // 收集选项
    const gender = document.querySelector('input[name="reg_gender"]:checked')?.value || "未知";
    const grade = document.querySelector('input[name="reg_grade"]:checked')?.value || "大一";
    const major = document.querySelector('input[name="reg_major"]:checked')?.value || "计算机";
    
    const hobbiesNodes = document.querySelectorAll('input[name="reg_hobbies"]:checked');
    const tagsNodes = document.querySelectorAll('input[name="reg_tags"]:checked');
    const hobbies = Array.from(hobbiesNodes).map(n => n.value).join(' ') || "无";
    const tags = Array.from(tagsNodes).map(n => n.value).join(' ') || "无标签";

    try {
        const body = { username, password, gender, grade, major, hobbies, tags };
        const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.status === 'success') {
            sucEl.textContent = `注册成功！学号 ${data.data.uid}，即将跳转登录...`; 
            sucEl.classList.remove('hidden');
            setTimeout(() => {
                closeRegistrationOptions();
                switchAuthTab('login');
                document.getElementById('login-username').value = username;
            }, 1500);
        } else { errEl.textContent = data.message; errEl.classList.remove('hidden'); }
    } catch { errEl.textContent = '网络错误'; errEl.classList.remove('hidden'); }
}

window.doLogout = async function() {
    await fetch('/api/auth/logout', { method: 'POST' });
    State.user = null; State.isAdmin = false; Router.go('/');
}

// ==========================================
//  面板 1：推荐交友
// ==========================================
let currentUserId = null, currentMode = 'social', myChart = null;
const chartColors =['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

async function fetchCommunities() {
    try {
        const res = await fetch('/community'); const data = await res.json();
        const sel = document.getElementById('communitySelect');
        data.communities.forEach(c => { const o = document.createElement('option'); o.value = c; o.innerText = c; sel.appendChild(o); });
    } catch {}
}

window.setMode = function(mode) {
    currentMode = mode;
    const base = 'px-2 py-2 rounded-lg text-xs font-medium transition';
    document.getElementById('mode-social').className = base + (mode === 'social' ? ' tab-active bg-white shadow-sm' : ' text-stone-500');
    document.getElementById('mode-gnn').className = base + (mode === 'gnn' ? ' tab-active bg-white shadow-sm' : ' text-stone-500');
}

window.applyFilters = function() { if (currentUserId) searchUser(currentUserId); }

function parseInfoTags(infoStr, isDark = false) {
    let basic = '', hobbies = '';
    (infoStr || "").split(',').forEach(p => {
        if(!p.includes(':')) return;
        const[key, value] = p.split(':');
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

async function searchUser(explicitId) {
    if (!explicitId) return;
    currentUserId = explicitId;
    
    document.getElementById('emptyState')?.classList.add('hidden');
    document.getElementById('errorState')?.classList.add('hidden');
    
    const comm = document.getElementById('communitySelect').value;
    
    try {
        const [r1, r2] = await Promise.all([
            fetch(`/tuijian?id=${explicitId}&mode=${currentMode}&community=${comm}`),
            fetch(`/social/report?id=${explicitId}`)
        ]);
        if (!r1.ok || !r2.ok) throw new Error('用户不存在');
        const td = await r1.json();
        const rd = await r2.json();

        State.currentRecIds = td.recommend_ids ||[];

        document.getElementById('displayUserId').innerText = explicitId;
        // 如果是本人，显示本人的名字，否则显示"Ta的主页"
        const isSelf = (State.user && explicitId == State.user.uid);
        document.getElementById('displayUsername').innerText = isSelf ? State.user.username : `User`;
        document.getElementById('displayAvatarInitial').innerText = isSelf ? State.user.username.charAt(0).toUpperCase() : `U`;

        const ut = parseInfoTags(td.student_info, true);
        document.getElementById('displayUserInfo').innerHTML = ut.basic + ut.hobbies;

        const rc = document.getElementById('recommendList');
        rc.innerHTML = '';
        if (!td.recommend_friends?.length) {
            rc.innerHTML = `<div class="col-span-2 flex flex-col items-center py-8 text-stone-300"><p class="text-sm">暂无推荐结果</p></div>`;
        } else {
        td.recommend_friends.forEach((item, i) => {
                const t = parseInfoTags(item.info);
                // 核心修复：加入 flex-1，让这 5 个卡片自动把父容器的高度均匀撑满！
                rc.innerHTML += `
                <div class="flex-1 p-4 rounded-xl border border-stone-100 hover:border-amber-200 bg-white shadow-sm flex items-center justify-between transition group">
                    <div class="flex items-center gap-4 cursor-pointer hover:opacity-80 w-full" onclick="openUserModal(${item.id})">
                        <span class="font-serif text-xl font-bold text-stone-200 group-hover:text-amber-400 transition w-6 text-center">#${i+1}</span>
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 shadow-inner border border-white shrink-0">${(item.username||'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="font-bold text-stone-800 text-sm">${item.username||'User'} <span class="text-stone-400 font-mono text-[10px] font-normal ml-1">#${item.id}</span></div>
                            <div class="flex flex-wrap gap-1 mt-1">${t.basic} ${t.hobbies}</div>
                        </div>
                    </div>
                    <div class="shrink-0 ml-4 relative z-10">
                        ${getFollowButtonHTML(item.id)}
                    </div>
                </div>`;
            });
        }
        
        renderDiagnostic(rd);
    } catch (err) {
        console.error("【真实错误原因】:", err);
        document.getElementById('errorState')?.classList.remove('hidden');
        document.getElementById('errorMessage').innerText = '获取数据异常，请确保后端模型运行正常！';
    }
}

function renderDiagnostic(data) {
    document.getElementById('diagnosticPanel').classList.remove('hidden');
    document.getElementById('diagTitle').innerText = data.status.title;
    document.getElementById('diagDesc').innerText = data.status.description;
    document.getElementById('diagAdvice').innerText = data.advice;
    
    if (myChart) myChart.destroy();
    const ctx = document.getElementById('communityChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: data.distribution.map(d => d.name), datasets:[{ data: data.distribution.map(d => d.count), backgroundColor: chartColors, borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

// ==========================================
//  面板 2：关系管理 (所有好友 + 批量成员分配)
// ==========================================
let globalGroups =[];
let globalMappings = {};
let globalFollowing = [];

async function loadRelations() {
    try {
        const[gRes, fRes, foRes] = await Promise.all([fetch('/api/groups'), fetch(`/following?id=${State.user.uid}`), fetch(`/followers?id=${State.user.uid}`)]);
        const gData = await gRes.json(); const fData = await fRes.json(); const foData = await foRes.json();

        globalGroups = gData.groups ||[]; 
        globalMappings = gData.mappings || {};
        globalFollowing = fData.following ||[];
        
        const container = document.getElementById('followingGroupsContainer');
        container.innerHTML = '';
        
        const groupedFriends = { 0: [] }; 
        globalGroups.forEach(g => groupedFriends[g.id] =[]);
        
        globalFollowing.forEach(f => {
            // 🚀 核心逻辑 1：所有人无条件进入 0 号池子（所有关注）
            groupedFriends[0].push(f);
            
            // 🚀 核心逻辑 2：如果他被分到了某个自定义组，同时把他放进那个组
            const gid = globalMappings[f.id] || 0;
            if (gid !== 0 && groupedFriends[gid]) {
                groupedFriends[gid].push(f);
            }
        });

        // 渲染【所有关注】(不可管理成员，只做展示全集)
        container.innerHTML += renderAccordionGroup(0, "所有关注", groupedFriends[0], false);
        
        // 渲染【自定义分组】(带 👥 管理成员 按钮)
        globalGroups.forEach(g => {
            container.innerHTML += renderAccordionGroup(g.id, g.name, groupedFriends[g.id], true);
        });

        // 渲染粉丝列表 (加入头像、用户名，并支持点击弹出名片)
        const fc = document.getElementById('followersList');
        fc.innerHTML = '';
        (foData.followers ||[]).forEach(item => {
            const t = parseInfoTags(item.info);
            // 核心修复：高度统一的横向条带 UI
            fc.innerHTML += `
            <div class="p-3 rounded-xl border border-stone-100 text-xs flex items-center justify-between hover:bg-stone-50 transition bg-white mb-2">
                <div class="flex items-center gap-3 cursor-pointer hover:opacity-70 transition w-full" onclick="openUserModal(${item.id})">
                    <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 shrink-0 border border-blue-100">${(item.username || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="font-bold text-stone-800 text-sm mb-0.5">${item.username || 'User'} <span class="font-mono text-stone-400 text-[10px] ml-1">#${item.id}</span></div>
                        <div class="flex flex-wrap gap-1">${t.basic}</div>
                    </div>
                </div>
                <div class="shrink-0 ml-4">
                    ${getFollowButtonHTML(item.id)}
                </div>
            </div>`;
        });

        document.getElementById('countFollowing').innerText = fData.count || 0;
        document.getElementById('countFollowers').innerText = foData.followers_count || 0;
    } catch(e) { console.error("加载关系失败", e); }
}

function renderAccordionGroup(groupId, groupName, friends, canManage) {
    // 【核心修复】：直接把改名、删除、分配并排放在面板标题右侧！
    const manageBtn = canManage 
        ? `<div class="flex gap-2 items-center">
             <button onclick="renameGroup(${groupId}, '${groupName}', event)" class="text-xs bg-blue-50 border border-blue-100 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition shadow-sm">改名</button>
             <button onclick="deleteGroup(${groupId}, event)" class="text-xs bg-red-50 border border-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition shadow-sm">删除</button>
             <button onclick="openMemberManager(event, ${groupId}, '${groupName}')" class="text-xs bg-white border border-stone-200 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition shadow-sm">👥 分配</button>
           </div>` 
        : '';

    let html = `
    <details class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden group" ${groupId===0 ? 'open' : ''}>
        <summary class="px-5 py-4 font-bold text-stone-700 cursor-pointer flex justify-between items-center outline-none bg-stone-50 hover:bg-stone-100 transition">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-stone-400 arrow-icon transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                <span>${groupName} <span class="text-stone-400 font-normal text-sm ml-1">(${friends.length})</span></span>
            </div>
            ${manageBtn}
        </summary>
        <div class="p-2 space-y-1 bg-white">`;
        
    if(friends.length === 0) html += `<p class="text-xs text-stone-400 text-center py-4">暂无成员</p>`;
    
    friends.forEach(f => {
        const t = parseInfoTags(f.info);
        // 【核心修复】：展示 Username，点击触发 openUserModal
        html += `
        <div class="p-3 rounded-lg border border-transparent hover:bg-stone-50 text-xs flex items-center justify-between transition">
            <div class="flex items-center gap-3 cursor-pointer hover:opacity-70 transition w-full" onclick="openUserModal(${f.id})">
                <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 shrink-0 text-sm border border-amber-200">${(f.username || 'U').charAt(0).toUpperCase()}</div>
                <div>
                    <div class="font-bold text-stone-800 text-sm mb-0.5">${f.username || 'User'} <span class="font-mono text-stone-400 text-[10px] ml-1">#${f.id}</span></div>
                    <div class="flex flex-wrap gap-1">${t.basic}</div>
                </div>
            </div>
            <div class="shrink-0 ml-4">${getFollowButtonHTML(f.id)}</div>
        </div>`;
    });
    html += `</div></details>`;
    return html;
}


// === 弹窗 1：分组管理大厅 (增删改) ===
window.openGroupManager = function() {
    const list = document.getElementById('groupManagerList');
    list.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-stone-50 rounded-xl border border-stone-200 mb-3 shadow-sm">
            <div class="flex items-center gap-2"><span class="text-xl">📁</span><span class="text-sm font-bold text-stone-500">所有关注 (默认)</span></div>
            <span class="text-[10px] bg-stone-200 text-stone-500 px-2 py-1 rounded font-bold">不可修改</span>
        </div>`;
    
    globalGroups.forEach(g => {
        // 🚨 极其显眼的删除按钮在这里！
        list.innerHTML += `
        <div class="flex justify-between items-center p-4 bg-white rounded-xl border border-stone-200 mb-3 shadow-sm hover:border-amber-300 transition">
            <div class="flex items-center gap-2"><span class="text-xl">📂</span><span class="text-sm font-bold text-stone-700">${g.name}</span></div>
            <div class="flex gap-2">
                <button onclick="renameGroup(${g.id}, '${g.name}')" class="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition">改名</button>
                <button onclick="deleteGroup(${g.id})" class="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition shadow-sm">删除</button>
            </div>
        </div>`;
    });
    document.getElementById('groupManagerModal').classList.remove('hidden');
}
window.closeGroupManager = function() { document.getElementById('groupManagerModal').classList.add('hidden'); }

window.createNewGroup = async function() {
    const name = document.getElementById('newGroupName').value.trim();
    if(!name) return alert("组名不能为空");
    await fetch('/api/groups/create', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name})});
    document.getElementById('newGroupName').value = ''; 
    await loadRelations(); openGroupManager(); 
}
window.renameGroup = async function(id, oldName, event) {
    if(event) event.stopPropagation(); // 阻止手风琴折叠
    const newName = prompt("请输入新的分组名称:", oldName);
    if(!newName || newName === oldName) return;
    await fetch('/api/groups/rename', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({group_id: id, name: newName})});
    await loadRelations(); 
}
window.deleteGroup = async function(id, event) {
    if(event) event.stopPropagation(); // 阻止手风琴折叠
    if(!confirm("⚠️ 确定要删除这个分组吗？\n删除后，该组的好友将自动回到【默认关注】中，且无法恢复。")) return;
    await fetch('/api/groups/delete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({group_id: id})});
    await loadRelations(); 
}

// === 弹窗 2：批量分配成员 (企业级宽屏带搜索版) ===
window.openMemberManager = function(event, groupId, groupName) {
    if(event) event.preventDefault(); 
    document.getElementById('mm-group-name').innerText = groupName;
    document.getElementById('mm-group-id').value = groupId;
    
    // 清空上次的搜索记录
    const searchInput = document.getElementById('mm-search-input');
    if (searchInput) searchInput.value = '';
    
    const listContainer = document.getElementById('mm-friend-list');
    listContainer.innerHTML = '';
    
    if (globalFollowing.length === 0) {
        listContainer.innerHTML = '<div class="col-span-full text-sm text-stone-400 text-center py-10">你还没有关注任何人，先去发现新朋友吧！</div>';
    } else {
        globalFollowing.forEach(f => {
            const currentGid = globalMappings[f.id] || 0;
            const isChecked = (currentGid === groupId); 
            const t = parseInfoTags(f.info);
            
            // 🚀 核心升级：为每张卡片注入 data-name 和 data-id，用于极速搜索过滤
            // 采用 Flex 布局的精美大卡片
            listContainer.innerHTML += `
            <label class="mm-member-item flex items-center gap-4 p-4 bg-white hover:bg-amber-50/40 rounded-2xl cursor-pointer border border-stone-200 hover:border-amber-300 transition shadow-sm" data-name="${(f.username || 'User').toLowerCase()}" data-id="${f.id}">
                <!-- 圆形橙色打钩框 -->
                <input type="checkbox" value="${f.id}" class="group-member-cb w-5 h-5 text-amber-500 rounded border-stone-300 focus:ring-amber-500 cursor-pointer shrink-0" ${isChecked ? 'checked' : ''}>
                
                <!-- 渐变底色头像 -->
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center font-bold text-stone-600 shrink-0 text-lg border border-white shadow-inner">
                    ${(f.username || 'U').charAt(0).toUpperCase()}
                </div>
                
                <!-- 名字与标签 (截断防溢出) -->
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-stone-800 truncate mb-1">
                        ${f.username || 'User'} 
                        <span class="font-mono text-stone-400 text-[10px] ml-1 font-normal">#${f.id}</span>
                    </div>
                    <div class="flex gap-1 scale-[0.85] origin-left whitespace-nowrap overflow-hidden text-ellipsis">${t.basic}</div>
                </div>
            </label>`;
        });
    }
    document.getElementById('memberManagerModal').classList.remove('hidden');
}

// 弹窗内的实时搜索引擎
window.filterGroupMembers = function() {
    const keyword = document.getElementById('mm-search-input').value.toLowerCase().trim();
    const items = document.querySelectorAll('.mm-member-item');
    
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        const id = item.getAttribute('data-id');
        // 只要名字或学号包含关键词，就显示，否则隐藏
        if (name.includes(keyword) || id.includes(keyword)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}
window.closeMemberManager = function() { document.getElementById('memberManagerModal').classList.add('hidden'); }

window.saveGroupMembers = async function() {
    const groupId = parseInt(document.getElementById('mm-group-id').value);
    const checkboxes = document.querySelectorAll('.group-member-cb');
    const btn = document.getElementById('btn-save-members');
    btn.innerText = "保存中..."; btn.disabled = true;

    const requests =[];
    checkboxes.forEach(cb => {
        const targetId = parseInt(cb.value);
        const currentGid = globalMappings[targetId] || 0;
        const shouldBeInGroup = cb.checked;
        
        if (shouldBeInGroup && currentGid !== groupId) {
            requests.push(fetch('/api/groups/assign', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({target_id: targetId, group_id: groupId})}));
        } else if (!shouldBeInGroup && currentGid === groupId) {
            requests.push(fetch('/api/groups/assign', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({target_id: targetId, group_id: 0})}));
        }
    });

    await Promise.all(requests);
    btn.innerText = "保存修改"; btn.disabled = false;
    closeMemberManager();
    loadRelations(); 
}

// ==========================================
//  面板 3：个人空间
// ==========================================
function renderProfileOptions(containerId, list, inputName, isMulti, selectedVals) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = list.map(item => `
        <label class="cursor-pointer">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="${inputName}" value="${item}" ${selectedVals.includes(item) ? 'checked' : ''} class="hidden peer">
            <span class="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 text-xs font-semibold transition inline-block mb-2 mr-2">${item}</span>
        </label>
    `).join('');
}

async function loadProfile() {
    try {
        const res = await fetch(`/user?id=${State.user.uid}`);
        const data = await res.json();
        document.getElementById('profileUid').innerText = State.user.uid;
        document.getElementById('prof-username').value = State.user.username;
        document.getElementById('profileAvatar').innerText = State.user.username.charAt(0).toUpperCase();
        document.getElementById('prof-display-name').innerText = State.user.username;
        
        const infoMap = {};
        (data.student_info || "").split(',').forEach(p => {
            const[k, v] = p.split(':');
            if(k && v) infoMap[k] = v;
        });
        
        document.getElementById('prof-gender').value = infoMap['性别'] || '男';
        
        // 动态生成年级和专业选项
        document.getElementById('prof-grade').innerHTML = OPT_GRADES.map(g => `<option value="${g}" ${infoMap['年级']===g?'selected':''}>${g}</option>`).join('');
        document.getElementById('prof-major').innerHTML = OPT_MAJORS.map(m => `<option value="${m}" ${infoMap['专业']===m?'selected':''}>${m}</option>`).join('');
        
        // 动态渲染爱好和标签的点击按钮
        const myHobbies = (infoMap['爱好'] || "").split(' ');
        const myTags = (infoMap['标签'] || "").split(' ');
        
        renderProfileOptions('prof-hobbies-container', OPT_HOBBIES, 'prof_hobbies', true, myHobbies);
        renderProfileOptions('prof-tags-container', OPT_TAGS, 'prof_tags', true, myTags);
        
    } catch(e) {}
}

window.saveProfile = async function() {
    const username = document.getElementById('prof-username').value.trim();
    const gender = document.getElementById('prof-gender').value;
    const grade = document.getElementById('prof-grade').value;
    const major = document.getElementById('prof-major').value;
    
    const hobbiesNodes = document.querySelectorAll('input[name="prof_hobbies"]:checked');
    const tagsNodes = document.querySelectorAll('input[name="prof_tags"]:checked');
    const hobbies = Array.from(hobbiesNodes).map(n => n.value).join(' ') || "无";
    const tags = Array.from(tagsNodes).map(n => n.value).join(' ') || "无标签";
    
    const info = `性别:${gender},年级:${grade},专业:${major},爱好:${hobbies},标签:${tags}`;
    
    try {
        const res = await fetch('/api/user/update', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, info })
        });
        const data = await res.json();
        alert(data.message);
        if(data.status === 'success') {
            State.user.username = username;
            document.getElementById('dashUsername').textContent = username;
            document.getElementById('profileAvatar').innerText = username.charAt(0).toUpperCase();
            document.getElementById('avatarInitial').innerText = username.charAt(0).toUpperCase();
            document.getElementById('prof-display-name').innerText = username;
        }
    } catch(e) { alert('保存失败'); }
}


// ==========================================
//  面板 4：找朋友 (模糊搜索 + 列表展示)
// ==========================================
window.searchOtherUser = async function(explicitQuery = null) {
    // 1. 获取搜索词 (支持从外部传，或从输入框读)
    const query = explicitQuery || document.getElementById('globalSearchInput').value.trim();
    if(!query) return;

    // 2. 切换到找朋友面板，并填入搜索词
    switchMenu('search');
    document.getElementById('globalSearchInput').value = query;
    
    const resultArea = document.getElementById('searchResultListArea');
    const grid = document.getElementById('searchResultGrid');
    const countSpan = document.getElementById('searchResultCount');
    
    // 3. 展现 Loading 状态
    resultArea.classList.remove('hidden');
    grid.innerHTML = '<div class="col-span-full text-center py-16 text-stone-400 font-bold text-lg animate-pulse">⏳ 正在全校数据库中穿梭检索...</div>';
    countSpan.innerText = '';
    
    try {
        // 4. 调用后端的模糊搜索新接口
        const res = await fetch(`/api/search_users?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.status !== 'success' || !data.results) throw new Error();
        
        const results = data.results;
        countSpan.innerText = `(为您找到 ${results.length} 名匹配同学)`;
        
        // 5. 查无此人
        if (results.length === 0) {
            grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-16 text-stone-300">
                <div class="text-6xl mb-4">👻</div>
                <p class="text-base font-bold text-stone-500">茫茫人海，查无此人</p>
                <p class="text-xs mt-1">请尝试换个关键词，或者检查学号拼写</p>
            </div>`;
            return;
        }
        
        // 6. 渲染搜索结果列表卡片
        grid.innerHTML = '';
        results.forEach(item => {
            const t = parseInfoTags(item.info);
            grid.innerHTML += `
            <div class="p-5 rounded-2xl border border-stone-100 hover:border-amber-300 hover:bg-amber-50/40 transition group flex flex-col justify-between h-full bg-white shadow-sm cursor-pointer transform hover:-translate-y-1" onclick="openUserModal(${item.id})">
                <div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center font-bold text-blue-600 text-xl shadow-inner border border-white shrink-0">
                            ${(item.username||'U').charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-stone-800 text-lg truncate">${item.username||'User'}</div>
                            <div class="font-mono text-stone-400 text-xs mt-0.5">ID: #${item.id}</div>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-1">${t.basic}</div>
                    <div class="flex flex-wrap gap-1 mt-2">${t.hobbies}</div>
                </div>
            </div>`;
        });
        
    } catch(err) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-red-400 font-bold">❌ 检索失败，请检查网络或后端 Python 服务是否报错</div>`;
    }
}

// 防呆：输入框回车立刻搜索
const globalSearchInput = document.getElementById('globalSearchInput');
if(globalSearchInput) {
    globalSearchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchOtherUser(); });
}

// ==========================================
//  面板 5：全校大盘
// ==========================================
async function fetchStats() {
    try {
        const res = await fetch('/social/stats'); 
        const data = await res.json();
        
        // 防呆：加上可选链，防止在后台页面找不到首页的元素而报错
        const heroCount = document.getElementById('heroUserCount');
        if(heroCount) heroCount.textContent = data.total_users.toLocaleString();
        
        const stats =[
            { label: '注册学生', value: data.total_users, icon: '🎓' },
            { label: '社交连边', value: data.total_follows, icon: '🔗' },
            { label: '平均关注数', value: data.average_follows.toFixed(2), icon: '📊' },
            { label: '最高活跃度', value: data.max_follows, icon: '🔥' },
            { label: '网络密度', value: (data.total_follows / (data.total_users * (data.total_users - 1))).toFixed(4), icon: '🕸️' }
        ];
        
        const container = document.getElementById('globalStatsContainer');
        if(container) {
            container.innerHTML = stats.map(s => `
                <div class="card-warm p-5 rounded-2xl flex items-center gap-3 shadow-sm border border-stone-100 bg-white">
                    <div class="text-3xl">${s.icon}</div>
                    <div><div class="text-xs text-stone-400 mb-0.5 font-bold">${s.label}</div><div class="text-2xl font-black text-stone-800">${s.value}</div></div>
                </div>`).join('');
        }

        // 渲染带排名的风云人物
        const popContainer = document.getElementById('popularList');
        if(popContainer && data.most_popular_users) {
            popContainer.innerHTML = '';
            data.most_popular_users.forEach((user, index) => {
                const t = parseInfoTags(user.info);
                let rankBadge = `<span class="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-500">${index+1}</span>`;
                if(index === 0) rankBadge = `<span class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-600 text-lg">🥇</span>`;
                if(index === 1) rankBadge = `<span class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-lg">🥈</span>`;
                if(index === 2) rankBadge = `<span class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-lg">🥉</span>`;
                
                popContainer.innerHTML += `
                <div class="p-4 rounded-xl border border-stone-100 flex items-center justify-between hover:bg-stone-50 transition bg-white cursor-pointer" onclick="openUserModal(${user.id})">
                    <div class="flex items-center gap-4">
                        ${rankBadge}
                        <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 text-lg shrink-0 border border-blue-100">${(user.username || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="font-bold text-stone-800 text-sm mb-1">${user.username || 'User'} <span class="text-stone-400 font-mono text-[10px] ml-1">#${user.id}</span> <span class="ml-2 px-2 py-0.5 bg-red-50 text-red-500 text-[10px] rounded-md font-bold">粉丝: ${user.followers_count}</span></div>
                            <div class="flex flex-wrap gap-1">${t.basic}</div>
                        </div>
                    </div>
                </div>`;
            });
        }
    } catch(e) { console.error(e); }
}

// ==========================================
//  底层互动功能：关注 / 取关按钮
// ==========================================
window.getFollowButtonHTML = function(targetId) {
    if (!State.user || targetId == State.user.uid) return ''; 
    
    const tid = parseInt(targetId); 
    const isFollowing = State.myFollowingIds.includes(tid);
    const isFollower = State.myFollowerIds.includes(tid);
    
    if (isFollowing) {
        return `<button onclick="toggleFollow(this, ${tid})" data-status="unfollow" class="px-4 py-2 bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 rounded-xl text-xs font-bold transition border border-stone-200">取消关注</button>`;
    } else if (isFollower) {
        return `<button onclick="toggleFollow(this, ${tid})" data-status="follow" class="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-xs font-bold transition border border-amber-200">回关</button>`;
    } else {
        return `<button onclick="toggleFollow(this, ${tid})" data-status="follow" class="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition border border-blue-100">+ 关注</button>`;
    }
}

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
            if (action === 'follow') {
                State.myFollowingIds.push(targetId);
            } else {
                State.myFollowingIds = State.myFollowingIds.filter(id => id !== targetId);
            }
            // 重新渲染按钮形态
            btn.outerHTML = getFollowButtonHTML(targetId);
        } else { alert("操作失败：" + data.message); btn.innerHTML = originalHtml; }
    } catch (e) { alert("网络异常"); btn.innerHTML = originalHtml; }
    btn.disabled = false;
}

window.doAdminRetrain = async function() {
    if (!confirm("⚙️ 确认执行手动重训吗？\n\n系统将重新计算特征，训练 GCN 模型，并更新 3D 星系图。\n（约需 10-30 秒）")) return;
    
    const btn = document.getElementById('btn-admin-retrain');
    const originalText = btn.innerText;
    btn.innerText = "⏳ 正在重构特征与训练模型...";
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/admin/retrain', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') { alert("🎉 " + data.message); location.reload(); } 
        else { alert("❌ 失败：" + data.message); }
    } catch (err) { alert("❌ 请求异常"); } 
    finally { btn.innerText = originalText; btn.disabled = false; }
}

// ==========================================
//  初始化入口
// ==========================================
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

// ==========================================
//  全局名片模态框 (User Profile Modal)
// ==========================================
window.openUserModal = async function(explicitId) {
    const sid = explicitId || document.getElementById('globalSearchInput').value.trim();
    if(!sid) return;
    
    document.getElementById('userProfileModal').classList.remove('hidden');
    document.getElementById('modalUsername').innerText = "Loading...";
    document.getElementById('modalUid').innerText = sid;
    
    // 🛡️ 核心修复：清空旧数据时，使用全新的两个 ID！不再报错了！
    document.getElementById('modalBasicInfo').innerHTML = '';
    document.getElementById('modalHobbiesInfo').innerHTML = '';
    
    document.getElementById('modalConnCount').innerText = '-';
    document.getElementById('modalDominantComm').innerText = '-';
    document.getElementById('modalFollowBtnContainer').innerHTML = '';
    
    try {
        const[r1, r2] = await Promise.all([fetch(`/user?id=${sid}`), fetch(`/social/report?id=${sid}`)]);
        if(!r1.ok) throw new Error();
        const uData = await r1.json();
        const rData = await r2.json();
        
        document.getElementById('modalUsername').innerText = uData.username || 'User';
        document.getElementById('modalAvatar').innerText = (uData.username || 'U').charAt(0).toUpperCase();
        
        const t = parseInfoTags(uData.student_info);
        // 分离注入蓝色基础标签和黄色专属标签
        document.getElementById('modalBasicInfo').innerHTML = t.basic;
        document.getElementById('modalHobbiesInfo').innerHTML = t.hobbies;
        
        document.getElementById('modalConnCount').innerText = rData.status.total_connections;
        document.getElementById('modalDominantComm').innerText = rData.distribution.length > 0 ? rData.distribution[0].name : "暂无";
        
        document.getElementById('modalFollowBtnContainer').innerHTML = getFollowButtonHTML(sid);
    } catch(e) {
        document.getElementById('modalUsername').innerText = "用户不存在";
        document.getElementById('modalFollowBtnContainer').innerHTML = '';
    }
}

window.closeUserModal = function() {
    document.getElementById('userProfileModal').classList.add('hidden');
}

