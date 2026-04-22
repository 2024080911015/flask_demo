// ==========================================
//  组队大厅核心逻辑 (全量同步版)
// ==========================================

let currentActId = null;

// 1. Tab 切换
window.switchActivityTab = function(tab) {
    const tabs = ['hall', 'create', 'manage'];
    tabs.forEach(t => {
        document.getElementById(`act-sub-${t}`).classList.add('hidden');
        document.getElementById(`tab-act-${t}`).classList.remove('act-tab-active', 'bg-white', 'shadow-sm', 'text-amber-700');
        document.getElementById(`tab-act-${t}`).classList.add('text-stone-500');
    });

    document.getElementById(`act-sub-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-act-${tab}`);
    activeBtn.classList.add('act-tab-active', 'bg-white', 'shadow-sm', 'text-amber-700');
    activeBtn.classList.remove('text-stone-500');

    if (tab === 'hall') loadActivityHall();
    if (tab === 'create') {
        renderFilterOptions('target-grades', OPT_GRADES, 'target_grade');
        renderFilterOptions('target-majors', OPT_MAJORS, 'target_major');
    }
    if (tab === 'manage') loadManagement();
};

function renderFilterOptions(containerId, list, name) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = list.map(item => `
        <label class="group cursor-pointer">
            <input type="checkbox" name="${name}" value="${item}" class="hidden peer">
            <span class="px-4 py-2 rounded-xl border border-stone-200 text-stone-500 text-xs font-bold peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 transition-all block">${item}</span>
        </label>
    `).join('');
}

