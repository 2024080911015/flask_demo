// ==========================================
//  面板 2：关系管理 (所有好友 + 批量成员分配)
// ==========================================
window.globalGroups =[];
window.globalMappings = {};
window.globalFollowing =[];

window.loadRelations = async function() {
    try {
        const [gRes, fRes, foRes] = await Promise.all([ fetch('/api/groups'), fetch(`/following?id=${State.user.uid}`), fetch(`/followers?id=${State.user.uid}`) ]);
        const gData = await gRes.json(); const fData = await fRes.json(); const foData = await foRes.json();

        window.globalGroups = gData.groups ||[]; 
        window.globalMappings = gData.mappings || {};
        window.globalFollowing = fData.following ||[];
        
        const container = document.getElementById('followingGroupsContainer');
        if(!container) return;
        container.innerHTML = '';
        
        const groupedFriends = { 0:[] }; 
        window.globalGroups.forEach(g => groupedFriends[g.id] =[]);
        
        window.globalFollowing.forEach(f => {
            groupedFriends[0].push(f);
            const gid = window.globalMappings[f.id] || 0;
            if (gid !== 0 && groupedFriends[gid]) groupedFriends[gid].push(f);
        });

        container.innerHTML += window.renderAccordionGroup(0, "所有关注", groupedFriends[0], false);
        window.globalGroups.forEach(g => {
            container.innerHTML += window.renderAccordionGroup(g.id, g.name, groupedFriends[g.id], true);
        });

        const fc = document.getElementById('followersList');
        fc.innerHTML = '';
        (foData.followers ||[]).forEach(item => {
            const t = parseInfoTags(item.info);
            const avatarId = `follower-avatar-${item.id}`;
            fc.innerHTML += `
            <div class="p-3 rounded-xl border border-stone-100 text-xs flex items-center justify-between hover:bg-stone-50 transition bg-white mb-2">
                <div class="flex items-center gap-3 cursor-pointer hover:opacity-70 transition w-full" onclick="openUserModal(${item.id})">
                    <div id="${avatarId}" class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 shrink-0 border border-blue-100">${(item.username || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="font-bold text-stone-800 text-sm mb-0.5">${item.username || 'User'} <span class="font-mono text-stone-400 text-[10px] ml-1">#${item.id}</span></div>
                        <div class="flex flex-wrap gap-1">${t.basic}</div>
                    </div>
                </div>
                <div class="shrink-0 ml-4">${getFollowButtonHTML(item.id)}</div>
            </div>`;
            State.loadAvatar(item.id, avatarId);
        });

        document.getElementById('countFollowing').innerText = fData.count || 0;
        document.getElementById('countFollowers').innerText = foData.followers_count || 0;
    } catch(e) { console.error("加载关系失败", e); }
};

window.renderAccordionGroup = function(groupId, groupName, friends, canManage) {
    const manageBtn = canManage 
        ? `<div class="flex gap-2 items-center">
             <button onclick="renameGroup(${groupId}, '${groupName}', event)" class="text-xs bg-blue-50 border border-blue-100 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition shadow-sm">改名</button>
             <button onclick="deleteGroup(${groupId}, event)" class="text-xs bg-red-50 border border-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition shadow-sm">删除</button>
             <button onclick="openMemberManager(event, ${groupId}, '${groupName}')" class="text-xs bg-white border border-stone-200 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition shadow-sm">👥 分配</button>
           </div>` 
        : '';

    let html = `
    <details class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden group" ${groupId===0 ? 'open' : ''}>
        <summary class="px-5 py-4 font-bold text-stone-700 cursor-pointer flex justify-between items-center outline-none bg-stone-50 hover:bg-stone-100 transition">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-stone-400 arrow-icon transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                <span>${groupName} <span class="text-stone-400 font-normal text-sm ml-1">(${friends.length})</span></span>
            </div>
            ${manageBtn}
        </summary>
        <div class="p-2 space-y-1 bg-white">`;
        
    if(friends.length === 0) html += `<p class="text-xs text-stone-400 text-center py-4">暂无成员</p>`;
    
    friends.forEach(f => {
        const t = parseInfoTags(f.info);
        const avatarId = `friend-avatar-${f.id}`;
        html += `
        <div class="p-3 rounded-lg border border-transparent hover:bg-stone-50 text-xs flex items-center justify-between transition">
            <div class="flex items-center gap-3 cursor-pointer hover:opacity-70 transition w-full" onclick="openUserModal(${f.id})">
                <div id="${avatarId}" class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 shrink-0 text-sm border border-amber-200">${(f.username || 'U').charAt(0).toUpperCase()}</div>
                <div>
                    <div class="font-bold text-stone-800 text-sm mb-0.5">${f.username || 'User'} <span class="font-mono text-stone-400 text-[10px] ml-1">#${f.id}</span></div>
                    <div class="flex flex-wrap gap-1">${t.basic}</div>
                </div>
            </div>
            <div class="shrink-0 ml-4">${getFollowButtonHTML(f.id)}</div>
        </div>`;
        setTimeout(() => State.loadAvatar(f.id, avatarId), 10);
    });
    html += `</div></details>`;
    return html;
};

