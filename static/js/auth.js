const OPT_GENDERS = ["男", "女"];
const OPT_GRADES =["大一","大二","大三","大四","研一","研二","研三","博士"];
const OPT_MAJORS =["计算机","新闻","会计","美术","通信","医学","法学","土木","英语","生物","电气","体育"];
const OPT_HOBBIES =["绘画","编程","动漫","足球","羽毛球","音乐","天文","围棋","缝纫","骑行","剪纸","种植","机械","舞蹈","跑步"];
const OPT_TAGS =["社恐星人", "社交牛逼症", "社交普通型", "熬夜的神", "早睡早起", "作息规律", "高冷", "可爱", "温和", "吃货", "宅属性", "镇圈大佬", "段子手", "技术大牛", "运动达人"];
const OPT_SKILLS =["Python", "Java", "C++", "JavaScript", "TypeScript", "Go", "Rust", "机器学习", "深度学习", "NLP", "计算机视觉", "数据分析", "前端开发", "后端开发", "全栈开发", "移动开发", "UI设计", "产品策划", "项目管理", "嵌入式开发", "网络安全", "算法竞赛", "数学建模", "单片机", "电路设计"];

const QUESTIONNAIRE = [
    {
        id: 'social_scene',
        title: '你更愿意怎样认识新朋友？',
        type: 'single',
        required: true,
        options: [
            { value: 'one_on_one', label: '一对一慢慢熟悉', scores: { social: 35, openness: 45, communication: 70 } },
            { value: 'small_group', label: '小范围共同活动', scores: { social: 60, openness: 65, collaboration: 65 } },
            { value: 'public_event', label: '社团/比赛/活动现场', scores: { social: 85, openness: 80, collaboration: 60 } }
        ]
    },
    {
        id: 'team_role',
        title: '组队时你通常承担什么角色？',
        type: 'single',
        required: true,
        options: [
            { value: 'leader', label: '组织推进，主动协调', scores: { social: 75, collaboration: 85, learning: 65 } },
            { value: 'specialist', label: '负责核心技术或内容', scores: { collaboration: 70, learning: 85, communication: 55 } },
            { value: 'supporter', label: '配合补位，稳定执行', scores: { collaboration: 80, communication: 70, learning: 55 } }
        ]
    },
    {
        id: 'study_drive',
        title: '你当前最想匹配哪类同伴？',
        type: 'single',
        required: true,
        options: [
            { value: 'competition', label: '竞赛/科研/项目搭子', scores: { learning: 90, collaboration: 75, openness: 60 } },
            { value: 'daily_study', label: '自习/课程互助搭子', scores: { learning: 70, collaboration: 65, schedule: 70 } },
            { value: 'life_friend', label: '聊天/运动/兴趣朋友', scores: { social: 75, openness: 70, communication: 70 } }
        ]
    },
    {
        id: 'schedule',
        title: '你的作息和在线活跃时间更接近？',
        type: 'single',
        required: true,
        options: [
            { value: 'morning', label: '早睡早起，白天高效', scores: { schedule: 90, learning: 65 } },
            { value: 'stable', label: '比较规律，晚上也在线', scores: { schedule: 70, communication: 65 } },
            { value: 'night', label: '夜间活跃，灵感型选手', scores: { schedule: 35, openness: 60, learning: 60 } }
        ]
    },
    {
        id: 'conflict_style',
        title: '遇到分歧时你更倾向于？',
        type: 'single',
        required: true,
        options: [
            { value: 'direct', label: '直接沟通，快速定方案', scores: { communication: 80, collaboration: 70 } },
            { value: 'balance', label: '先听各方，再折中推进', scores: { communication: 75, collaboration: 85 } },
            { value: 'avoid', label: '减少冲突，私下慢慢调整', scores: { communication: 50, collaboration: 55, social: 35 } }
        ]
    },
    {
        id: 'activity_radius',
        title: '你愿意尝试陌生圈子的活动吗？',
        type: 'scale',
        required: true,
        minLabel: '只待熟悉圈',
        maxLabel: '非常愿意'
    },
    {
        id: 'introvert_contact',
        title: '如果你更慢热，哪种破冰方式压力最低？',
        type: 'single',
        followupFor: { id: 'social_scene', values: ['one_on_one'] },
        options: [
            { value: 'text_first', label: '先线上文字聊几句', scores: { communication: 75, social: 35 } },
            { value: 'common_task', label: '先做一个共同任务', scores: { collaboration: 75, learning: 65 } },
            { value: 'friend_intro', label: '通过共同好友介绍', scores: { social: 45, communication: 65 } }
        ]
    },
    {
        id: 'event_preference',
        title: '如果参加活动，你最偏好的形式是？',
        type: 'single',
        followupFor: { id: 'social_scene', values: ['small_group', 'public_event'] },
        options: [
            { value: 'sports', label: '运动/户外/线下局', scores: { social: 80, openness: 75 } },
            { value: 'workshop', label: '技术/学习/共创工作坊', scores: { learning: 80, collaboration: 75 } },
            { value: 'culture', label: '文艺/二次元/轻松兴趣局', scores: { openness: 80, communication: 70 } }
        ]
    }
];

