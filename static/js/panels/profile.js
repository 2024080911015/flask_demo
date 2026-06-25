// ==========================================
//  面板 3：个人空间 (修改资料与头像)
// ==========================================

window.toggleProfileEdit = function(isEditing) {
    document.getElementById('profile-display-view').classList.toggle('hidden', isEditing);
    document.getElementById('profile-edit-view').classList.toggle('hidden', !isEditing);
};
window.renderProfileOptions = function(containerId, list, inputName, isMulti, selectedVals) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = list.map(item => `
        <label class="cursor-pointer">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="${inputName}" value="${item}" ${selectedVals.includes(item) ? 'checked' : ''} class="hidden peer">
            <span class="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 text-xs font-semibold transition inline-block mb-2 mr-2">${item}</span>
        </label>
    `).join('');
};

window.loadProfile = async function() {
    try {
        const [res, compRes] = await Promise.all([
            fetch(`/user?id=${State.user.uid}&t=${Date.now()}`),
            fetch(`/api/user/competitions?uid=${State.user.uid}&t=${Date.now()}`)
        ]);
        const data = await res.json();
        const compData = await compRes.json();
        window.currentProfileInfo = data.student_info || "";

        // 1. 同步顶部基础信息
        document.getElementById('profileUid').innerText = State.user.uid;
        document.getElementById('prof-display-name').innerText = data.username;
        document.getElementById('prof-display-signature').innerText = data.signature || "未设置签名";
        document.getElementById('prof-display-status').innerText = data.status || "找朋友";

        // 2. 处理标签展示
        const tags = parseInfoTags(data.student_info);
        document.getElementById('prof-info-tags').innerHTML = tags.basic + tags.hobbies;

        // 🆕 技能标签展示
        const skillsDisplay = document.getElementById('prof-skills-display');
        if (skillsDisplay) {
            skillsDisplay.innerHTML = tags.skills || '<span class="text-stone-300 text-xs italic">尚未设置技能标签</span>';
        }

        // 🆕 竞赛经历展示
        const compList = document.getElementById('prof-comp-list');
        if (compList && compData.data) {
            if (compData.data.length === 0) {
                compList.innerHTML = '<p class="text-stone-300 text-xs italic py-2">暂无竞赛经历，快去组队大厅参加比赛吧！</p>';
            } else {
                compList.innerHTML = compData.data.map(c => `
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-100 shadow-sm group">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <div class="w-8 h-8 rounded-lg ${c.type === 'ongoing' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center text-xs font-bold shrink-0">${c.type === 'ongoing' ? '🚀' : '🏆'}</div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-stone-700 truncate">${c.competition_name}</p>
                                <p class="text-xs text-stone-400">${c.role} · ${c.year}${c.description ? ' · ' + c.description : ''}</p>
                            </div>
                        </div>
                        ${c.type === 'experience' ? `<button onclick="deleteCompetition(${c.id})" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg transition shrink-0">删除</button>` : ''}
                    </div>
                `).join('');
            }
        }

        // 3. 填充编辑表单
        document.getElementById('prof-username').value = data.username;
        document.getElementById('prof-signature').value = data.signature || "";
        document.getElementById('prof-status').value = data.status || "找朋友";

        const infoMap = {};
        (data.student_info || "").split(',').forEach(p => {
            const[k, v] = p.split(':'); if(k && v) infoMap[k] = v;
        });

        document.getElementById('prof-gender').value = infoMap['性别'] || '男';
        document.getElementById('prof-grade').innerHTML = OPT_GRADES.map(g => `<option value="${g}" ${infoMap['年级']===g?'selected':''}>${g}</option>`).join('');
        document.getElementById('prof-major').innerHTML = OPT_MAJORS.map(m => `<option value="${m}" ${infoMap['专业']===m?'selected':''}>${m}</option>`).join('');

        renderProfileOptions('prof-hobbies-container', OPT_HOBBIES, 'prof_hobbies', true, (infoMap['爱好'] || "").split(' '));
        renderProfileOptions('prof-tags-container', OPT_TAGS, 'prof_tags', true, (infoMap['标签'] || "").split(' '));
        // 🆕 技能标签编辑区
        renderProfileOptions('prof-skills-container', OPT_SKILLS, 'prof_skills', true, (infoMap['技能'] || "").split(' '));

    } catch(e) { console.error("加载个人资料失败", e); }
};


window.saveProfile = async function() {
    const username = document.getElementById('prof-username').value.trim();
    const signature = document.getElementById('prof-signature').value.trim();
    const status = document.getElementById('prof-status').value;
    
    const preservedProfileParts = (window.currentProfileInfo || "")
        .split(',')
        .filter(p => p.startsWith('画像分:') || p.startsWith('社交倾向:') || p.startsWith('自述:'));
    const skillsVal = Array.from(document.querySelectorAll('input[name="prof_skills"]:checked')).map(n => n.value).join(' ');
    const info = [
        `性别:${document.getElementById('prof-gender').value}`,
        `年级:${document.getElementById('prof-grade').value}`,
        `专业:${document.getElementById('prof-major').value}`,
        `爱好:${Array.from(document.querySelectorAll('input[name="prof_hobbies"]:checked')).map(n => n.value).join(' ')}`,
        `标签:${Array.from(document.querySelectorAll('input[name="prof_tags"]:checked')).map(n => n.value).join(' ')}`,
        `技能:${skillsVal}`,
        ...preservedProfileParts
    ].join(',');

    try {
        const res = await fetch('/api/user/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, signature, status, info })
        });
        const data = await res.json();
        if(data.status === 'success') {
            State.setUser({ ...State.user, username: username }); // 同步全局状态
            await loadProfile(); // 重新加载数据
            toggleProfileEdit(false); // 回到展示态
            Toast.success("资料更新成功！");
        } else {
            Toast.error(data.message);
        }
    } catch(e) { Toast.error('保存失败'); }
};

// 🆕 竞赛经历管理
window.addCompetition = async function() {
    const name = (document.getElementById('comp-name')?.value || '').trim();
    const role = (document.getElementById('comp-role')?.value || '队员').trim();
    const year = (document.getElementById('comp-year')?.value || '').trim();
    const desc = (document.getElementById('comp-desc')?.value || '').trim();

    if (!name) { Toast.error('请输入竞赛名称'); return; }
    if (!year) { Toast.error('请输入参赛年份'); return; }

    try {
        const res = await fetch('/api/user/competitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competition_name: name, role, year, description: desc })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Toast.success('竞赛经历已添加');
            // 清空表单
            document.getElementById('comp-name').value = '';
            document.getElementById('comp-role').value = '队员';
            document.getElementById('comp-year').value = '';
            document.getElementById('comp-desc').value = '';
            loadProfile(); // 刷新展示
        } else {
            Toast.error(data.message);
        }
    } catch (e) { Toast.error('添加失败'); }
};

window.deleteCompetition = async function(expId) {
    if (!confirm('确定删除这条竞赛经历吗？')) return;
    try {
        const res = await fetch(`/api/user/competitions/${expId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            Toast.success('已删除');
            loadProfile();
        } else {
            Toast.error(data.message);
        }
    } catch (e) { Toast.error('删除失败'); }
};

window.uploadAvatar = async function() {
    const fileInput = document.getElementById('avatarInput');
    const file = fileInput.files[0];
    if (!file) return;

    const allowedTypes =['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return alert('不支持的文件格式');
    if (file.size > 5 * 1024 * 1024) return alert('文件过大，最大支持 5MB');

    const formData = new FormData(); formData.append('avatar', file);

    try {
        const response = await fetch('/api/user/upload_avatar', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.status === 'success') {
            alert('✅ ' + data.message);
            const avatarEl = document.getElementById('profileAvatar');
            avatarEl.style.backgroundImage = `url(/static/avatars/${data.avatar}?uid=${State.user.uid}&t=${Date.now()})`;
            avatarEl.style.backgroundSize = 'cover'; avatarEl.style.backgroundPosition = 'center';
            avatarEl.innerText = '';
            State.loadAvatar(State.user.uid, 'avatarInitial');
        } else { alert('❌ ' + data.message); }
    } catch (error) { alert('上传失败: ' + error.message); }
};
