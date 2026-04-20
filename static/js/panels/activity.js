// START OF FILE activity.js

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
};

// 2. 加载大厅列表
window.loadActivityHall = async function() {
    const container = document.getElementById('act-sub-hall');
    container.innerHTML = '<div class="col-span-full py-20 text-center animate-pulse text-stone-400">🔭 正在同步全校社交网络与 GNN 契合度...</div>';

    try {
        const res = await fetch('/api/activity/list');
        const data = await res.json();
        if (data.status === 'success') {
            container.innerHTML = '';
            data.data.forEach(act => {
                // 契合度颜色
                const scoreColor = act.match_score > 80 ? 'text-emerald-500' : (act.match_score > 60 ? 'text-amber-500' : 'text-stone-400');
                
                container.innerHTML += `
                <div class="card-warm rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-stone-100 flex flex-col group cursor-pointer" onclick="openActivityDetail(${act.id})">
                    <div class="flex justify-between items-start mb-4">
                        <span class="px-3 py-1 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-lg uppercase tracking-widest">${act.nature}</span>
                        <div class="text-right">
                            <div class="text-[10px] font-bold text-stone-300 uppercase">GNN 契合度</div>
                            <div class="text-xl font-black ${scoreColor}">${act.match_score}%</div>
                        </div>
                    </div>
                    <h4 class="text-xl font-serif font-bold text-stone-800 mb-2 group-hover:text-amber-700 transition">${act.title}</h4>
                    <p class="text-xs text-stone-400 line-clamp-2 mb-4 italic">“${act.description}”</p>
                    
                    <div class="mt-auto pt-4 border-t border-stone-50 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs border-2 border-white shadow-sm">${act.publisher_name.charAt(0)}</div>
                            <div class="text-[10px]">
                                <div class="text-stone-800 font-bold">${act.publisher_name}</div>
                                <div class="text-stone-400">${act.path_text || '人脉脉络扫描中'}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-xs font-bold text-stone-700">${act.member_count}/${act.capacity}</span>
                            <div class="text-[9px] text-stone-300 uppercase font-bold">席位</div>
                        </div>
                    </div>
                </div>`;
            });
        }
    } catch (e) { container.innerHTML = '加载失败'; }
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
    modal.classList.remove('hidden');
    
    // 初始化 UI
    document.getElementById('det-title').innerText = "加载中...";
    const memberGrid = document.getElementById('det-members-grid');
    memberGrid.innerHTML = '';

    try {
        // 直接从 Hall 的渲染数据中找，或者单独开接口。这里我们为了简单演示，先从 /api/activity/list 的结果里拿（实际生产建议开单独 get 接口）
        const res = await fetch('/api/activity/list'); // 实际应换为 /api/activity/get?id=...
        const all = await res.json();
        const act = all.data.find(a => a.id === id);

        document.getElementById('det-title').innerText = act.title;
        document.getElementById('det-nature').innerText = act.nature;
        document.getElementById('det-desc').innerText = act.description;
        document.getElementById('det-publisher').innerText = act.publisher_name;
        document.getElementById('det-publisher').onclick = () => openUserModal(act.publisher_id);

        // 按钮状态机
        const btn = document.getElementById('det-action-btn');
        const applySection = document.getElementById('apply-section');
        applySection.classList.add('hidden');

        if (act.publisher_id == State.user.uid) {
            btn.innerText = "你是发起人 - 前往管理页面审批";
            btn.disabled = true;
            btn.className = "w-full py-4 bg-stone-100 text-stone-400 rounded-2xl font-bold cursor-not-allowed";
        } else if (act.my_status === 'applying') {
            btn.innerText = "⏳ 审核中，请耐心等待";
            btn.disabled = true;
            btn.className = "w-full py-4 bg-amber-50 text-amber-500 rounded-2xl font-bold cursor-not-allowed";
        } else if (act.my_status === 'joined') {
            btn.innerText = "✅ 你已在队中";
            btn.disabled = true;
            btn.className = "w-full py-4 bg-emerald-50 text-emerald-500 rounded-2xl font-bold cursor-not-allowed";
        } else {
            btn.innerText = "申请加入该项目";
            btn.disabled = false;
            btn.className = "w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-amber-600 transition";
            applySection.classList.remove('hidden');
        }
    } catch(e) {}
};

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