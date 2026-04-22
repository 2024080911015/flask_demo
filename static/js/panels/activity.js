// START OF FILE activity.js
const originalOpenUserModal = window.openUserModal;
window.openUserModal = function(id) {
    originalOpenUserModal(id);
    const userModal = document.getElementById('userProfileModal');
    if (userModal) userModal.style.zIndex = "200"; // 确保永远在 ActivityModal 之上
};
// 1. Tab 切换逻辑
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

    if (tab === 'hall') loadActivityHall();
    if (tab === 'create') renderFriendSelector();
    if (tab === 'manage') loadManagement();
    if (tab === 'create') {
        renderFilterOptions('target-grades', OPT_GRADES, 'target_grade');
        renderFilterOptions('target-majors', OPT_MAJORS, 'target_major');
    }
};

function renderFilterOptions(containerId, list, name) {
    const container = document.getElementById(containerId);
    container.innerHTML = list.map(item => `
        <label class="group cursor-pointer">
            <input type="checkbox" name="${name}" value="${item}" class="hidden peer">
            <span class="px-4 py-2 rounded-xl border border-stone-200 text-stone-500 text-xs font-bold peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 transition-all block">
                ${item}
            </span>
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
        if (data.status !== 'success') throw new Error();
        
        container.innerHTML = '';
        if (data.data.length === 0) {
            container.innerHTML = '<div class="col-span-full py-20 text-center text-stone-300">目前暂无正在招募的项目</div>';
            return;
        }

        data.data.forEach(act => {
            const statusLabel = act.my_status === 1 ? '✅ 已入队' : (act.my_status === 0 ? '⏳ 审核中' : '');
            const scoreColor = act.match_score > 80 ? 'text-emerald-500' : (act.match_score > 60 ? 'text-amber-500' : 'text-stone-400');
            
            container.innerHTML += `
            <div class="card-warm rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 flex flex-col group relative overflow-hidden" onclick="openActivityDetail(${act.id})">
                <!-- 契合度环形展示 -->
                <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center">
                    <div class="text-center mt-2 mr-2">
                        <div class="text-[8px] font-black text-amber-600 uppercase">Match</div>
                        <div class="text-xl font-black ${scoreColor}">${act.match_score}%</div>
                    </div>
                </div>

                <div class="mb-6">
                    <span class="px-3 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-lg uppercase tracking-tighter shadow-sm">${act.nature}</span>
                </div>

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
                        <div class="text-right">
                            <span class="text-lg font-black text-stone-800">${act.member_count}</span>
                            <span class="text-stone-300">/ ${act.total_capacity} 席</span> 
                        </div>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) {
        container.innerHTML = '<div class="col-span-full py-20 text-center text-red-400">加载失败，请检查网络或后端</div>';
    }
};

// 3. 发起项目：好友选择器渲染
window.renderFriendSelector = async function() {
    const container = document.getElementById('invite-friend-selector');
    if (State.myFollowingIds.length === 0) {
        container.innerHTML = '<p class="text-xs text-stone-400 text-center py-4">关注一些同学后，可直接邀请他们入队</p>';
        return;
    }
    container.innerHTML = '';
    // 利用已有的全局数据
    for (let fid of State.myFollowingIds) {
        container.innerHTML += `
        <label class="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer transition">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-stone-200 text-[10px] flex items-center justify-center font-bold text-stone-500">${String(fid).charAt(0)}</div>
                <span class="text-xs font-medium text-stone-700">ID: ${fid}</span>
            </div>
            <input type="checkbox" name="invited_ids" value="${fid}" class="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-500">
        </label>`;
    }
};

// 4. 发起项目：提交处理
window.handleCreateActivity = async function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const invited_ids = Array.from(document.querySelectorAll('input[name="invited_ids"]:checked')).map(el => el.value);
    
    const data = {
        title: formData.get('title'),
        nature: formData.get('nature'),
        description: formData.get('description'),
        total_capacity: parseInt(formData.get('total_capacity')),
        deadline: formData.get('deadline'),
        invited_ids: invited_ids
    };

    try {
        const res = await fetch('/api/activity/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const resData = await res.json();
        if(resData.status === 'success') {
            Toast.success("发布成功！");
            e.target.reset();
            switchActivityTab('hall');
        }
    } catch(e) { Toast.error("发布失败"); }
};

