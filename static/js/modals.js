// ==========================================
//  全局图谱弹窗与名片弹窗逻辑 (工业级物理修复版)
// ==========================================

window.ModalManager = {
    baseZIndex: 2000,
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        document.body.appendChild(modal);
        this.baseZIndex += 10;
        modal.style.zIndex = this.baseZIndex;
        modal.classList.remove('hidden');
        if (modalId !== 'graphModal') modal.classList.add('flex');
    },
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
};

window.openGraphModal = function(url) {
    const modal = document.getElementById('graphModal');
    if (modal) {
        document.body.appendChild(modal); // 搬运到最外层
        document.getElementById('graphIframe').src = url;
        modal.classList.remove('hidden');
    }
};

window.closeGraphModal = function() {
    document.getElementById('graphModal').classList.add('hidden');
    document.getElementById('graphIframe').src = ''; 
};

window.openPersonalGraph = function() {
    if (!window.currentUserId) return;
    openGraphModal(`/static/personal_graph.html?uid=${window.currentUserId}&recs=${State.currentRecIds.join(',')}`);
};

// 🚀 核心修复函数
window.openUserModal = async function(explicitId) {
    const sid = explicitId || document.getElementById('globalSearchInput')?.value.trim();
    if(!sid) return;
    // 1. 获取模态框
    const modal = document.getElementById('userProfileModal');
    if (!modal) return;

    // 2. 【核心动作】物理移动：将模态框直接挂在 body 下，跳出所有层叠上下文
    document.body.appendChild(modal); 

    // 3. 显示并重置 UI
    modal.classList.remove('hidden');
    // 强制设置一个极其夸张的 z-index，确保万无一失
    modal.style.zIndex = "9999"; 

    document.getElementById('modalUsername').innerText = "Loading...";
    document.getElementById('modalUid').innerText = sid;
    document.getElementById('modalStatus').innerText = "---";
    document.getElementById('modalSignature').innerText = "正在获取签名...";
    document.getElementById('modalBasicInfo').innerHTML = '';
    document.getElementById('modalHobbiesInfo').innerHTML = '';
    document.getElementById('modalConnCount').innerText = '-';
    document.getElementById('modalDominantComm').innerText = '-';
    document.getElementById('modalFollowBtnContainer').innerHTML = '';

    // 重置新增区块
    const skillsSection = document.getElementById('modalSkillsSection');
    const compSection = document.getElementById('modalCompSection');
    const inviteSection = document.getElementById('modalInviteSection');
    if (skillsSection) skillsSection.classList.add('hidden');
    if (compSection) compSection.classList.add('hidden');
    if (inviteSection) inviteSection.classList.add('hidden');

    try {
        const [r1, r2, r3] = await Promise.all([
            fetch(`/user?id=${sid}&t=${Date.now()}`),
            fetch(`/social/report?id=${sid}&t=${Date.now()}`),
            fetch(`/api/user/competitions?uid=${sid}&t=${Date.now()}`)
        ]);
        
        if(!r1.ok) throw new Error();
        const uData = await r1.json();
        const rData = await r2.json();
        
        document.getElementById('modalUsername').innerText = uData.username || 'User';
        const modalInitial = (uData.username || 'U').charAt(0).toUpperCase();
        const modalAvatar = document.getElementById('modalAvatar');
        modalAvatar.style.backgroundImage = 'none';
        modalAvatar.style.backgroundColor = '#fef3c7';
        modalAvatar.style.color = '#b45309';
        modalAvatar.innerText = modalInitial;
        State.loadAvatar(uData.student_id || sid, 'modalAvatar', true, modalInitial);

        document.getElementById('modalStatus').innerText = uData.status || "找朋友";
        document.getElementById('modalSignature').innerText = uData.signature ? `“${uData.signature}”` : "“这个人很懒，什么都没留下”";
        
        const statusEl = document.getElementById('modalStatus');
        if (uData.status === '恋爱中') {
            statusEl.className = "px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-md border border-red-200";
        } else if (uData.status === '爆肝中') {
            statusEl.className = "px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded-md border border-orange-200";
        } else {
            statusEl.className = "px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md border border-amber-200";
        }

        const t = parseInfoTags(uData.student_info);
        document.getElementById('modalBasicInfo').innerHTML = t.basic;
        document.getElementById('modalHobbiesInfo').innerHTML = t.hobbies;

        // 🆕 技能标签展示
        if (t.skills && skillsSection) {
            document.getElementById('modalSkillsTags').innerHTML = t.skills;
            skillsSection.classList.remove('hidden');
        } else if (skillsSection) {
            skillsSection.classList.add('hidden');
        }

        // 🆕 竞赛经历展示
        const cData = await r3.json();
        if (cData.data && cData.data.length > 0 && compSection) {
            document.getElementById('modalCompList').innerHTML = cData.data.map(c => `
                <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                    <div class="w-8 h-8 rounded-lg ${c.type === 'ongoing' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center text-xs font-bold shrink-0">${c.type === 'ongoing' ? '🚀' : '🏆'}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-stone-700 truncate">${c.competition_name}</p>
                        <p class="text-xs text-stone-400">${c.role} · ${c.year}${c.description ? ' · ' + c.description : ''}</p>
                    </div>
                </div>
            `).join('');
            compSection.classList.remove('hidden');
        } else if (compSection) {
            compSection.classList.add('hidden');
        }

        // 🆕 邀请组队按钮（仅当当前用户有发起的活动时显示）
        if (inviteSection && State.user && String(sid) !== String(State.user.uid)) {
            try {
                const myRes = await fetch('/api/activity/my');
                const myData = await myRes.json();
                const myLaunched = (myData.launched || []).filter(a => a.my_status !== 2);
                if (myLaunched.length > 0) {
                    inviteSection.classList.remove('hidden');
                    const inviteBtn = document.getElementById('modalInviteBtn');
                    if (inviteBtn) {
                        inviteBtn.replaceWith(inviteBtn.cloneNode(true));  // 清除旧事件
                        const newBtn = document.getElementById('modalInviteBtn');
                        newBtn.addEventListener('click', function() {
                            showInvitePopup(sid, myLaunched);
                        });
                    }
                }
            } catch(e) { console.error('加载邀请按钮失败', e); }
        }

        document.getElementById('modalConnCount').innerText = rData.status.total_connections;
        document.getElementById('modalDominantComm').innerText = rData.distribution.length > 0 ? rData.distribution[0].name : "暂无";

        document.getElementById('modalFollowBtnContainer').innerHTML = getFollowButtonHTML(sid);

        if (window.ChatManager) window.ChatManager.mount(sid);
        
    } catch(e) {
        console.error("加载用户信息失败", e);
        document.getElementById('modalUsername').innerText = "用户不存在";
        document.getElementById('modalSignature').innerText = "无法加载该用户的社交档案。";
    }
};

