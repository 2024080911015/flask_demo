// ==========================================
//  面板 5：全校大盘生态统计
// ==========================================
window.fetchStats = async function() {
    try {
        const res = await fetch('/social/stats'); 
        const data = await res.json();
        
        const heroCount = document.getElementById('heroUserCount');
        if(heroCount) heroCount.textContent = data.total_users.toLocaleString();
        
        const stats =[
            { label: '注册学生', value: data.total_users, icon: '🎓' },
            { label: '社交连边', value: data.total_follows, icon: '🔗' },
            { label: '平均关注数', value: data.average_follows.toFixed(2), icon: '📊' },
            { label: '最高活跃度', value: data.max_follows, icon: '🔥' },
            { label: '网络密度', value: (data.total_follows / (data.total_users * (data.total_users - 1))).toFixed(4), icon: '🕸️' }
        ];
        
        const container = document.getElementById('globalStatsContainer');
        if(container) {
            container.innerHTML = stats.map(s => `
                <div class="card-warm p-5 rounded-2xl flex items-center gap-3 shadow-sm border border-stone-100 bg-white">
                    <div class="text-3xl">${s.icon}</div>
                    <div><div class="text-xs text-stone-400 mb-0.5 font-bold">${s.label}</div><div class="text-2xl font-black text-stone-800">${s.value}</div></div>
                </div>`).join('');
        }

        // 渲染带排名的风云人物
        const popContainer = document.getElementById('popularList');
        if(popContainer && data.most_popular_users) {
            popContainer.innerHTML = '';
            data.most_popular_users.forEach((user, index) => {
                const t = parseInfoTags(user.info);
                let rankBadge = `<span class="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-500">${index+1}</span>`;
                if(index === 0) rankBadge = `<span class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-600 text-lg">🥇</span>`;
                if(index === 1) rankBadge = `<span class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-lg">🥈</span>`;
                if(index === 2) rankBadge = `<span class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-lg">🥉</span>`;
                
                const avatarId = `pop-avatar-${user.id}`; // 核心修复：分发唯一 ID
                
                popContainer.innerHTML += `
                <div class="p-4 rounded-xl border border-stone-100 flex items-center justify-between hover:bg-stone-50 transition bg-white cursor-pointer" onclick="openUserModal(${user.id})">
                    <div class="flex items-center gap-4">
                        ${rankBadge}
                        <!-- 核心修复：挂载 ID -->
                        <div id="${avatarId}" class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 text-lg shrink-0 border border-blue-100">${(user.username || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="font-bold text-stone-800 text-sm mb-1">${user.username || 'User'} <span class="text-stone-400 font-mono text-[10px] ml-1">#${user.id}</span> <span class="ml-2 px-2 py-0.5 bg-red-50 text-red-500 text-[10px] rounded-md font-bold">粉丝: ${user.followers_count}</span></div>
                            <div class="flex flex-wrap gap-1">${t.basic}</div>
                        </div>
                    </div>
                </div>`;
                
                // 追加：异步拉取真实头像！
                setTimeout(() => State.loadAvatar(user.id, avatarId), 10);
            });
        }
    } catch(e) { console.error(e); }
};