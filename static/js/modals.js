// ==========================================
//  全局图谱弹窗与名片弹窗管理器 (ModalManager)
// ==========================================

window.ModalManager = {
    // 基础层级
    baseZIndex: 2000,
    
    // 打开弹窗：物理搬运到 body 底部 + 动态增加 z-index
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`未找到 ID 为 ${modalId} 的弹窗`);
            return;
        }

        // 🚀 核心：搬运到 body 最后，脱离父容器层叠上下文限制
        document.body.appendChild(modal);
        
        // 🚀 核心：动态提升层级，确保后开的永远在先开的上面
        this.baseZIndex += 10;
        modal.style.zIndex = this.baseZIndex;
        
        modal.classList.remove('hidden');
        // 某些 Tailwind 居中布局需要 flex
        if (modalId === 'userProfileModal' || modalId === 'activityDetailModal') {
            modal.classList.add('flex');
        }
    },

    // 关闭弹窗
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
};

// --- 以下是兼容旧代码的调用封装 ---

window.openGraphModal = function(url) {
    document.getElementById('graphIframe').src = url;
    ModalManager.open('graphModal');
};
window.closeGraphModal = () => ModalManager.close('graphModal');

window.openUserModal = async function(explicitId) {
    const sid = explicitId || document.getElementById('globalSearchInput')?.value.trim();
    if(!sid) return;
    
    // 🚀 使用管理器打开，这会自动处理层级
    ModalManager.open('userProfileModal');

    // 下面是数据填充逻辑，保持不变
    document.getElementById('modalUsername').innerText = "Loading...";
    document.getElementById('modalUid').innerText = sid;
    
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
        console.error("加载详情失败", e);
        document.getElementById('modalUsername').innerText = "用户不存在";
    }
};

window.closeUserModal = () => ModalManager.close('userProfileModal');