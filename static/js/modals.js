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
    
    try {
        const [r1, r2] = await Promise.all([
            fetch(`/user?id=${sid}&t=${Date.now()}`), 
            fetch(`/social/report?id=${sid}&t=${Date.now()}`)
        ]);
        
        if(!r1.ok) throw new Error();
        const uData = await r1.json();
        const rData = await r2.json();
        
        document.getElementById('modalUsername').innerText = uData.username || 'User';
        document.getElementById('modalAvatar').innerText = (uData.username || 'U').charAt(0).toUpperCase();
        State.loadAvatar(uData.student_id || sid, 'modalAvatar');

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
        
        document.getElementById('modalConnCount').innerText = rData.status.total_connections;
        document.getElementById('modalDominantComm').innerText = rData.distribution.length > 0 ? rData.distribution[0].name : "暂无";
        
        document.getElementById('modalFollowBtnContainer').innerHTML = getFollowButtonHTML(sid);

        if (window.MessageSender) window.MessageSender.mount(sid);
        
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
        avatarEl.innerText = '';
        State.loadAvatar(uid, 'drawerAvatar');

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