// 🚀 社交侧边抽屉：点击星图头像触发
window.openSocialDrawer = async function(uid) {
    const drawer = document.getElementById('socialDrawer');
    if (!drawer) return;
    
    drawer.classList.remove('translate-x-full'); // 丝滑滑入
    

    // 🚀 1. 物理消灭红点：立即通知 iframe 内的星图重绘
    const iframe = document.getElementById('mainGraphIframe');
    if (iframe && iframe.contentWindow.Graph) {
        const graph = iframe.contentWindow.Graph;
        const node = graph.graphData().nodes.find(n => String(n.id) === String(uid));
        if (node) {
            node.hasPulse = false; // 强行关闭状态
            // 触发一次 Three.js 对象的重新映射（虽然 nodeThreeObject 会在重绘时读取新状态，但为了保险我们手动刷新）
            graph.nodeThreeObject(graph.nodeThreeObject()); 
        }
    }
    // 1. 标记已读 (后端逻辑)
    fetch('/api/social/mark_read', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ target_id: uid })
    });

    // 2. 局部刷新星图节点状态 (无需重刷整页)
    if (window.frames[0] && window.frames[0].Graph) {
        // 如果星图在 iframe 里，尝试找到对应的 node 数据并更新
        const graph = window.frames[0].Graph;
        const node = graph.graphData().nodes.find(n => String(n.id) === String(uid));
        if (node) {
            node.hasPulse = false; // 手动关闭脉冲
            graph.nodeThreeObject(graph.nodeThreeObject()); // 触发重绘
        }
    } else if (window.Graph) {
        // 如果就在本页
        const node = window.Graph.graphData().nodes.find(n => String(n.id) === String(uid));
        if (node) {
            node.hasPulse = false;
            window.Graph.nodeThreeObject(window.Graph.nodeThreeObject());
        }
    }

    try {
        // 2. 并行获取资料和他正在进行的活动
        const [uRes, aRes] = await Promise.all([
            fetch(`/user?id=${uid}&t=${Date.now()}`),
            fetch(`/api/activity/my?target_uid=${uid}`) // 调用刚才改好的后端接口
        ]);
        const uData = await uRes.json();
        const aData = await aRes.json();

        // 3. 填充基础信息
        document.getElementById('drawerName').innerText = uData.username;
        document.getElementById('drawerStatus').innerText = uData.status || "找朋友";
        document.getElementById('drawerSignature').innerText = uData.signature ? `“${uData.signature}”` : "“这个星系节点保持着沉默”";
        
        // 头像加载
        const avatarEl = document.getElementById('drawerAvatar');
        const drawerInitial = (uData.username || 'U').charAt(0).toUpperCase();
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.backgroundColor = '#fef3c7';
        avatarEl.style.color = '#b45309';
        avatarEl.innerText = drawerInitial;
        State.loadAvatar(uid, 'drawerAvatar', true, drawerInitial);

        // 跳转主页按钮
        document.getElementById('drawerProfileBtn').onclick = () => {
            closeSocialDrawer();
            window.openUserModal(uid);
        };

        // 4. 填充正在进行的活动
        const projContainer = document.getElementById('drawerProjects');
        projContainer.innerHTML = '';
        const allActs = (aData.launched || []).concat(aData.joined || []).filter(a => a.my_status !== 2);

        if (allActs.length === 0) {
            projContainer.innerHTML = '<p class="text-[10px] text-stone-300 italic py-4">该节点目前没有活跃的项目波束</p>';
        } else {
            allActs.forEach(act => {
                projContainer.innerHTML += `
                <div onclick="window.openActivityDetail(${act.id})" class="p-4 bg-stone-50 rounded-[1.2rem] border border-stone-100 hover:border-amber-400 hover:bg-amber-50/50 cursor-pointer transition-all group">
                    <p class="text-xs font-bold text-stone-800 group-hover:text-amber-700 transition">${act.title}</p>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-[9px] font-black text-amber-600/60 uppercase tracking-tighter">${act.nature}</span>
                        <span class="text-[9px] text-stone-400 font-bold">${act.member_count}/${act.total_capacity} 席</span>
                    </div>
                </div>`;
            });
        }
    } catch(e) { console.error("抽屉加载失败", e); }
};

