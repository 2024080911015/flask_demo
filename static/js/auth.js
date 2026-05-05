const OPT_GENDERS = ["男", "女"];
const OPT_GRADES =["大一","大二","大三","大四","研一","研二","研三","博士"];
const OPT_MAJORS =["计算机","新闻","会计","美术","通信","医学","法学","土木","英语","生物","电气","体育"];
const OPT_HOBBIES =["绘画","编程","动漫","足球","羽毛球","音乐","天文","围棋","缝纫","骑行","剪纸","种植","机械","舞蹈","跑步"];
const OPT_TAGS =["社恐星人", "社交牛逼症", "社交普通型", "熬夜的神", "早睡早起", "作息规律", "高冷", "可爱", "温和", "吃货", "宅属性", "镇圈大佬", "段子手", "技术大牛", "运动达人"];

window.switchAuthTab = function(tab) {
    const isLogin = tab === 'login';
    document.getElementById('authForm-login').classList.toggle('hidden-form', !isLogin);
    document.getElementById('authForm-register').classList.toggle('hidden-form', isLogin);
    document.getElementById('authTab-login').classList.toggle('on', isLogin);
    document.getElementById('authTab-register').classList.toggle('on', !isLogin);
}

window.doLogin = async function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error'); errEl.classList.add('hidden');
    if (!username || !password) { errEl.textContent = '不能为空'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (data.status === 'success') { State.setUser(data.data); Router.go('/dashboard'); } 
        else { errEl.textContent = data.message; errEl.classList.remove('hidden'); }
    } catch { errEl.textContent = '网络错误'; errEl.classList.remove('hidden'); }
}

window.showRegistrationOptions = function() {
    const u = document.getElementById('reg-username').value.trim();
    const p = document.getElementById('reg-password').value;
    const err = document.getElementById('reg-error');
    if(!u || !p) { err.textContent='请先填写账号密码'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');
    renderOptions('reg-gender-options', OPT_GENDERS, 'reg_gender');
    renderOptions('reg-grade-options', OPT_GRADES, 'reg_grade');
    renderOptions('reg-major-options', OPT_MAJORS, 'reg_major');
    renderOptions('reg-hobbies-options', OPT_HOBBIES, 'reg_hobbies', true);
    renderOptions('reg-tags-options', OPT_TAGS, 'reg_tags', true);
    document.getElementById('registrationOptionsModal').classList.remove('hidden');
}

window.closeRegistrationOptions = function() { document.getElementById('registrationOptionsModal').classList.add('hidden'); }

window.confirmRegistration = async function() {
    const sucEl = document.getElementById('reg-options-success');
    const errEl = document.getElementById('reg-options-error');
    const btn = document.querySelector('#registrationOptionsModal .confirm-btn');
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const gender = document.querySelector('input[name="reg_gender"]:checked')?.value || "未知";
    const grade = document.querySelector('input[name="reg_grade"]:checked')?.value || "大一";
    const major = document.querySelector('input[name="reg_major"]:checked')?.value || "计算机";
    const hobbies = Array.from(document.querySelectorAll('input[name="reg_hobbies"]:checked')).map(n => n.value).join(' ') || "无";
    const tags = Array.from(document.querySelectorAll('input[name="reg_tags"]:checked')).map(n => n.value).join(' ') || "无标签";

    // 防止重复提交
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '注册中...';
    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');

    try {
        const body = { username, password, gender, grade, major, hobbies, tags };
        const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.status === 'success') {
            sucEl.textContent = '注册成功！跳转中...'; sucEl.classList.remove('hidden');
            setTimeout(() => { closeRegistrationOptions(); switchAuthTab('login'); document.getElementById('login-username').value = username; }, 1500);
        } else {
            errEl.textContent = data.message || '注册失败，请重试';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = '确认注册并生成社交档案';
        }
    } catch (e) {
        errEl.textContent = '网络错误，请检查连接后重试';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '确认注册并生成社交档案';
    }
}

window.doLogout = async function() {
    await fetch('/api/auth/logout', { method: 'POST' });
    State.user = null; State.isAdmin = false; Router.go('/');
}

window.renderOptions = function(containerId, list, inputName, isMulti = false) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = list.map(item => `
        <label class="cursor-pointer">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="${inputName}" value="${item}" class="hidden peer">
            <span class="px-3 py-1.5 rounded-lg border border-white/20 text-white/60 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 text-xs transition">${item}</span>
        </label>`).join('');
}