// START OF FILE: static/js/panels/activity.js

// ✨ 全量十二大学科门类顶级赛事数据字典
const CATEGORY_MAP = {
    "01 哲学门类": [
        "约翰·洛克学术论文竞赛（哲学赛道）", "国际哲学奥林匹克 IPO", "全国高校哲学专业论文征文大赛",
        "全国大学生人文社科经典研读大赛", "“挑战杯”全国大学生课外学术科技作品竞赛（哲学社科论文赛道）",
        "全国马克思主义哲学研习论文大赛", "全国大学生哲学思辨辩论赛", "其他哲学类科研与创新项目"
    ],
    "02 经济学门类": [
        "NEC全美经济学挑战赛", "IEO国际经济学奥林匹克", "全国大学生市场调查与分析大赛",
        "全国高校商业精英挑战赛（国贸/会计/金融赛道）", "全国大学生金融创新大赛", "全国大学生模拟炒股大赛",
        "全国经济决策虚拟仿真实验大赛", "“三创赛”全国大学生电子商务创新创意创业挑战赛",
        "全国大学生财税技能大赛", "全国高校外贸从业能力大赛", "全国金融建模与量化投资大赛",
        "正大杯全国大学生市场调查大赛", "其他经济学类科研与创新项目"
    ],
    "03 法学门类": [
        "杰赛普（Jessup）国际模拟法庭竞赛", "红十字国际人道法模拟法庭", "全国大学生法律职业能力竞赛（演讲、文书、辩论）",
        "“理律杯”全国高校模拟法庭大赛", "“天伦杯”全国政法院校辩论赛", "全国大学生社会治理调研大赛",
        "全国马克思主义理论专业本科生学术论坛暨论文竞赛", "全国公安院校技能大赛", "全国大学生社会学调研大赛",
        "“中欧杯”涉外法治人才大赛", "全国大学生禁毒知识竞赛", "其他法学社科类科研与创新项目"
    ],
    "04 教育学门类": [
        "全国师范生教学技能大赛", "全国高校微课教学比赛", "全国大学生教育创新大赛",
        "全国学前教育专业技能大赛", "全国心理健康教育教学大赛", "全国大学生教研论文竞赛",
        "CUBA中国大学生篮球联赛", "CUFL中国大学生足球联赛", "全国高校体育教育专业基本功大赛",
        "全国大学生运动康复技能大赛", "全国体育产业创新创业大赛", "全国大学生田径锦标赛、游泳锦标赛",
        "其他教育/体育类科研与创新项目"
    ],
    "05 文学门类": [
        "全国大学生作文征文大赛", "全国经典诵读大赛", "全国汉语言文字基本功大赛", "全国创意写作大赛",
        "“外研社·国才杯”英语演讲/写作/阅读大赛", "全国大学生英语竞赛（NECCS）",
        "全国翻译专业资格大赛、海伦·斯诺翻译大赛", "多语种（日/韩/西/法）专业技能大赛", "全国大学生口译大赛",
        "全国大学生广告艺术大赛（大广赛）", "全国大学生新媒体创意大赛", "全国大学生纪录片创作大赛",
        "“未来记者”全国新闻采编大赛", "全国短视频创意大赛", "其他文学传媒类科研与创新项目"
    ],
    "06 历史学门类": [
        "励耘杯全国历史学本科生论文竞赛", "NHD国际历史竞赛", "TCR世界历史论文挑战赛",
        "全国大学生历史文化讲解大赛", "全国文博知识竞赛", "全国历史文物复原创意大赛", "其他历史类科研与创新项目"
    ],
    "07 理学门类": [
        "全国大学生数学竞赛（CMC）", "全国大学生数学建模竞赛（国赛）", "美国大学生数学建模竞赛（MCM/ICM）",
        "全国统计建模大赛", "全国大数据统计分析大赛", "全国大学生物理实验竞赛", "周培源大学生力学竞赛",
        "全国大学生物理设计大赛", "全国大学生化学实验创新设计竞赛", "全国大学生化工原理实验大赛",
        "全国大学生生命科学竞赛", "BBO国际生物奥林匹克", "全国大学生心理学知识与技能大赛",
        "全国地理科学野外实践大赛", "全国大气/海洋科学创新竞赛", "全国天文观测大赛", "其他理学类科研与创新项目"
    ],
    "08 工学门类": [
        "全国大学生电子设计竞赛（电赛）", "蓝桥杯全国软件和信息技术专业人才大赛", "全国大学生智能汽车竞赛",
        "全国大学生机械创新设计大赛", "全国大学生结构设计竞赛（土木）", "全国大学生节能减排社会实践与科技竞赛",
        "全国嵌入式芯片与系统设计竞赛", "全国大学生自动化大赛", "全国大学生测绘技能大赛",
        "全国大学生化工设计竞赛", "全国新材料创新大赛", "全国交通运输科技大赛", "全国航空航天模型锦标赛",
        "全国机器人竞赛（ROBOCON/ROBOMASTER）", "全国水利创新设计大赛", "全国纺织创意大赛",
        "全国生物医学工程创新大赛", "其他工科类科研与创新项目"
    ],
    "09 农学门类": [
        "全国农科学子创新创业大赛", "全国大学生智慧农业创新大赛", "全国动物医学技能大赛",
        "全国水产养殖创新设计大赛", "全国林学技能竞赛", "全国乡村振兴科技强农大赛",
        "全国园艺植物栽培大赛", "全国生态环境修复创意大赛", "其他农学类科研与创新项目"
    ],
    "10 医学门类": [
        "全国大学生基础医学创新研究暨实验设计论坛（国赛）", "全国高等医学院校临床技能大赛", "全国口腔医学技能操作大赛",
        "全国中医药院校技能大赛", "全国药学/中药学专业技能大赛", "全国护理专业技能大赛",
        "全国公共卫生预防医学竞赛", "全国医学生科普演讲大赛", "全国法医技能大赛",
        "全国医学检验技术大赛", "其他医学类科研与创新项目"
    ],
    "12 管理学门类": [
        "全国企业竞争模拟大赛（沙盘经营）", "全国高校商业精英挑战赛", "全国大学生电子商务“三创”挑战赛",
        "全国公共管理案例大赛", "全国大学生物流设计大赛", "全国旅游管理专业技能大赛",
        "全国图书情报案例分析大赛", "全国会计技能大赛、财务管理大赛", "全国工业工程改善创意大赛",
        "其他管理商科类科研与创新项目"
    ],
    "13 艺术学门类": [
        "NCDA未来设计师·全国高校数字艺术设计大赛", "全国大学生艺术展演活动（声乐、器乐、美术、戏剧）",
        "米兰设计周中国高校设计学科师生优秀作品展", "中国好创意暨全国数字艺术大赛", "大广赛（艺术设计赛道）",
        "全国大学生舞蹈大赛、声乐大赛", "全国戏剧影视表演大赛、微电影大赛", "全国美术作品大赛、插画设计大赛",
        "全国环境设计、视觉传达创意大赛", "其他艺术类科研与创新项目"
    ],
    "全学科通用顶级赛事": [
        "“挑战杯”：大挑（课外学术科技作品）、小挑（创业计划竞赛）",
        "中国国际大学生创新大赛（原“互联网+”大学生创新创业大赛）",
        "全国大学生创新创业训练计划（大创）优秀成果路演赛",
        "跨学科自主创业/科研综合项目"
    ]
};