window.closeSocialDrawer = () => {
    document.getElementById('socialDrawer').classList.add('translate-x-full');
};

window.closeUserModal = function() {
    document.getElementById('userProfileModal').classList.add('hidden');
};

// 🆕 组队邀请弹窗
let _inviteTargetUid = null;
window.showInvitePopup = function(targetUid, myActivities) {
    _inviteTargetUid = parseInt(targetUid);
    if (!myActivities || myActivities.length === 0) {
        alert('没有可邀请的队伍');
        return;
    }

    // 创建或获取邀请弹窗
    let popup = document.getElementById('invitePopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'invitePopup';
        popup.className = 'fixed inset-0 z-[99999] hidden flex items-center justify-center bg-stone-900/80 backdrop-blur-md';
        popup.innerHTML = `
            <div class="bg-white rounded-[2rem] w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl flex flex-col animate-scale-in">
                <div class="p-6 pb-4 flex justify-between items-center border-b border-stone-100">
                    <h3 class="text-xl font-serif font-bold text-stone-800">邀请组队</h3>
                    <button onclick="closeInvitePopup()" class="w-8 h-8 flex items-center justify-center bg-stone-50 text-stone-400 hover:text-red-500 rounded-full transition text-lg leading-none">x</button>
                </div>
                <div class="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scroll" id="invitePopupBody"></div>
                <div class="p-6 pt-2 border-t border-stone-100">
                    <button id="inviteSubmitBtn" class="w-full py-3 bg-stone-900 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled>请先选择一个队伍</button>
                </div>
            </div>`;
        document.body.appendChild(popup);
        // 点击遮罩关闭
        popup.addEventListener('click', function(e) {
            if (e.target === popup) closeInvitePopup();
        });
    }

    // 每次打开都重新绑定事件
    popup._selectedActId = null;
    popup._selectedSlot = null;

    const body = document.getElementById('invitePopupBody');
    body.innerHTML = '';
    myActivities.forEach(act => {
        const hasEmptySlots = (act.team_slots || []).some(s => !s.is_filled);
        const actDiv = document.createElement('div');
        actDiv.className = 'p-4 rounded-2xl border border-stone-200 bg-stone-50 cursor-pointer hover:border-amber-300 transition act-option';
        actDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-bold text-stone-800 text-sm">${act.category || act.nature}</p>
                    <p class="text-xs text-stone-400">${act.title || '未命名队伍'} · ${act.member_count}/${act.total_capacity}席</p>
                </div>
                <span class="text-[10px] text-stone-300 select-indicator">选择</span>
            </div>`;

        // 岗位列表
        const slotsDiv = document.createElement('div');
        slotsDiv.className = 'slots-container hidden mt-2';
        (act.team_slots || []).forEach(slot => {
            const slotBtn = document.createElement('div');
            if (slot.is_filled) {
                slotBtn.className = 'p-2.5 rounded-xl border border-stone-200 text-xs opacity-50 ml-6 mt-1';
                slotBtn.innerHTML = '已满 ' + (slot.index + 1) + '号: ' + slot.role + ' (' + slot.major_required + ') <span class="text-red-400 ml-1">已满</span>';
            } else {
                slotBtn.className = 'p-2.5 rounded-xl border border-stone-200 text-xs cursor-pointer hover:border-amber-400 hover:bg-amber-50 ml-6 mt-1 slot-option';
                slotBtn.innerHTML = '空缺 ' + (slot.index + 1) + '号: ' + slot.role + ' (' + slot.major_required + ') <span class="text-emerald-500 ml-1">空缺</span>';
                slotBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    document.querySelectorAll('#invitePopupBody .slot-option').forEach(s => {
                        s.classList.remove('border-amber-400', 'bg-amber-50', 'font-bold');
                    });
                    slotBtn.classList.add('border-amber-400', 'bg-amber-50', 'font-bold');
                    popup._selectedSlot = slot.index;
                    popup._selectedActId = act.id;
                    document.getElementById('inviteSubmitBtn').textContent = '发送邀请';
                    document.getElementById('inviteSubmitBtn').disabled = false;
                });
            }
            slotsDiv.appendChild(slotBtn);
        });
        actDiv.appendChild(slotsDiv);

        actDiv.addEventListener('click', function() {
            document.querySelectorAll('#invitePopupBody .act-option').forEach(a => {
                a.classList.remove('border-amber-400', 'bg-amber-50');
                a.querySelector('.select-indicator').textContent = '选择';
            });
            document.querySelectorAll('#invitePopupBody .slots-container').forEach(s => s.classList.add('hidden'));
            actDiv.classList.add('border-amber-400', 'bg-amber-50');
            actDiv.querySelector('.select-indicator').textContent = '已选';
            slotsDiv.classList.remove('hidden');
            popup._selectedActId = act.id;
            popup._selectedSlot = null;
            document.getElementById('inviteSubmitBtn').textContent = '请选择具体岗位';
            document.getElementById('inviteSubmitBtn').disabled = true;
        });

        body.appendChild(actDiv);
    });

    // 设置发送按钮
    const submitBtn = document.getElementById('inviteSubmitBtn');
    submitBtn.onclick = async function() {
        const actId = popup._selectedActId;
        const slot = popup._selectedSlot;
        const target = _inviteTargetUid;

        if (actId === null || slot === null || !target) {
            alert('请先选择队伍和岗位');
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = '发送中...';
        try {
            const res = await fetch('/api/activity/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity_id: actId,
                    target_uid: target,
                    slot_index: slot,
                    message: '队长邀请你加入队伍！'
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                alert('邀请已发送！对方将收到站内通知。');
                closeInvitePopup();
            } else {
                alert(data.message || '发送失败');
                submitBtn.disabled = false;
                submitBtn.textContent = '发送邀请';
            }
        } catch (e) {
            alert('网络错误，请重试');
            submitBtn.disabled = false;
            submitBtn.textContent = '发送邀请';
        }
    };

    popup.classList.remove('hidden');
    popup.style.display = 'flex';
};

window.closeInvitePopup = function() {
    const popup = document.getElementById('invitePopup');
    if (popup) {
        popup.classList.add('hidden');
        popup.style.display = 'none';
    }
    _inviteTargetUid = null;
};
