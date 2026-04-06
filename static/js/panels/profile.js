// ==========================================
//  面板 3：个人空间 (修改资料与头像)
// ==========================================
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
        const res = await fetch(`/user?id=${State.user.uid}`);
        const data = await res.json();
        document.getElementById('profileUid').innerText = State.user.uid;
        document.getElementById('prof-username').value = State.user.username;
        document.getElementById('profileAvatar').innerText = State.user.username.charAt(0).toUpperCase();
        document.getElementById('prof-display-name').innerText = State.user.username;

        if (data.avatar) {
            const avatarEl = document.getElementById('profileAvatar');
            avatarEl.style.backgroundImage = `url(/static/avatars/${data.avatar})`;
            avatarEl.style.backgroundSize = 'cover'; avatarEl.style.backgroundPosition = 'center';
            avatarEl.innerText = '';
        }

        const infoMap = {};
        (data.student_info || "").split(',').forEach(p => {
            const[k, v] = p.split(':'); if(k && v) infoMap[k] = v;
        });

        document.getElementById('prof-gender').value = infoMap['性别'] || '男';
        // (假设这些数组在 auth.js 里已经定义为全局)
        document.getElementById('prof-grade').innerHTML = OPT_GRADES.map(g => `<option value="${g}" ${infoMap['年级']===g?'selected':''}>${g}</option>`).join('');
        document.getElementById('prof-major').innerHTML = OPT_MAJORS.map(m => `<option value="${m}" ${infoMap['专业']===m?'selected':''}>${m}</option>`).join('');

        const myHobbies = (infoMap['爱好'] || "").split(' ');
        const myTags = (infoMap['标签'] || "").split(' ');

        renderProfileOptions('prof-hobbies-container', OPT_HOBBIES, 'prof_hobbies', true, myHobbies);
        renderProfileOptions('prof-tags-container', OPT_TAGS, 'prof_tags', true, myTags);
    } catch(e) {}
};

window.saveProfile = async function() {
    const username = document.getElementById('prof-username').value.trim();
    const gender = document.getElementById('prof-gender').value;
    const grade = document.getElementById('prof-grade').value;
    const major = document.getElementById('prof-major').value;

    const hobbies = Array.from(document.querySelectorAll('input[name="prof_hobbies"]:checked')).map(n => n.value).join(' ') || "无";
    const tags = Array.from(document.querySelectorAll('input[name="prof_tags"]:checked')).map(n => n.value).join(' ') || "无标签";

    const info = `性别:${gender},年级:${grade},专业:${major},爱好:${hobbies},标签:${tags}`;

    try {
        const res = await fetch('/api/user/update', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, info })
        });
        const data = await res.json();
        alert(data.message);
        if(data.status === 'success') {
            State.user.username = username;
            document.getElementById('dashUsername').textContent = username;
            document.getElementById('profileAvatar').innerText = username.charAt(0).toUpperCase();
            document.getElementById('avatarInitial').innerText = username.charAt(0).toUpperCase();
            document.getElementById('prof-display-name').innerText = username;
        }
    } catch(e) { alert('保存失败'); }
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