// 5. 详情查看与状态机 (Step 6)
let currentActId = null;
window.openActivityDetail = async function(id) {
    currentActId = id;
    const modal = document.getElementById('activityDetailModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    // 骨架屏提示
    document.getElementById('det-title').innerText = "读取中...";
    document.getElementById('det-desc').innerText = "载入机密档案中...";

    try {
        // 🚀 核心：直接向后端请求最新的“我的活动”状态（已包含所有标准化数据）
        const res = await fetch('/api/activity/my');
        const data = await res.json();
        
        // 从“我发起”或“我参与”里找
        let act = [...data.launched, ...data.joined].find(a => a.id === id);

        // 如果没找到，说明是完全的路人，从全量大厅列表找
        if (!act) {
            const listRes = await fetch('/api/activity/list');
            const listData = await listRes.json();
            act = listData.data.find(a => a.id === id);
        }

        if (!act) {
            Toast.error("未找到项目信息");
            closeActivityDetail();
            return;
        }

        // --- 填充数据（严格对应后端 serialize_activity 的键名） ---
        document.getElementById('det-title').innerText = act.title;
        document.getElementById('det-nature').innerText = act.nature;
        document.getElementById('det-desc').innerText = act.description;
        document.getElementById('det-publisher').innerText = act.publisher_name;
        document.getElementById('det-publisher').onclick = () => window.openUserModal(act.publisher_id);
        document.getElementById('det-deadline').innerText = `截止日期：${act.deadline}`;
        document.getElementById('det-count').innerText = `${act.member_count}/${act.total_capacity}`;

        const auditSection = document.getElementById('admin-audit-section');
        const applySection = document.getElementById('apply-section');
        const btn = document.getElementById('det-action-btn');

        // 初始状态重置
        auditSection.classList.add('hidden');
        applySection.classList.add('hidden');
        btn.classList.remove('hidden', 'bg-stone-100', 'text-stone-400', 'cursor-not-allowed', 'bg-emerald-50', 'text-emerald-600', 'bg-amber-50', 'text-amber-600');
        btn.disabled = false;

        // 渲染成员列表
        renderMembers(act.members);

        // --- 核心权限判定逻辑 ---
        const isOwner = (act.publisher_id == State.user.uid);

        if (isOwner) {
            // 我发起的：显示审批区 + 撤回按钮
            auditSection.classList.remove('hidden');
            renderAuditList(act.members);
            
            btn.innerText = "❌ 撤回并永久删除该招募项目";
            btn.className = "w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold hover:bg-red-100 transition-all shadow-sm shadow-red-100";
            btn.onclick = () => handleCancelActivity(act.id);
        } else if (act.my_status === 1) {
            // 已入队：显示退出按钮
            btn.innerText = "🚶 退出该项目团队";
            btn.className = "w-full py-4 bg-stone-100 text-stone-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 transition-all";
            btn.onclick = () => handleQuitActivity(act.id);
        } else if (act.my_status === 0) {
            // 申请中：置灰显示并支持取消
            btn.innerText = "⏳ 审核中 (点击取消申请)";
            btn.className = "w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 transition-all";
            btn.onclick = () => handleQuitActivity(act.id);
        } else {
            // 路人：显示申请表单 + 申请按钮
            applySection.classList.remove('hidden');
            btn.innerText = "🚀 发送入队申请";
            btn.className = "w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-xl shadow-stone-200";
            btn.onclick = () => handleActivityAction();
        }

    } catch (e) {
        console.error(e);
        Toast.error("载入失败");
    }
};

// 渲染“当前阵容”中的成员（已入队）
function renderMembers(members) {
    const grid = document.getElementById('det-members-grid');
    grid.innerHTML = '';
    if (!members) return;
    
    const joined = members.filter(m => m.status === 1);
    if (joined.length === 0) {
        grid.innerHTML = '<p class="text-xs text-stone-300 py-2">暂无成员入队</p>';
        return;
    }

    joined.forEach(m => {
        const avatarId = `det-member-avatar-${m.uid}`; // 生成唯一 ID
        grid.innerHTML += `
        <div class="flex items-center gap-3 p-3 bg-white border ${m.is_initiator ? 'border-amber-200 bg-amber-50/20' : 'border-stone-100'} rounded-2xl hover:border-amber-400 transition cursor-pointer" 
             onclick="window.openUserModal(${m.uid})">
            <!-- 🚀 这里的 div 会被 loadAvatar 填充背景图 -->
            <div id="${avatarId}" class="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-500 border-2 border-white shadow-sm shrink-0 overflow-hidden bg-cover bg-center">
                ${m.username.charAt(0)}
            </div>
            <div class="overflow-hidden">
                <p class="text-xs font-bold text-stone-800 truncate">${m.username} ${m.is_initiator ? '👑' : ''}</p>
                <p class="text-[9px] text-stone-400 uppercase tracking-tighter">${m.is_initiator ? '项目发起人' : '团队成员'}</p>
            </div>
        </div>`;
        
        // 🚀 核心动作：异步加载真实头像
        setTimeout(() => State.loadAvatar(m.uid, avatarId), 10);
    });
}

// 渲染“管理面板”中的申请人（待审核）
function renderAuditList(members) {
    const list = document.getElementById('det-audit-list');
    list.innerHTML = '';
    if (!members) return;
    
    const pending = members.filter(m => m.status === 0);
    if (pending.length === 0) {
        list.innerHTML = '<p class="text-xs text-stone-400 text-center py-4">暂无待处理的申请</p>';
        return;
    }

    pending.forEach(m => {
        const avatarId = `audit-member-avatar-${m.uid}`; // 生成唯一 ID
        list.innerHTML += `
        <div class="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 cursor-pointer" onclick="window.openUserModal(${m.uid})">
                    <div id="${avatarId}" class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-xs shrink-0 overflow-hidden bg-cover bg-center">
                        ${m.username.charAt(0)}
                    </div>
                    <span class="text-sm font-bold text-stone-800">${m.username}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="auditMember(${currentActId}, ${m.uid}, 1)" class="px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition shadow-md shadow-emerald-100">通过</button>
                    <button onclick="auditMember(${currentActId}, ${m.uid}, 2)" class="px-4 py-1.5 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-lg hover:bg-red-50 hover:text-red-500 transition">拒绝</button>
                </div>
            </div>
            ${m.apply_msg ? `<div class="text-xs text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-100 italic">“${m.apply_msg}”</div>` : ''}
        </div>`;
        
        // 🚀 核心动作：异步加载真实头像
        setTimeout(() => State.loadAvatar(m.uid, avatarId), 10);
    });
}

window.closeActivityDetail = () => document.getElementById('activityDetailModal').classList.add('hidden');

// 6. 申请加入
window.handleActivityAction = async function() {
    const msg = document.getElementById('apply-msg').value;
    try {
        const res = await fetch('/api/activity/join', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ activity_id: currentActId, apply_msg: msg })
        });
        const data = await res.json();
        if(data.status === 'success') {
            Toast.success(data.message);
            closeActivityDetail();
            loadActivityHall();
        }
    } catch(e) {}
};

