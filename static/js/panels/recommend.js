// ==========================================
//  面板 1：推荐交友 (AI 推荐引擎)
// ==========================================
window.currentUserId = null;
window.currentMode = 'social';
window.myChart = null;
window.chartColors =['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

window.fetchCommunities = async function() {
    try {
        const res = await fetch('/community'); const data = await res.json();
        const sel = document.getElementById('communitySelect');
        if(!sel) return;
        data.communities.forEach(c => { const o = document.createElement('option'); o.value = c; o.innerText = c; sel.appendChild(o); });
    } catch {}
};

window.setMode = function(mode) {
    window.currentMode = mode;
    const base = 'px-2 py-2 rounded-lg text-xs font-medium transition';
    document.getElementById('mode-social').className = base + (mode === 'social' ? ' tab-active bg-white shadow-sm' : ' text-stone-500');
    document.getElementById('mode-gnn').className = base + (mode === 'gnn' ? ' tab-active bg-white shadow-sm' : ' text-stone-500');
};

window.applyFilters = function() { 
    if (window.currentUserId) window.searchUser(window.currentUserId); 
};

window.searchUser = async function(explicitId) {
    if (!explicitId) return;
    window.currentUserId = explicitId;
    
    document.getElementById('emptyState')?.classList.add('hidden');
    document.getElementById('errorState')?.classList.add('hidden');
    
    const comm = document.getElementById('communitySelect')?.value || '';
    
    try {
        const [r1, r2] = await Promise.all([
            fetch(`/tuijian?id=${explicitId}&mode=${window.currentMode}&community=${comm}`),
            fetch(`/social/report?id=${explicitId}`)
        ]);
        if (!r1.ok || !r2.ok) throw new Error('用户不存在');
        const td = await r1.json();
        const rd = await r2.json();

        State.currentRecIds = td.recommend_ids ||[];

        document.getElementById('displayUserId').innerText = explicitId;
        const isSelf = (State.user && explicitId == State.user.uid);
        document.getElementById('displayUsername').innerText = isSelf ? State.user.username : `User`;
        document.getElementById('displayAvatarInitial').innerText = isSelf ? State.user.username.charAt(0).toUpperCase() : `U`;
        State.loadAvatar(explicitId, 'displayAvatarInitial');

        const ut = parseInfoTags(td.student_info, true);
        document.getElementById('displayUserInfo').innerHTML = ut.basic + ut.hobbies;

        const rc = document.getElementById('recommendList');
        rc.innerHTML = '';

        if (!td.recommend_friends?.length) {
            rc.innerHTML = `<div class="col-span-2 flex flex-col items-center py-8 text-stone-300"><p class="text-sm">暂无推荐结果</p></div>`;
        } else {
            td.recommend_friends.forEach((item, i) => {
                const t = parseInfoTags(item.info);
                const avatarId = `rec-avatar-${item.id}`; // 🚀 核心修复：为头像分发唯一 ID
                
                rc.innerHTML += `
                <div class="flex-1 p-4 rounded-xl border border-stone-100 hover:border-amber-200 bg-white shadow-sm flex items-center justify-between transition group">
                    <div class="flex items-center gap-4 cursor-pointer hover:opacity-80 w-full" onclick="openUserModal(${item.id})">
                        <span class="font-serif text-xl font-bold text-stone-200 group-hover:text-amber-400 transition w-6 text-center">#${i+1}</span>
                        <!--  核心修复：挂载 ID -->
                        <div id="${avatarId}" class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 shadow-inner border border-white shrink-0">${(item.username||'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="font-bold text-stone-800 text-sm">${item.username||'User'} <span class="text-stone-400 font-mono text-[10px] font-normal ml-1">#${item.id}</span></div>
                            <div class="flex flex-wrap gap-1 mt-1">${t.basic} ${t.hobbies}</div>
                        </div>
                    </div>
                    <div class="shrink-0 ml-4 relative z-10">
                        ${getFollowButtonHTML(item.id)}
                    </div>
                </div>`;
                
                //  追加：通知全局 State 去拉取并填充真实头像！
                setTimeout(() => State.loadAvatar(item.id, avatarId), 10);
            });
        }
        window.renderDiagnostic(rd);
    } catch (err) {
        document.getElementById('errorState')?.classList.remove('hidden');
        document.getElementById('errorMessage').innerText = '获取数据异常，请确保后端模型运行正常！';
    }
};

window.renderDiagnostic = function(data) {
    document.getElementById('diagnosticPanel')?.classList.remove('hidden');
    document.getElementById('diagTitle').innerText = data.status.title;
    document.getElementById('diagDesc').innerText = data.status.description;
    document.getElementById('diagAdvice').innerText = data.advice;
    
    if (window.myChart) window.myChart.destroy();
    const canvas = document.getElementById('communityChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    window.myChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: data.distribution.map(d => d.name), datasets:[{ data: data.distribution.map(d => d.count), backgroundColor: window.chartColors, borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
};