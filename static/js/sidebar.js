// ==========================================
//  侧边栏与页面调度
// ==========================================
window.switchMenu = function(menuName) {
    // 隐藏所有面板
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('hidden'));
    
    // 取消所有菜单高亮
    document.querySelectorAll('[id^="menu-"]').forEach(el => {
        el.classList.remove('menu-active', 'bg-amber-50', 'text-amber-700');
        el.classList.add('hover:bg-stone-100');
    });
    
    // 显示对应面板
    const panel = document.getElementById(`panel-${menuName}`);
    if(panel) panel.classList.remove('hidden');
    
    // 高亮当前菜单
    const activeMenu = document.getElementById(`menu-${menuName}`);
    if(activeMenu) {
        activeMenu.classList.remove('hover:bg-stone-100');
        activeMenu.classList.add('menu-active', 'bg-amber-50', 'text-amber-700');
    }

    // --- 特殊逻辑处理 ---
    
    // 如果进入星图面板
    if (menuName === 'graph') {
        refreshGraph();
    }
    
    if (menuName === 'recommend' && State.user && typeof searchUser === 'function') {
        searchUser(State.user.uid);
    }
    if (menuName === 'relations' && State.user && typeof loadRelations === 'function') {
        loadRelations();
    }
    if (menuName === 'profile' && State.user && typeof loadProfile === 'function') {
        loadProfile();
    }
    if (menuName === 'stats' && typeof fetchStats === 'function') {
        fetchStats();
    }
    if (menuName === 'inbox' && window.InboxView) {
        window.InboxView.load();
    }
};

// 增加一个刷新图谱的全局函数
window.refreshGraph = function() {
    if (!State.user) return;
    const iframe = document.getElementById('mainGraphIframe');
    if (!iframe) return;
    
    // 构建带有推荐 ID 的 URL，用于高亮 AI 推荐节点
    const recs = State.currentRecIds ? State.currentRecIds.join(',') : '';
    const url = `/static/personal_graph.html?uid=${State.user.uid}&recs=${recs}&t=${Date.now()}`;
    
    // 只有当 URL 发生变化或者 iframe 还没加载过时才更新，防止频繁闪烁
    if (iframe.src.indexOf(`uid=${State.user.uid}`) === -1 || iframe.src === '' || recs !== '') {
        iframe.src = url;
    }
};