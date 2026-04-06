// ==========================================
//  侧边栏与页面调度
// ==========================================
window.switchMenu = function(menuName) {
    // 隐藏所有面板
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('hidden'));
    
    // 取消所有菜单高亮，恢复默认样式
    document.querySelectorAll('[id^="menu-"]').forEach(el => {
        el.classList.remove('menu-active', 'bg-amber-50', 'text-amber-700');
        el.classList.add('hover:bg-stone-100');
    });
    
    // 显示对应的面板并高亮菜单
    const panel = document.getElementById(`panel-${menuName}`);
    if(panel) panel.classList.remove('hidden');
    
    const activeMenu = document.getElementById(`menu-${menuName}`);
    if(activeMenu) {
        activeMenu.classList.remove('hover:bg-stone-100');
        activeMenu.classList.add('menu-active', 'bg-amber-50', 'text-amber-700');
    }

    // 根据切换的页面触发对应的数据加载
    if (menuName === 'recommend' && State.user && typeof searchUser === 'function') searchUser(State.user.uid);
    if (menuName === 'relations' && State.user && typeof loadRelations === 'function') loadRelations();
    if (menuName === 'profile' && State.user && typeof loadProfile === 'function') loadProfile();
    if (menuName === 'stats' && typeof fetchStats === 'function') fetchStats();
};