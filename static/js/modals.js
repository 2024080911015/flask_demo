// ==========================================
//  全局图谱弹窗与名片弹窗逻辑 (工业级物理修复版)
// ==========================================

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

window.closeUserModal = function() {
    document.getElementById('userProfileModal').classList.add('hidden');
};

// ==========================================
//  全局图谱弹窗与名片弹窗逻辑 (物理置顶版)
// ==========================================

window.openGraphModal = function(url) {
    const modal = document.getElementById('graphModal');
    if (modal) {
        document.body.appendChild(modal); 
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

// 🚀 核心修复：无论 CSS 如何，JS 强制搬运节点到最后，实现绝对覆盖
window.openUserModal = async function(explicitId) {
    const sid = explicitId || document.getElementById('globalSearchInput')?.value.trim();
    if(!sid) return;
    
    const modal = document.getElementById('userProfileModal');
    if (!modal) return;

    // 【关键】物理移动到 body 最后，跳出所有 Stacking Context
    document.body.appendChild(modal); 
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // 确保 flex 居中生效

    // 初始化内容
    document.getElementById('modalUsername').innerText = "Loading...";
    document.getElementById('modalUid').innerText = sid;
    document.getElementById('modalStatus').innerText = "---";
    document.getElementById('modalSignature').innerText = "读取中...";
    document.getElementById('modalBasicInfo').innerHTML = '';
    document.getElementById('modalHobbiesInfo').innerHTML = '';
    
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
        document.getElementById('modalSignature').innerText = uData.signature ? `“${uData.signature}”` : "“未设置签名”";
        
        // 状态颜色
        const statusEl = document.getElementById('modalStatus');
        statusEl.className = "px-2 py-0.5 text-[10px] font-bold rounded-md border";
        if (uData.status === '恋爱中') {
            statusEl.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
        } else if (uData.status === '爆肝中') {
            statusEl.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200');
        } else {
            statusEl.classList.add('bg-amber-100', 'text-amber-700', 'border-amber-200');
        }

        const t = parseInfoTags(uData.student_info);
        document.getElementById('modalBasicInfo').innerHTML = t.basic;
        document.getElementById('modalHobbiesInfo').innerHTML = t.hobbies;
        
        document.getElementById('modalConnCount').innerText = rData.status.total_connections;
        document.getElementById('modalDominantComm').innerText = rData.distribution.length > 0 ? rData.distribution[0].name : "暂无";
        
        document.getElementById('modalFollowBtnContainer').innerHTML = getFollowButtonHTML(sid);

        if (window.MessageSender) window.MessageSender.mount(sid);
        
    } catch(e) {
        console.error("加载失败", e);
    }
};

window.closeUserModal = function() {
    document.getElementById('userProfileModal').classList.add('hidden');
    document.getElementById('userProfileModal').classList.remove('flex');
};