// 弹窗与控制
window.createNewGroup = async function() {
    const name = document.getElementById('newGroupName').value.trim();
    if(!name) return alert("组名不能为空");
    await fetch('/api/groups/create', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name})});
    document.getElementById('newGroupName').value = ''; 
    await loadRelations(); 
};
window.renameGroup = async function(id, oldName, event) {
    if(event) event.stopPropagation(); 
    const newName = prompt("请输入新的分组名称:", oldName);
    if(!newName || newName === oldName) return;
    await fetch('/api/groups/rename', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({group_id: id, name: newName})});
    await loadRelations(); 
};
window.deleteGroup = async function(id, event) {
    if(event) event.stopPropagation(); 
    if(!confirm("⚠️ 确定要删除这个分组吗？\n删除后，该组的好友将自动回到【所有关注】中，且无法恢复。")) return;
    await fetch('/api/groups/delete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({group_id: id})});
    await loadRelations(); 
};

window.openMemberManager = function(event, groupId, groupName) {
    if(event) event.preventDefault(); 
    document.getElementById('mm-group-name').innerText = groupName;
    document.getElementById('mm-group-id').value = groupId;
    
    const searchInput = document.getElementById('mm-search-input');
    if (searchInput) searchInput.value = '';
    
    const listContainer = document.getElementById('mm-friend-list');
    listContainer.innerHTML = '';
    
    if (window.globalFollowing.length === 0) {
        listContainer.innerHTML = '<div class="col-span-full text-sm text-stone-400 text-center py-10">你还没有关注任何人，先去发现新朋友吧！</div>';
    } else {
        window.globalFollowing.forEach(f => {
            const currentGid = window.globalMappings[f.id] || 0;
            const isChecked = (currentGid === groupId); 
            const t = parseInfoTags(f.info);
            
            listContainer.innerHTML += `
            <label class="mm-member-item flex items-center gap-4 p-4 bg-white hover:bg-amber-50/40 rounded-2xl cursor-pointer border border-stone-200 hover:border-amber-300 transition shadow-sm" data-name="${(f.username || 'User').toLowerCase()}" data-id="${f.id}">
                <input type="checkbox" value="${f.id}" class="group-member-cb w-5 h-5 text-amber-500 rounded border-stone-300 focus:ring-amber-500 cursor-pointer shrink-0" ${isChecked ? 'checked' : ''}>
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center font-bold text-stone-600 shrink-0 text-lg border border-white shadow-inner">
                    ${(f.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-stone-800 truncate mb-1">${f.username || 'User'} <span class="font-mono text-stone-400 text-[10px] ml-1 font-normal">#${f.id}</span></div>
                    <div class="flex gap-1 scale-[0.85] origin-left whitespace-nowrap overflow-hidden text-ellipsis">${t.basic}</div>
                </div>
            </label>`;
        });
    }
    document.getElementById('memberManagerModal').classList.remove('hidden');
};

window.filterGroupMembers = function() {
    const keyword = document.getElementById('mm-search-input').value.toLowerCase().trim();
    document.querySelectorAll('.mm-member-item').forEach(item => {
        const name = item.getAttribute('data-name'); const id = item.getAttribute('data-id');
        item.style.display = (name.includes(keyword) || id.includes(keyword)) ? 'flex' : 'none';
    });
};
window.closeMemberManager = function() { document.getElementById('memberManagerModal').classList.add('hidden'); };

window.saveGroupMembers = async function() {
    const groupId = parseInt(document.getElementById('mm-group-id').value);
    const checkboxes = document.querySelectorAll('.group-member-cb');
    const btn = document.getElementById('btn-save-members');
    btn.innerText = "保存中..."; btn.disabled = true;

    const requests =[];
    checkboxes.forEach(cb => {
        const targetId = parseInt(cb.value);
        const currentGid = window.globalMappings[targetId] || 0;
        const shouldBeInGroup = cb.checked;
        if (shouldBeInGroup && currentGid !== groupId) {
            requests.push(fetch('/api/groups/assign', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({target_id: targetId, group_id: groupId})}));
        } else if (!shouldBeInGroup && currentGid === groupId) {
            requests.push(fetch('/api/groups/assign', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({target_id: targetId, group_id: 0})}));
        }
    });

    await Promise.all(requests);
    btn.innerText = "保存修改"; btn.disabled = false;
    closeMemberManager(); loadRelations(); 
};