window.QuestionnaireState = window.QuestionnaireState || {
    source: 'register',
    answers: {},
    currentIndex: 0
};

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
    updateRegisterQuestionnaireStatus();
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
    const questionnaire = { ...QuestionnaireState.answers };

    // 防止重复提交
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '注册中...';
    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');

    try {
        const body = { username, password, gender, grade, major, hobbies, tags, questionnaire };
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

window.openQuestionnaire = function(source = 'register') {
    QuestionnaireState.source = source;
    QuestionnaireState.currentIndex = 0;
    closeRegistrationOptions();
    Router.go('/questionnaire');
    setTimeout(renderQuestionnairePage, 0);
}

window.getActiveQuestionnaire = function() {
    return QUESTIONNAIRE.filter(q => {
        if (!q.followupFor) return true;
        const value = QuestionnaireState.answers[q.followupFor.id];
        return q.followupFor.values.includes(value);
    });
}

window.renderQuestionnairePage = function() {
    const page = document.getElementById('page-questionnaire');
    if (!page) return;
    const questions = getActiveQuestionnaire();
    if (QuestionnaireState.currentIndex >= questions.length) QuestionnaireState.currentIndex = questions.length - 1;
    if (QuestionnaireState.currentIndex < 0) QuestionnaireState.currentIndex = 0;
    const q = questions[QuestionnaireState.currentIndex];
    const progress = Math.round(((QuestionnaireState.currentIndex + 1) / questions.length) * 100);

    document.getElementById('questionnaireProgressBar').style.width = `${progress}%`;
    document.getElementById('questionnaireProgressText').textContent = `${QuestionnaireState.currentIndex + 1} / ${questions.length}`;
    document.getElementById('questionnaireTitle').textContent = q.title;
    document.getElementById('questionnaireHint').textContent = q.followupFor ? '这道题来自你前面的选择，用来细化匹配偏好。' : '选择最接近你的真实情况即可，后续推荐会用它做画像因子。';
    document.getElementById('questionnairePrevBtn').disabled = QuestionnaireState.currentIndex === 0;
    document.getElementById('questionnaireNextBtn').textContent = QuestionnaireState.currentIndex === questions.length - 1 ? '完成问卷' : '下一题';

    const body = document.getElementById('questionnaireBody');
    if (q.type === 'scale') {
        const current = QuestionnaireState.answers[q.id] || 3;
        body.innerHTML = `
            <div class="space-y-6">
                <div class="grid grid-cols-5 gap-2">
                    ${[1, 2, 3, 4, 5].map(n => `
                        <button type="button" onclick="answerQuestion('${q.id}', ${n})" class="h-16 rounded-2xl border text-lg font-bold transition ${current === n ? 'bg-amber-500 border-amber-500 text-stone-950 shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'}">${n}</button>
                    `).join('')}
                </div>
                <div class="flex justify-between text-xs text-white/45"><span>${q.minLabel}</span><span>${q.maxLabel}</span></div>
            </div>`;
    } else {
        const current = QuestionnaireState.answers[q.id];
        body.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                ${q.options.map(opt => `
                    <button type="button" onclick="answerQuestion('${q.id}', '${opt.value}')" class="min-h-24 rounded-2xl border p-4 text-left text-sm font-semibold leading-relaxed transition ${current === opt.value ? 'bg-amber-500 border-amber-500 text-stone-950 shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:border-white/30'}">
                        ${opt.label}
                    </button>
                `).join('')}
            </div>`;
    }

    const note = document.getElementById('questionnaireNote');
    note.value = QuestionnaireState.answers.self_description || '';
    updateQuestionnaireSummary();
}

window.answerQuestion = function(questionId, value) {
    QuestionnaireState.answers[questionId] = value;
    for (const q of QUESTIONNAIRE) {
        if (q.followupFor && q.followupFor.id === questionId && !q.followupFor.values.includes(value)) {
            delete QuestionnaireState.answers[q.id];
        }
    }
    renderQuestionnairePage();
}

window.nextQuestionnaireStep = async function() {
    const questions = getActiveQuestionnaire();
    const current = questions[QuestionnaireState.currentIndex];
    if (!QuestionnaireState.answers[current.id]) {
        Toast.info('先选择一个答案，再继续');
        return;
    }
    QuestionnaireState.answers.self_description = document.getElementById('questionnaireNote').value.trim().slice(0, 80);
    if (QuestionnaireState.currentIndex < questions.length - 1) {
        QuestionnaireState.currentIndex += 1;
        renderQuestionnairePage();
        return;
    }
    await finishQuestionnaire();
}

window.prevQuestionnaireStep = function() {
    QuestionnaireState.answers.self_description = document.getElementById('questionnaireNote').value.trim().slice(0, 80);
    QuestionnaireState.currentIndex -= 1;
    renderQuestionnairePage();
}

window.skipQuestionnaire = function() {
    QuestionnaireState.answers.self_description = document.getElementById('questionnaireNote')?.value.trim().slice(0, 80) || QuestionnaireState.answers.self_description;
    if (QuestionnaireState.source === 'profile') {
        Router.go('/dashboard');
        setTimeout(() => switchMenu('profile'), 0);
    } else {
        Router.go('/auth');
        setTimeout(() => {
            switchAuthTab('register');
            showRegistrationOptions();
        }, 0);
    }
}

window.finishQuestionnaire = async function() {
    if (QuestionnaireState.source === 'profile') {
        try {
            const res = await fetch('/api/questionnaire/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ questionnaire: QuestionnaireState.answers })
            });
            const data = await res.json();
            if (data.status !== 'success') throw new Error(data.message || '保存失败');
            Toast.success('画像问卷已更新');
            Router.go('/dashboard');
            setTimeout(() => switchMenu('profile'), 0);
        } catch (e) {
            Toast.error(e.message || '保存失败');
        }
        return;
    }
    Toast.success('问卷已保存，注册时会生成画像');
    skipQuestionnaire();
}

window.updateRegisterQuestionnaireStatus = function() {
    const count = Object.keys(QuestionnaireState.answers).filter(k => k !== 'self_description').length;
    const status = document.getElementById('reg-questionnaire-status');
    const btn = document.getElementById('reg-questionnaire-btn');
    if (!status || !btn) return;
    status.textContent = count ? `已填写 ${count} 项，注册后将生成画像分` : '可选填写，用于提升初始推荐质量';
    btn.textContent = count ? '修改画像问卷' : '填写画像问卷';
}

window.updateQuestionnaireSummary = function() {
    const summary = document.getElementById('questionnaireSummary');
    if (!summary) return;
    const activeAnswers = Object.keys(QuestionnaireState.answers).filter(k => k !== 'self_description').length;
    summary.textContent = activeAnswers ? `已记录 ${activeAnswers} 个画像因子` : '尚未记录画像因子';
}
