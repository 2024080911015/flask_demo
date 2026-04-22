// ==========================================
//  面板 3：个人空间 (逻辑重构版)
// ==========================================

// 1. 切换编辑模式
window.toggleProfileEdit = function(isEditing) {
    const displayView = document.getElementById('profile-display-view');
    const editView = document.getElementById('profile-edit-view');
    if (displayView && editView) {
        displayView.classList.toggle('hidden', isEditing);
        editView.classList.toggle('hidden', !isEditing);
    }
};

// 2. 渲染选项 (用于编辑模式下的勾选框)
window.renderProfileOptions = function(containerId, list, inputName, isMulti, selectedVals) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = list.map(item => `
        <label class="cursor-pointer">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="${inputName}" value="${item}" 
                ${selectedVals.includes(item) ? 'checked' : ''} class="hidden peer">
            <span class="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 
                peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 
                text-xs font-semibold transition inline-block mb-2 mr-2">
                ${item}
            </span>
        </label>
    `).join('');
};

// 3. 核心：加载个人资料
window.loadProfile = async function() {
    if (!State.user) return;

    try {
        const res = await fetch(`/user?id=${State.user.uid}&t=${Date.now()}`);
        const data = await res.json();
        
        // --- A. 顶部展示区同步 ---
        document.getElementById('profileUid').innerText = State.user.uid;
        document.getElementById('prof-display-name').innerText = data.username;
        document.getElementById('prof-display-signature').innerText = data.signature || "这个人很懒，什么都没留下";
        document.getElementById('prof-display-status').innerText = data.status || "找朋友";
        
        // 🚀 核心修复：使用全局 State 方法加载头像
        const avatarEl = document.getElementById('profileAvatar');
        if (avatarEl) {
            // 先重置样式
            avatarEl.innerText = data.username.charAt(0).toUpperCase();
            avatarEl.style.backgroundImage = 'none';
            // 尝试加载真实头像
            await State.loadAvatar(State.user.uid, 'profileAvatar');
        }

        // --- B. 标签展示同步 ---
        const tags = parseInfoTags(data.student_info);
        document.getElementById('prof-info-tags').innerHTML = tags.basic + tags.hobbies;

        // --- C. 编辑表单预填充 ---
        document.getElementById('prof-username').value = data.username;
        document.getElementById('prof-signature').value = data.signature || "";
        document.getElementById('prof-status').value = data.status || "找朋友";

        const infoMap = {};
        (data.student_info || "").split(',').forEach(p => {
            const [k, v] = p.split(':'); if(k && v) infoMap[k] = v;
        });

        document.getElementById('prof-gender').value = infoMap['性别'] || '男';
        
        // 预设选项 (从全局变量读取，确保 auth.js 已加载)
        if (typeof OPT_GRADES !== 'undefined') {
            document.getElementById('prof-grade').innerHTML = OPT_GRADES.map(g => 
                `<option value="${g}" ${infoMap['年级']===g?'selected':''}>${g}</option>`).join('');
            document.getElementById('prof-major').innerHTML = OPT_MAJORS.map(m => 
                `<option value="${m}" ${infoMap['专业']===m?'selected':''}>${m}</option>`).join('');

            renderProfileOptions('prof-hobbies-container', OPT_HOBBIES, 'prof_hobbies', true, (infoMap['爱好'] || "").split(' '));
            renderProfileOptions('prof-tags-container', OPT_TAGS, 'prof_tags', true, (infoMap['标签'] || "").split(' '));
        }

    } catch(e) { 
        console.error("加载个人资料失败", e); 
    }
};

// 4. 保存资料修改
window.saveProfile = async function() {
    const username = document.getElementById('prof-username').value.trim();
    const signature = document.getElementById('prof-signature').value.trim();
    const status = document.getElementById('prof-status').value;
    
    // 构建 info 字符串
    const gender = document.getElementById('prof-gender').value;
    const grade = document.getElementById('prof-grade').value;
    const major = document.getElementById('prof-major').value;
    const hobbies = Array.from(document.querySelectorAll('input[name="prof_hobbies"]:checked')).map(n => n.value).join(' ');
    const tags = Array.from(document.querySelectorAll('input[name="prof_tags"]:checked')).map(n => n.value).join(' ');

    const info = `性别:${gender},年级:${grade},专业:${major},爱好:${hobbies},标签:${tags}`;

    try {
        const res = await fetch('/api/user/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, signature, status, info })
        });
        const data = await res.json();
        
        if(data.status === 'success') {
            State.user.username = username; // 同步全局名字
            document.getElementById('dashUsername').textContent = username;
            
            await loadProfile(); // 重新拉取一次数据
            toggleProfileEdit(false); // 回到展示态
            if (window.Toast) Toast.success("资料更新成功！");
        } else {
            if (window.Toast) Toast.error(data.message);
        }
    } catch(e) { 
        if (window.Toast) Toast.error('保存失败'); 
    }
};

// 5. 核心：头像上传逻辑
window.uploadAvatar = async function() {
    const fileInput = document.getElementById('avatarInput');
    const file = fileInput.files[0];
    if (!file) return;

    // 格式检查
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        if (window.Toast) Toast.error('只支持 PNG/JPG/WEBP 格式');
        return;
    }

    const formData = new FormData(); 
    formData.append('avatar', file);

    // 显示加载态
    const avatarEl = document.getElementById('profileAvatar');
    const originalContent = avatarEl.innerHTML;
    avatarEl.innerHTML = '<span class="text-xs animate-spin">⌛</span>';

    try {
        const response = await fetch('/api/user/upload_avatar', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.status === 'success') {
            if (window.Toast) Toast.success('头像上传成功');
            
            // 🚀 核心动作：强制触发全局头像刷新
            // 刷新个人空间大头像
            await State.loadAvatar(State.user.uid, 'profileAvatar');
            // 刷新左侧边栏小头像
            await State.loadAvatar(State.user.uid, 'avatarInitial');
        } else {
            if (window.Toast) Toast.error(data.message);
            avatarEl.innerHTML = originalContent;
        }
    } catch (error) { 
        if (window.Toast) Toast.error('上传失败');
        avatarEl.innerHTML = originalContent;
    } finally {
        fileInput.value = ''; // 清空选择器，允许重复上传同一张图
    }
};