// 2. 加载大厅列表
window.loadActivityHall = async function() {
    const container = document.getElementById('act-sub-hall');
    if (!container) return;
    container.innerHTML = `<div class="col-span-full py-20 text-center text-stone-300">正在进行 GNN 认知演算...</div>`;
    
    try {
        const res = await fetch('/api/activity/list');
        const data = await res.json();
        container.innerHTML = '';
        
        if (data.data.length === 0) {
            container.innerHTML = '<div class="col-span-full py-20 text-center text-stone-300 italic">目前暂无正在招募的项目</div>';
            return;
        }

        data.data.forEach(act => {
            const statusLabel = act.my_status === 1 ? '✅ 已入队' : (act.my_status === 0 ? '⏳ 审核中' : '');
            const scoreColor = act.match_score > 80 ? 'text-emerald-500' : (act.match_score > 60 ? 'text-amber-500' : 'text-stone-400');
            
            container.innerHTML += `
            <div class="card-warm rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 flex flex-col group relative overflow-hidden cursor-pointer" onclick="openActivityDetail(${act.id})">
                <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center">
                    <div class="text-center mt-2 mr-2">
                        <div class="text-[8px] font-black text-amber-600 uppercase">Match</div>
                        <div class="text-xl font-black ${scoreColor}">${act.match_score}%</div>
                    </div>
                </div>
                <div class="mb-6"><span class="px-3 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-lg uppercase tracking-tighter shadow-sm">${act.nature}</span></div>
                <h4 class="text-2xl font-serif font-bold text-stone-800 mb-3 group-hover:text-amber-700 transition-colors">${act.title}</h4>
                <p class="text-stone-400 text-sm italic line-clamp-2 mb-6">“${act.description}”</p>
                <div class="mt-auto space-y-4">
                    <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        <span>${act.path_text}</span>
                        <span class="${act.my_status === 1 ? 'text-emerald-500' : 'text-amber-500'}">${statusLabel}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex -space-x-2">
                            <div class="w-8 h-8 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-600">${act.publisher_name.charAt(0)}</div>
                            <div class="w-8 h-8 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-400">+${act.member_count}</div>
                        </div>
                        <div class="text-right"><span class="text-lg font-black text-stone-800">${act.member_count}</span><span class="text-stone-300">/ ${act.total_capacity} 席</span></div>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { container.innerHTML = '加载失败'; }
};

// 3. 打开详情 (支持编辑、审批、理由回显)
window.openActivityDetail = async function(id) {
    currentActId = id;
    
    // 🚀 使用新的管理器打开，解决层级和 undefined 报错
    if (typeof ModalManager !== 'undefined') {
        ModalManager.open('activityDetailModal');
    } else {
        document.getElementById('activityDetailModal').classList.remove('hidden');
    }

    toggleActivityEdit(false); // 强制重置为展示态

    try {
        const res = await fetch('/api/activity/my');
        const data = await res.json();
        const allActs = [...data.launched, ...data.joined];
        let act = allActs.find(a => a.id === id);

        if (!act) {
            const listRes = await fetch('/api/activity/list');
            const listData = await listRes.json();
            act = listData.data.find(a => a.id === id);
        }

        if (act) {
            document.getElementById('det-title').innerText = act.title;
            document.getElementById('det-nature').innerText = act.nature;
            document.getElementById('det-desc').innerText = act.description;
            document.getElementById('det-deadline').innerText = `截止日期：${act.deadline}`;
            document.getElementById('det-count').innerText = `${act.member_count}/${act.total_capacity}`;
            document.getElementById('det-publisher').innerText = act.publisher_name;
            document.getElementById('det-publisher').onclick = () => window.openUserModal(act.publisher_id);

            // 预填充编辑表单
            document.getElementById('edit-title').value = act.title;
            document.getElementById('edit-nature').value = act.nature;
            document.getElementById('edit-desc').value = act.description;
            document.getElementById('edit-capacity').value = act.total_capacity;
            document.getElementById('edit-deadline').value = act.deadline;

            const isOwner = (act.publisher_id == State.user.uid);
            document.getElementById('btn-toggle-edit').classList.toggle('hidden', !isOwner);
            
            const auditSection = document.getElementById('admin-audit-section');
            const applySection = document.getElementById('apply-section');
            const btn = document.getElementById('det-action-btn');
            const msgDisplay = document.getElementById('my-apply-msg-display');
            const msgInput = document.getElementById('apply-msg');

            auditSection.classList.add('hidden');
            applySection.classList.add('hidden');
            msgDisplay.classList.add('hidden');
            msgInput.classList.add('hidden');

            if (isOwner) {
                auditSection.classList.remove('hidden');
                renderAuditList(act.members);
                btn.innerText = "❌ 撤回并删除项目";
                btn.className = "flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-bold hover:bg-red-100";
                btn.onclick = () => handleCancelActivity(act.id);
            } else {
                applySection.classList.remove('hidden');
                if (act.my_status === 1 || act.my_status === 0) {
                    msgDisplay.innerText = act.my_apply_msg ? `你的申请理由：“${act.my_apply_msg}”` : "你未填写申请理由";
                    msgDisplay.classList.remove('hidden');
                    btn.innerText = act.my_status === 1 ? "🚶 退出该团队" : "⏳ 审核中 (点击取消)";
                    btn.className = "flex-1 py-4 bg-stone-100 text-stone-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500";
                    btn.onclick = () => handleQuitActivity(act.id);
                } else {
                    msgInput.classList.remove('hidden');
                    btn.innerText = "🚀 申请加入团队";
                    btn.className = "flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-amber-600";
                    btn.onclick = () => handleActivityAction();
                }
            }
            renderMembers(act.members);
        }
    } catch (e) { console.error(e); }
};

window.closeActivityDetail = () => ModalManager.close('activityDetailModal');

// 4. 成员与审批列表渲染 (含头像加载)
function renderMembers(members) {
    const grid = document.getElementById('det-members-grid');
    grid.innerHTML = '';
    const joined = members.filter(m => m.status === 1);
    joined.forEach(m => {
        const avatarId = `det-mem-avatar-${m.uid}`;
        grid.innerHTML += `
        <div class="flex items-center gap-3 p-3 bg-white border ${m.is_initiator ? 'border-amber-200 bg-amber-50/20' : 'border-stone-100'} rounded-2xl hover:border-amber-400 transition cursor-pointer" onclick="window.openUserModal(${m.uid})">
            <div id="${avatarId}" class="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-500 border-2 border-white shadow-sm shrink-0 bg-cover bg-center">${m.username.charAt(0)}</div>
            <div class="overflow-hidden"><p class="text-xs font-bold text-stone-800 truncate">${m.username} ${m.is_initiator ? '👑' : ''}</p><p class="text-[9px] text-stone-400 uppercase">${m.is_initiator ? '项目发起人' : '团队成员'}</p></div>
        </div>`;
        setTimeout(() => State.loadAvatar(m.uid, avatarId), 20);
    });
}

function renderAuditList(members) {
    const list = document.getElementById('det-audit-list');
    list.innerHTML = '';
    const pending = members.filter(m => m.status === 0);
    if (pending.length === 0) { list.innerHTML = '<p class="text-xs text-stone-400 text-center py-4">暂无待处理的申请</p>'; return; }
    pending.forEach(m => {
        const avatarId = `audit-mem-avatar-${m.uid}`;
        list.innerHTML += `
        <div class="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 cursor-pointer" onclick="window.openUserModal(${m.uid})">
                    <div id="${avatarId}" class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-xs shrink-0 bg-cover bg-center">${m.username.charAt(0)}</div>
                    <span class="text-sm font-bold text-stone-800">${m.username}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="auditMember(${currentActId}, ${m.uid}, 1)" class="px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg shadow-md shadow-emerald-100">通过</button>
                    <button onclick="auditMember(${currentActId}, ${m.uid}, 2)" class="px-4 py-1.5 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-lg hover:bg-red-50">拒绝</button>
                </div>
            </div>
            ${m.apply_msg ? `<div class="text-xs text-stone-500 bg-stone-50 p-3 rounded-xl italic">“${m.apply_msg}”</div>` : ''}
        </div>`;
        setTimeout(() => State.loadAvatar(m.uid, avatarId), 20);
    });
}

// 5. 交互操作 (申请、修改、退出、撤回)
window.handleActivityAction = async function() {
    const msg = document.getElementById('apply-msg').value;
    try {
        const res = await fetch('/api/activity/join', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ activity_id: currentActId, apply_msg: msg }) });
        const data = await res.json();
        if(data.status === 'success') { Toast.success(data.message); openActivityDetail(currentActId); loadActivityHall(); }
    } catch(e) { Toast.error("请求失败"); }
};

window.auditMember = async function(actId, uid, status) {
    try {
        const res = await fetch('/api/activity/audit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ activity_id: actId, target_uid: uid, status: status }) });
        const data = await res.json();
        if(data.status === 'success') { Toast.success("操作成功"); openActivityDetail(actId); loadManagement(); }
    } catch(e) { Toast.error("操作异常"); }
};

window.toggleActivityEdit = function(isEditing) {
    document.getElementById('det-header-view').classList.toggle('hidden', isEditing);
    document.getElementById('det-header-edit').classList.toggle('hidden', !isEditing);
    document.getElementById('det-desc').classList.toggle('hidden', isEditing);
    document.getElementById('edit-desc').classList.toggle('hidden', !isEditing);
    document.getElementById('edit-extra').classList.toggle('hidden', !isEditing);
    document.getElementById('det-members-section').classList.toggle('hidden', isEditing);
    document.getElementById('admin-audit-section').classList.toggle('hidden', isEditing);
    document.getElementById('view-actions').classList.toggle('hidden', isEditing);
    document.getElementById('edit-actions').classList.toggle('hidden', !isEditing);
};

window.saveActivityEdit = async function() {
    const data = {
        activity_id: currentActId,
        title: document.getElementById('edit-title').value.trim(),
        nature: document.getElementById('edit-nature').value,
        description: document.getElementById('edit-desc').value.trim(),
        total_capacity: document.getElementById('edit-capacity').value,
        deadline: document.getElementById('edit-deadline').value
    };
    const res = await fetch('/api/activity/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if((await res.json()).status === 'success') { Toast.success("更新成功"); toggleActivityEdit(false); openActivityDetail(currentActId); loadActivityHall(); loadManagement(); }
};

window.handleCancelActivity = async function(id) {
    if(!confirm("确定要删除吗？")) return;
    const res = await fetch('/api/activity/delete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ activity_id: id }) });
    if((await res.json()).status === 'success') { Toast.success("已删除"); ModalManager.close('activityDetailModal'); loadActivityHall(); loadManagement(); }
};

window.handleQuitActivity = async function(id) {
    if(!confirm("确定要退出吗？")) return;
    const res = await fetch('/api/activity/quit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ activity_id: id }) });
    if((await res.json()).status === 'success') { Toast.success("已退出"); ModalManager.close('activityDetailModal'); loadActivityHall(); loadManagement(); }
};

// 6. 管理页面渲染
window.loadManagement = async function() {
    const launchedContainer = document.getElementById('manage-my-launched');
    const joinedContainer = document.getElementById('manage-my-joined');
    const badge = document.getElementById('manage-badge');
    if (!launchedContainer) return;

    try {
        const res = await fetch('/api/activity/my');
        const data = await res.json();
        let totalPending = 0;

        launchedContainer.innerHTML = data.launched.length ? '' : '<p class="text-stone-300 text-sm py-4 italic">暂无发起的项目</p>';
        data.launched.forEach(act => {
            totalPending += act.members.filter(m=>m.status===0).length;
            launchedContainer.innerHTML += `
            <div class="card-warm p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group" onclick="openActivityDetail(${act.id})">
                <div class="flex justify-between items-start mb-4">
                    <h5 class="font-bold text-stone-800 group-hover:text-amber-700 transition">${act.title}</h5>
                    ${act.members.filter(m=>m.status===0).length > 0 ? `<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">${act.members.filter(m=>m.status===0).length}人待处理</span>` : ''}
                </div>
                <span class="text-[10px] text-stone-400 font-bold uppercase tracking-widest">管理与详情 ➔</span>
            </div>`;
        });

        joinedContainer.innerHTML = data.joined.length ? '' : '<p class="text-stone-300 text-sm py-4 italic">暂无参与的项目</p>';
        data.joined.forEach(act => {
            const statusMap = { 0: '审核中', 1: '已入队', 2: '被拒绝' };
            const statusColor = act.my_status === 1 ? 'text-emerald-500' : (act.my_status === 2 ? 'text-red-400' : 'text-amber-500');
            joinedContainer.innerHTML += `
            <div class="card-warm p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex justify-between items-center" onclick="openActivityDetail(${act.id})">
                <div><h5 class="font-bold text-stone-800 group-hover:text-amber-700 transition">${act.title}</h5><p class="text-[10px] text-stone-300 mt-1 uppercase font-bold">发起人：${act.publisher_name}</p></div>
                <span class="text-xs font-bold ${statusColor}">${statusMap[act.my_status]}</span>
            </div>`;
        });

        if (badge) {
            badge.innerText = totalPending;
            badge.classList.toggle('hidden', totalPending === 0);
        }
    } catch(e) { console.error("管理页加载失败", e); }
};

window.handleCreateActivity = async function(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
        title: fd.get('title'),
        nature: fd.get('nature'),
        description: fd.get('description'),
        target_crowd: Array.from(document.querySelectorAll('input[name="target_grade"]:checked')).map(el => el.value),
        target_major: Array.from(document.querySelectorAll('input[name="target_major"]:checked')).map(el => el.value),
        total_capacity: fd.get('total_capacity'),
        deadline: fd.get('deadline')
    };
    const res = await fetch('/api/activity/create', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if((await res.json()).status === 'success') { Toast.success("启动成功"); e.target.reset(); switchActivityTab('hall'); }
};