// 7. 加载管理页面 (Step 7)
window.loadManagement = async function() {
    const launchedContainer = document.getElementById('manage-my-launched');
    const joinedContainer = document.getElementById('manage-my-joined');
    
    try {
        const res = await fetch('/api/activity/my');
        const data = await res.json();

        // 渲染我发起的
        launchedContainer.innerHTML = '';
        data.launched.forEach(act => {
            const badge = act.pending_count > 0 ? `<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce">${act.pending_count}人待审核</span>` : '';
            launchedContainer.innerHTML += `
            <div class="card-warm p-5 rounded-2xl border border-stone-100 shadow-sm">
                <div class="flex justify-between items-start mb-4">
                    <h5 class="font-bold text-stone-800">${act.title}</h5>
                    ${badge}
                </div>
                <div class="space-y-3">
                    ${act.members.map(m => `
                        <div class="flex items-center justify-between text-xs bg-stone-50 p-3 rounded-xl">
                            <span>${m.username} ${m.is_initiator ? '👑' : ''}</span>
                            ${m.status === 0 ? `
                                <div class="flex gap-2">
                                    <button onclick="auditMember(${act.id}, ${m.uid}, 1)" class="text-emerald-600 font-bold hover:underline">通过</button>
                                    <button onclick="auditMember(${act.id}, ${m.uid}, 2)" class="text-red-500 font-bold hover:underline">拒绝</button>
                                </div>
                            ` : `<span class="text-stone-300">${m.status === 1 ? '已入队' : '已拒绝'}</span>`}
                        </div>
                    `).join('')}
                </div>
            </div>`;
        });

         // 更新 Badge
        if (totalPending > 0) {
            badge.innerText = totalPending;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
        // 渲染我参与的
        joinedContainer.innerHTML = '';
        data.joined.forEach(act => {
            const statusMap = { 0: '审核中', 1: '已通过', 2: '被拒绝' };
            joinedContainer.innerHTML += `
            <div class="card-warm p-4 rounded-xl border border-stone-100 flex justify-between items-center bg-white shadow-sm">
                <div>
                    <p class="font-bold text-stone-800 text-sm">${act.title}</p>
                    <p class="text-[10px] text-stone-400">发起人：${act.publisher_name}</p>
                </div>
                <span class="text-xs font-bold ${act.my_status===1?'text-emerald-500':'text-amber-500'}">${statusMap[act.my_status]}</span>
            </div>`;
        });
    } catch(e) {}
};

window.auditMember = async function(actId, uid, status) {
    try {
        const res = await fetch('/api/activity/audit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ activity_id: actId, target_uid: uid, status: status })
        });
        if((await res.json()).status === 'success') {
            Toast.success("操作成功");
            loadManagement();
        }
    } catch(e) {}
}