const originalOpenUserModal = window.openUserModal;
window.openUserModal = function(id) {
    if (originalOpenUserModal) originalOpenUserModal(id);
    const userModal = document.getElementById('userProfileModal');
    if (userModal) userModal.style.zIndex = "200"; 
};

window.switchActivityTab = function(tab) {
    const tabs = ['hall', 'create', 'manage'];
    tabs.forEach(t => {
        const sub = document.getElementById(`act-sub-${t}`);
        if(sub) sub.classList.add('hidden');
        
        const btn = document.getElementById(`tab-act-${t}`);
        if(btn) {
            btn.classList.remove('act-tab-active', 'bg-white', 'shadow-sm', 'text-amber-700');
            btn.classList.add('text-stone-500');
        }
    });

    const activeSub = document.getElementById(`act-sub-${tab}`);
    if(activeSub) activeSub.classList.remove('hidden');
    
    const activeBtn = document.getElementById(`tab-act-${tab}`);
    if(activeBtn) activeBtn.classList.add('act-tab-active', 'bg-white', 'shadow-sm', 'text-amber-700');

    const filterBar = document.getElementById('act-filter-bar');
    if (filterBar) {
        if (tab === 'hall') filterBar.classList.remove('hidden');
        else filterBar.classList.add('hidden');
    }

    if (tab === 'hall') loadActivityHall();
    if (tab === 'manage') loadManagement();
    if (tab === 'create') {
        updateCreateCategory();
        const countInput = document.getElementById('required-member-count');
        if (countInput) countInput.value = 1;
        const slotsContainer = document.getElementById('slots-container');
        if (slotsContainer) slotsContainer.innerHTML = '';
        generateTeamSlots();
    }
};

