// ==========================================
//  面板 4：找朋友 (模糊搜索 + 列表展示)
// ==========================================
window.searchOtherUser = async function(explicitQuery = null) {
    const query = explicitQuery || document.getElementById('globalSearchInput').value.trim();
    if(!query) return;

    switchMenu('search');
    document.getElementById('globalSearchInput').value = query;
    
    const resultArea = document.getElementById('searchResultListArea');
    const grid = document.getElementById('searchResultGrid');
    const countSpan = document.getElementById('searchResultCount');
    
    resultArea.classList.remove('hidden');
    grid.innerHTML = '<div class="col-span-full text-center py-16 text-stone-400 font-bold text-lg animate-pulse">⏳ 正在全校数据库中穿梭检索...</div>';
    countSpan.innerText = '';
    
    try {
        const res = await fetch(`/api/search_users?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.status !== 'success' || !data.results) throw new Error();
        
        const results = data.results;
        countSpan.innerText = `(为您找到 ${results.length} 名匹配同学)`;
        
        if (results.length === 0) {
            grid.innerHTML = `<div class="col-span-full flex flex-col items-center py-16 text-stone-300"><div class="text-6xl mb-4">👻</div><p class="text-base font-bold text-stone-500">茫茫人海，查无此人</p></div>`;
            return;
        }
        
        grid.innerHTML = '';
        results.forEach(item => {
            const t = parseInfoTags(item.info);
            const avatarId = `search-avatar-${item.id}`;
            grid.innerHTML += `
            <div class="p-5 rounded-2xl border border-stone-100 hover:border-amber-300 hover:bg-amber-50/40 transition group flex flex-col justify-between h-full bg-white shadow-sm cursor-pointer transform hover:-translate-y-1" onclick="openUserModal(${item.id})">
                <div>
                    <div class="flex items-center gap-4 mb-4">
                        <div id="${avatarId}" class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center font-bold text-blue-600 text-xl shadow-inner border border-white shrink-0">
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
            State.loadAvatar(item.id, avatarId);
        });
    } catch(err) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-red-400 font-bold">❌ 检索失败</div>`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const globalSearchInput = document.getElementById('globalSearchInput');
    if(globalSearchInput) {
        globalSearchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchOtherUser(); });
    }
});