// 撤回项目函数
window.handleCancelActivity = async function(actId) {
    if (!confirm("⚠️ 确定要彻底删除这个招募项目吗？\n删除后不可恢复，所有成员申请将被清空。")) return;

    try {
        const res = await fetch('/api/activity/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ activity_id: actId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Toast.success(data.message);
            closeActivityDetail();
            // 刷新列表
            if (typeof loadActivityHall === 'function') loadActivityHall();
            if (typeof loadManagement === 'function') loadManagement();
        } else {
            Toast.error(data.message);
        }
    } catch (e) {
        Toast.error("网络异常，删除失败");
    }
};

// 退出/取消申请函数
window.handleQuitActivity = async function(actId) {
    if (!confirm("确定要退出该项目或取消你的加入申请吗？")) return;

    try {
        const res = await fetch('/api/activity/quit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ activity_id: actId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Toast.success(data.message);
            closeActivityDetail();
            // 刷新列表
            if (typeof loadActivityHall === 'function') loadActivityHall();
            if (typeof loadManagement === 'function') loadManagement();
        } else {
            Toast.error(data.message);
        }
    } catch (e) {
        Toast.error("网络异常，操作失败");
    }
};

// 重写管理页面的卡片渲染，使其点击后能够打开详情弹窗
window.loadManagement = async function() {
    const launchedContainer = document.getElementById('manage-my-launched');
    const joinedContainer = document.getElementById('manage-my-joined');
    const badge = document.getElementById('manage-badge');
    if (!launchedContainer || !joinedContainer) return;

    try {
        const res = await fetch('/api/activity/my');
        const data = await res.json();
        
        let totalPending = 0;

        // 渲染我发起的
        launchedContainer.innerHTML = '';
        if (data.launched.length === 0) {
            launchedContainer.innerHTML = '<div class="col-span-full py-10 text-center text-stone-300 border-2 border-dashed border-stone-100 rounded-[2rem]">你还没有发起过任何项目</div>';
        }
        data.launched.forEach(act => {
            totalPending += act.pending_count;
            launchedContainer.innerHTML += `
            <div class="card-warm p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group" onclick="openActivityDetail(${act.id})">
                <div class="flex justify-between items-start mb-4">
                    <h5 class="font-bold text-stone-800 group-hover:text-amber-700 transition">${act.title}</h5>
                    ${act.pending_count > 0 ? `<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">${act.pending_count}人待审核</span>` : ''}
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-[10px] text-stone-400 font-bold uppercase tracking-widest">点击进入管理面板 ➔</span>
                </div>
            </div>`;
        });

        // 渲染我参与的
        joinedContainer.innerHTML = '';
        if (data.joined.length === 0) {
            joinedContainer.innerHTML = '<div class="col-span-full py-10 text-center text-stone-300 border-2 border-dashed border-stone-100 rounded-[2rem]">你还没有加入任何项目</div>';
        }
        data.joined.forEach(act => {
            const statusMap = { 0: '审核中', 1: '已入队', 2: '被拒绝' };
            const statusColor = act.my_status === 1 ? 'text-emerald-500' : (act.my_status === 2 ? 'text-red-400' : 'text-amber-500');
            joinedContainer.innerHTML += `
            <div class="card-warm p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex justify-between items-center" onclick="openActivityDetail(${act.id})">
                <div>
                    <h5 class="font-bold text-stone-800 group-hover:text-amber-700 transition">${act.title}</h5>
                    <p class="text-[10px] text-stone-300 mt-1 uppercase font-bold">发起人：${act.publisher_name}</p>
                </div>
                <span class="text-xs font-bold ${statusColor}">${statusMap[act.my_status]}</span>
            </div>`;
        });

        // 更新 Badge 数量
        if (badge) {
            if (totalPending > 0) {
                badge.innerText = totalPending;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch(e) {
        console.error("加载管理数据失败:", e);
    }
}