window.updateCreateCategory = function() {
    const direction = document.getElementById('create-direction').value;
    const catSelect = document.getElementById('create-category');
    if(!catSelect) return;
    catSelect.innerHTML = '';
    if (direction && CATEGORY_MAP[direction]) {
        CATEGORY_MAP[direction].forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
    }
};

window.updateFilterCategory = function() {
    const direction = document.getElementById('filter-direction').value;
    const catSelect = document.getElementById('filter-category');
    if(!catSelect) return;
    catSelect.innerHTML = '<option value="">全部具体方向</option>';
    if (direction && CATEGORY_MAP[direction]) {
        CATEGORY_MAP[direction].forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
    }
};

window.generateTeamSlots = function() {
    const countInput = document.getElementById('required-member-count');
    if(!countInput) return;
    let count = parseInt(countInput.value) || 1;
    if (count < 1) { count = 1; countInput.value = 1; }
    if (count > 20) { count = 20; countInput.value = 20; }

    const container = document.getElementById('slots-container');
    if(!container) return;
    const currentSlots = container.querySelectorAll('.team-slot-item');
    const currentCount = currentSlots.length;

    if (count > currentCount) {
        for (let i = 0; i < count - currentCount; i++) {
            const slotId = Date.now() + i; 
            const html = `
                <div class="team-slot-item relative bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col gap-3 animate-fade-in" id="slot-${slotId}">
                    <div class="absolute right-4 top-4 text-stone-400 text-xs font-bold tracking-widest slot-badge">岗位</div>
                    <div class="grid grid-cols-2 gap-4 pr-16">
                        <input type="text" class="s-role px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="岗位名称 (例: 算法核心)">
                        <input type="text" class="s-major px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="专业要求 (例: 计科 / 不限)">
                    </div>
                    <input type="text" class="s-skill px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="岗位详情 (例: 熟练使用 Python)">
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        }
    } else if (count < currentCount) {
        for (let i = 0; i < currentCount - count; i++) {
            container.removeChild(container.lastElementChild);
        }
    }
    
    const updatedSlots = container.querySelectorAll('.team-slot-item');
    updatedSlots.forEach((el, index) => {
        const badge = el.querySelector('.slot-badge');
        if (badge) badge.innerText = `${index + 1}号岗位`;
    });
};

window.handleCreateActivity = async function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const slots = [];
    document.querySelectorAll('.team-slot-item').forEach(el => {
        const role = el.querySelector('.s-role').value.trim();
        const major = el.querySelector('.s-major').value.trim();
        const skill = el.querySelector('.s-skill').value.trim();
        
        slots.push({
            role: role || '综合成员',
            major_required: major || '专业不限',
            skill: skill || '无特别描述，态度积极即可'
        });
    });

    if (slots.length === 0) {
        if (typeof Toast !== 'undefined') Toast.error("招募人数不能为 0！");
        else alert("招募人数不能为 0！");
        return;
    }

    const data = {
        team_name: formData.get('team_name'),
        nature: formData.get('nature'),
        subject_direction: formData.get('subject_direction'),
        category: formData.get('category'),
        description: formData.get('description'),
        deadline: formData.get('deadline'),
        team_slots: slots 
    };

    try {
        const res = await fetch('/api/activity/create', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        const resData = await res.json();
        if(resData.status === 'success') {
            if (typeof Toast !== 'undefined') Toast.success("发布成功！");
            else alert("发布成功！");
            e.target.reset();
            const countInput = document.getElementById('required-member-count');
            if(countInput) countInput.value = 1;
            const slotsContainer = document.getElementById('slots-container');
            if (slotsContainer) slotsContainer.innerHTML = ''; 
            generateTeamSlots();
            switchActivityTab('manage');
        } else {
            if (typeof Toast !== 'undefined') Toast.error(resData.message);
            else alert(resData.message);
        }
    } catch(e) { alert("发布失败，网络错误"); }
};

window.loadActivityHall = async function() {
    const container = document.getElementById('act-sub-hall');
    if (!container) return;
    container.innerHTML = `<div class="col-span-full py-20 text-center text-stone-300">正在进行 GNN 认知演算...</div>`;
    
    let queryParams = "";
    const filterKeyword = document.getElementById('filter-keyword');
    if (filterKeyword) {
        queryParams = new URLSearchParams({ 
            keyword: filterKeyword.value, 
            nature: document.getElementById('filter-nature').value, 
            category: document.getElementById('filter-category').value 
        }).toString();
    }

    try {
        const res = await fetch(`/api/activity/list?${queryParams}`);
        const data = await res.json();
        if (data.status !== 'success') throw new Error();
        
        container.innerHTML = '';
        if (data.data.length === 0) {
            container.innerHTML = '<div class="col-span-full py-20 text-center text-stone-300 border-2 border-dashed border-stone-200 rounded-[2rem]">未找到匹配的项目，快去发起一个吧！</div>';
            return;
        }

        data.data.forEach(act => {
            const statusLabel = act.my_status === 1 ? '✅ 已入队' : (act.my_status === 0 ? '⏳ 审核中' : '');
            const scoreColor = act.match_score > 80 ? 'text-emerald-500' : (act.match_score > 60 ? 'text-amber-500' : 'text-stone-400');
            
            const displayTitle = act.category || act.nature;
            const teamTag = act.title ? `<span class="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black rounded-lg shadow-sm">🚩 队伍: ${act.title}</span>` : '';

            let slotsHtml = '';
            if (act.team_slots && act.team_slots.length > 0) {
                slotsHtml = '<div class="mt-4 mb-2 flex flex-wrap gap-2">';
                act.team_slots.forEach(slot => {
                    const displayName = `${slot.index + 1}号: ${slot.role}`;
                    if (slot.is_filled) {
                        slotsHtml += `<span class="px-2.5 py-1 bg-stone-50 border border-stone-200 text-stone-400 text-[10px] font-bold rounded-lg line-through" title="该岗位已满员">${displayName}</span>`;
                    } else {
                        slotsHtml += `<span class="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-lg shadow-sm">${displayName}</span>`;
                    }
                });
                slotsHtml += '</div>';
            }

            container.innerHTML += `
            <div class="card-warm rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 flex flex-col group relative overflow-hidden cursor-pointer" onclick="openActivityDetail(${act.id})">
                <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center">
                    <div class="text-center mt-2 mr-2">
                        <div class="text-[8px] font-black text-amber-600 uppercase">Match</div>
                        <div class="text-xl font-black ${scoreColor}">${act.match_score}%</div>
                    </div>
                </div>

                <div class="mb-4 flex flex-wrap gap-2 pr-16">
                    <span class="px-3 py-1 bg-stone-800 text-white text-[9px] font-black rounded-lg uppercase tracking-tighter shadow-sm">${act.nature}</span>
                    ${teamTag}
                </div>

                <h4 class="text-xl font-serif font-bold text-stone-800 mb-2 group-hover:text-amber-700 transition-colors">${displayTitle}</h4>
                <div class="text-[10px] font-bold text-stone-400 mb-3">${act.subject_direction || '综合大类'}</div>
                
                <p class="text-stone-500 text-sm italic line-clamp-2">“${act.description}”</p>

                ${slotsHtml}

                <div class="mt-auto pt-4 space-y-4">
                    <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-stone-400 border-t border-stone-100 pt-3">
                        <span>${act.path_text}</span>
                        <span class="${act.my_status === 1 ? 'text-emerald-500' : 'text-amber-500'}">${statusLabel}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex -space-x-2">
                            <div class="w-8 h-8 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-600">${act.publisher_name.charAt(0)}</div>
                        </div>
                        <div class="text-right">
                            <span class="text-lg font-black text-stone-800">${act.member_count}</span>
                            <span class="text-stone-300">/ ${act.total_capacity} 席</span> 
                        </div>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) {}
};

window.currentOpenedAct = null; 

window.openActivityDetail = async function(id) {
    const modal = document.getElementById('activityDetailModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.getElementById('det-title').innerText = "读取中...";
    document.getElementById('det-desc').innerText = "载入档案中...";

    try {
        const res = await fetch('/api/activity/my');
        const data = await res.json();
        let act = [...data.launched, ...data.joined].find(a => a.id === id);

        if (!act) {
            const listRes = await fetch('/api/activity/list');
            const listData = await listRes.json();
            act = listData.data.find(a => a.id === id);
        }

        if (!act) { 
            if(typeof Toast !== 'undefined') Toast.error("未找到项目信息"); 
            else alert("未找到项目信息");
            closeActivityDetail(); return; 
        }

        window.currentOpenedAct = act; 

        document.getElementById('det-title').innerText = act.category || act.nature;
        document.getElementById('det-nature').innerText = act.title ? `队伍名称: ${act.title}` : `(${act.nature})`;
        document.getElementById('det-desc').innerText = act.description;
        document.getElementById('det-publisher').innerText = act.publisher_name;
        
        const publisherEl = document.getElementById('det-publisher');
        if (publisherEl) {
            publisherEl.onclick = () => { if(window.openUserModal) window.openUserModal(act.publisher_id); };
        }
        document.getElementById('det-deadline').innerText = `招募截止：${act.deadline}`;
        document.getElementById('det-count').innerText = `${act.member_count}/${act.total_capacity}`;

        const isOwner = (act.publisher_id == (typeof State !== 'undefined' ? State.user.uid : null));
        
        let slotsHtml = '<div class="space-y-3 mt-4">';
        if (act.team_slots) {
            act.team_slots.forEach(slot => {
                const displayName = `${slot.index + 1}号岗位: [${slot.role}]`; 

                if (slot.is_filled && slot.member) {
                    // ✨ 新增：如果是队长，就渲染一个红色的“踢出”按钮
                    let kickBtnHtml = '';
                    if (isOwner) {
                        kickBtnHtml = `
                            <button onclick="kickMember(${act.id}, ${slot.member.uid}); event.stopPropagation();" class="ml-3 px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-xl hover:bg-red-500 hover:text-white transition shadow-sm border border-red-100 flex-shrink-0">
                                踢出
                            </button>
                        `;
                    }

                    slotsHtml += `
                        <div class="p-4 border border-emerald-200 bg-emerald-50/70 rounded-2xl flex justify-between items-center transition">
                            <div class="flex-1 pr-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-bold text-emerald-700">${displayName}</span>
                                    <span class="text-[9px] bg-emerald-200/50 px-2 py-0.5 rounded text-emerald-700 border border-emerald-200 font-bold uppercase tracking-widest">已入座</span>
                                </div>
                                <p class="text-xs text-stone-500 line-clamp-1">${slot.skill}</p>
                            </div>
                            <div class="flex items-center">
                                <div class="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-emerald-100 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition" onclick="if(window.openUserModal) window.openUserModal(${slot.member.uid}); event.stopPropagation();">
                                    <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm flex items-center justify-center font-bold">${slot.member.username.charAt(0)}</div>
                                    <div class="flex flex-col">
                                        <span class="text-xs font-bold text-stone-700">${slot.member.username}</span>
                                        <span class="text-[9px] text-stone-400">点击看名片</span>
                                    </div>
                                </div>
                                ${kickBtnHtml} </div>
                        </div>`;
                } else {
                    const canApply = (!isOwner && act.my_status === -1);
                    if (canApply) {
                        slotsHtml += `
                            <label class="block p-4 border border-stone-200 bg-white rounded-2xl cursor-pointer hover:border-amber-400 hover:shadow-md transition flex items-start gap-3">
                                <div class="pt-1">
                                    <input type="radio" name="apply_slot" value="${slot.index}" class="w-4 h-4 text-amber-500 focus:ring-amber-500">
                                </div>
                                <div class="flex-1">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="font-bold text-amber-700">${displayName}</span>
                                        <span class="text-[10px] bg-stone-100 px-2 py-0.5 rounded text-stone-500">${slot.major_required}</span>
                                    </div>
                                    <p class="text-xs text-stone-500">${slot.skill}</p>
                                </div>
                            </label>`;
                    } else {
                        slotsHtml += `
                            <div class="p-4 border border-stone-100 bg-stone-50 rounded-2xl flex items-start gap-3 opacity-70">
                                <div class="flex-1">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="font-bold text-stone-600">${displayName}</span>
                                        <span class="text-[10px] bg-stone-100 px-2 py-0.5 rounded text-stone-500">${slot.major_required}</span>
                                    </div>
                                    <p class="text-xs text-stone-500">${slot.skill}</p>
                                </div>
                                <span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">等待招募</span>
                            </div>`;
                    }
                }
            });
        }
        slotsHtml += '</div>';

        let slotsWrapper = document.getElementById('det-slots-wrapper');
        if (!slotsWrapper) {
            const descEl = document.getElementById('det-desc');
            if (descEl) {
                descEl.insertAdjacentHTML('afterend', `
                    <div class="mt-6 border-t border-stone-100 pt-6">
                        <h5 class="text-sm font-bold text-stone-800">👥 团队招募状态 (岗位一览)</h5>
                        <div id="det-slots-wrapper"></div>
                    </div>
                `);
            }
            slotsWrapper = document.getElementById('det-slots-wrapper');
        }
        if (slotsWrapper) slotsWrapper.innerHTML = slotsHtml;

        const auditSection = document.getElementById('admin-audit-section');
        const applySection = document.getElementById('apply-section');
        const btn = document.getElementById('det-action-btn');

        if(auditSection) auditSection.classList.add('hidden');
        if(applySection) applySection.classList.add('hidden');
        if(btn) {
            btn.classList.remove('hidden', 'bg-stone-100', 'text-stone-400', 'cursor-not-allowed', 'bg-emerald-50', 'text-emerald-600', 'bg-amber-50', 'text-amber-600');
            btn.disabled = false;
        }

        if (isOwner) {
            if(auditSection) auditSection.classList.remove('hidden');
            renderAuditList(act); 
            if(btn) {
                btn.innerText = "❌ 撤回并永久删除该招募";
                btn.type = "button";
                btn.className = "w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold hover:bg-red-100 transition-all shadow-sm shadow-red-100 mt-4";
                btn.onclick = () => handleCancelActivity(act.id);
            }
        } else if (act.my_status === 1) {
            if(btn) {
                btn.innerText = "🚶 退出该团队";
                btn.type = "button";
                btn.className = "w-full py-4 bg-stone-100 text-stone-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 transition-all mt-4";
                btn.onclick = () => handleQuitActivity(act.id);
            }
        } else if (act.my_status === 0) {
            if(btn) {
                btn.innerText = "⏳ 正在审核中 (点击取消申请)";
                btn.type = "button";
                btn.className = "w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 transition-all mt-4";
                btn.onclick = () => handleQuitActivity(act.id);
            }
        } else {
            if(applySection) applySection.classList.remove('hidden');
            if(btn) {
                btn.innerText = "🚀 选定岗位并发送申请";
                btn.type = "button";
                btn.className = "w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-xl shadow-stone-200 mt-4";
                btn.onclick = (e) => window.handleActivityAction(e);
            }
        }
    } catch (e) { console.error("加载详情异常:", e); }
};

window.renderAuditList = function(act) {
    const list = document.getElementById('det-audit-list');
    if(!list) return;
    list.innerHTML = '';
    
    if(!act.members) return;
    const pending = act.members.filter(m => m.status === 0);
    
    if (pending.length === 0) {
        list.innerHTML = '<p class="text-xs text-stone-400 text-center py-4">暂无待处理的入队申请</p>';
        return;
    }

    pending.forEach(m => {
        const slotIdx = m.applied_slot_index;
        const slotName = (slotIdx !== null && act.team_slots && act.team_slots[slotIdx]) 
            ? `${slotIdx + 1}号岗位 [${act.team_slots[slotIdx].role}]` : '未知岗位';
            
        list.innerHTML += `
        <div class="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 cursor-pointer hover:opacity-75 transition" onclick="if(window.openUserModal) window.openUserModal(${m.uid})">
                    <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-xs">${m.username.charAt(0)}</div>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-stone-800">${m.username}</span>
                        <span class="text-[10px] text-amber-600 font-bold">意向: ${slotName}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="auditMember(${act.id}, ${m.uid}, 1)" class="px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition shadow-md shadow-emerald-100">同意入队</button>
                    <button onclick="auditMember(${act.id}, ${m.uid}, 2)" class="px-4 py-1.5 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-lg hover:bg-red-50 hover:text-red-500 transition">婉拒</button>
                </div>
            </div>
            ${m.apply_msg ? `<div class="text-xs text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-100 italic">“${m.apply_msg}”</div>` : ''}
        </div>`;
    });
}

window.closeActivityDetail = () => {
    const modal = document.getElementById('activityDetailModal');
    if(modal) modal.classList.add('hidden');
};

window.handleActivityAction = async function(event) {
    if (event) event.preventDefault();

    const selectedSlot = document.querySelector('input[name="apply_slot"]:checked');
    if (!selectedSlot) {
        if (typeof Toast !== 'undefined') Toast.error("请先在上方列表中【点击勾选】你要申请的岗位！");
        else alert("⚠️ 请先在上方列表中【点击勾选】你想申请的岗位！");
        return;
    }
    
    const msgElement = document.getElementById('apply-msg');
    const msg = msgElement ? msgElement.value : '';
    
    const btn = document.getElementById('det-action-btn');
    const originalText = btn ? btn.innerText : '提交';
    if(btn) {
        btn.innerText = "🚀 正在发送...";
        btn.disabled = true;
    }

    try {
        const res = await fetch('/api/activity/join', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ activity_id: window.currentOpenedAct.id, apply_msg: msg, slot_index: parseInt(selectedSlot.value) })
        });
        const data = await res.json();
        
        if(data.status === 'success') {
            if (typeof Toast !== 'undefined') Toast.success(data.message);
            else alert("✅ " + data.message);
            closeActivityDetail();
            loadActivityHall();
        } else { 
            if (typeof Toast !== 'undefined') Toast.error(data.message);
            else alert("❌ " + data.message);
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    } catch(e) {
        alert("❌ 无法连接到服务器，详细错误:\n" + e.message);
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
};

window.auditMember = async function(actId, uid, status, newSlot = null) {
    try {
        const payload = { activity_id: actId, target_uid: uid, status: status };
        if (newSlot !== null) payload.new_slot_index = newSlot;

        const res = await fetch('/api/activity/audit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();

        if (data.status === 'conflict') {
            openReassignModal(actId, uid);
        } else if (data.status === 'success') {
            if(typeof Toast !== 'undefined') Toast.success("审批完成");
            closeReassignModal();
            openActivityDetail(actId); 
            loadManagement();
            loadActivityHall(); 
        } else {
            if(typeof Toast !== 'undefined') Toast.error(data.message);
            else alert(data.message);
        }
    } catch(e) {}
}
// ✨ 新增：队长踢人逻辑
window.kickMember = function(actId, uid) {
    if (!confirm("⚠️ 确定要将该成员移出队伍吗？\n移出后，此岗位将重新空缺，且双方都将收到系统通知。")) return;

    // 直接复用审批接口，传状态码 2 (拒绝/踢出)
    // 后端识别到他原本是队员，会自动走踢人发短信的逻辑，并释放坑位
    auditMember(actId, uid, 2);
};
window.openReassignModal = function(actId, uid) {
    const modal = document.getElementById('reassignSlotModal');
    if(!modal) return;
    
    // ✨ 核心修复：把这个弹窗强行移到网页的最外层（body），彻底脱离原有的图层限制！
    if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }
    modal.style.zIndex = "999999";

    const select = document.getElementById('reassign-slot-select');
    const btn = document.getElementById('confirm-reassign-btn');
    if(select) select.innerHTML = '';
    
    const act = window.currentOpenedAct;
    if(!act || !act.team_slots) return;
    
    let hasEmpty = false;
    act.team_slots.forEach(slot => {
        if (!slot.is_filled) {
            hasEmpty = true;
            if(select) select.innerHTML += `<option value="${slot.index}">${slot.index + 1}号岗位 [${slot.role}]</option>`;
        }
    });

    if(btn) {
        if (!hasEmpty) {
            if(select) select.innerHTML = '<option value="">(队伍已满，无空缺岗位可分配)</option>';
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        btn.onclick = function() {
            if (!hasEmpty) return;
            const newSlot = parseInt(select.value);
            auditMember(actId, uid, 1, newSlot);
        };
    }

    modal.style.display = 'flex';
};

window.closeReassignModal = function() {
    const modal = document.getElementById('reassignSlotModal');
    if (modal) modal.style.display = 'none';
}

window.handleCancelActivity = async function(actId) {
    if (!confirm("⚠️ 确定要彻底删除这个招募项目吗？\n删除后不可恢复。")) return;
    try {
        const res = await fetch('/api/activity/delete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ activity_id: actId }) });
        const data = await res.json();
        if (data.status === 'success') {
            if(typeof Toast !== 'undefined') Toast.success("项目已撤回");
            closeActivityDetail();
            loadActivityHall();
            loadManagement();
        }
    } catch (e) {}
};

window.handleQuitActivity = async function(actId) {
    if (!confirm("确定要退出该项目或取消你的加入申请吗？")) return;
    try {
        const res = await fetch('/api/activity/quit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ activity_id: actId }) });
        const data = await res.json();
        if (data.status === 'success') {
            if(typeof Toast !== 'undefined') Toast.success("已成功退出");
            closeActivityDetail();
            loadActivityHall();
            loadManagement();
        }
    } catch (e) {}
};

window.loadManagement = async function() {
    const launchedContainer = document.getElementById('manage-my-launched');
    const joinedContainer = document.getElementById('manage-my-joined');
    if (!launchedContainer || !joinedContainer) return;

    try {
        const res = await fetch('/api/activity/my');
        const data = await res.json();

        launchedContainer.innerHTML = '';
        if (data.launched.length === 0) { launchedContainer.innerHTML = '<div class="col-span-full py-10 text-center text-stone-300 border-2 border-dashed border-stone-100 rounded-[2rem]">你还没有发起过任何项目</div>'; }
        data.launched.forEach(act => {
            const pendingCount = act.members ? act.members.filter(m => m.status === 0).length : 0;
            launchedContainer.innerHTML += `
            <div class="card-warm p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group" onclick="openActivityDetail(${act.id})">
                <div class="flex justify-between items-start mb-4">
                    <h5 class="font-bold text-stone-800 group-hover:text-amber-700 transition">${act.category || act.nature}</h5>
                    ${pendingCount > 0 ? `<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">${pendingCount}人待审批</span>` : ''}
                </div>
                <div class="text-xs text-stone-500 mb-3">${act.title ? `队伍: ${act.title}` : '未命名团队'}</div>
                <div class="flex items-center justify-between">
                    <span class="text-[10px] text-stone-400 font-bold uppercase tracking-widest">点击进入管理面板 ➔</span>
                </div>
            </div>`;
        });

        joinedContainer.innerHTML = '';
        if (data.joined.length === 0) { joinedContainer.innerHTML = '<div class="col-span-full py-10 text-center text-stone-300 border-2 border-dashed border-stone-100 rounded-[2rem]">你还没有加入任何项目</div>'; }
        data.joined.forEach(act => {
            const statusMap = { 0: '审核中', 1: '已入队', 2: '被拒绝' };
            const statusColor = act.my_status === 1 ? 'text-emerald-500' : (act.my_status === 2 ? 'text-red-400' : 'text-amber-500');
            joinedContainer.innerHTML += `
            <div class="card-warm p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex justify-between items-center" onclick="openActivityDetail(${act.id})">
                <div>
                    <h5 class="font-bold text-stone-800 group-hover:text-amber-700 transition">${act.category || act.nature}</h5>
                    <p class="text-[10px] text-stone-400 mt-1 uppercase font-bold">队伍: ${act.title || '无'}</p>
                </div>
                <span class="text-xs font-bold ${statusColor}">${statusMap[act.my_status]}</span>
            </div>`;
        });
    } catch(e) { }
}
// END OF FILE