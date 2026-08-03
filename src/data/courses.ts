// 课程中心统一配置 —— 9 门课的学习地图 + 练习引擎
// ⚠️ title 必须与笔记表 notes.course 字段完全一致，课程中心的「讲义」才能自动关联。
// 练习引擎类型：pyodide（浏览器跑 Python，已有）/ sqlite（SQL，规划中）/ quiz（测验，规划中）

export type CourseCategory = '专业核心' | '编程与数据' | '工程与架构';
export type PracticeEngine = 'pyodide' | 'sqlite' | 'quiz';

export interface Practice {
  engine: PracticeEngine;
  /** 已上线练习页路由（如 /python） */
  path?: string;
  /** 考试/测验模式路由（如 /python/exam），可选 */
  examPath?: string;
  /** 考试模式按钮文案 */
  examLabel?: string;
  /** 引擎一句话说明 */
  label?: string;
  /** localStorage 进度键（可选的进度统计） */
  progressKey?: string;
  /** true = 引擎规划中，未上线 */
  planned?: boolean;
}

export interface Course {
  slug: string;
  title: string;
  category: CourseCategory;
  color: string;
  glow: string;
  emoji: string;
  summary: string;
  practice?: Practice;
  /** 课程地图：模块清单 */
  modules?: { no: string; name: string }[];
}

export const COURSES: Course[] = [
  {
    slug: 'python', title: 'Python程序设计', category: '编程与数据',
    color: '#2dd4bf', glow: 'rgba(45,212,191,0.12)', emoji: '🐍',
    summary: 'Python 语法与程序设计：变量、流程控制、函数、类与对象、文件与异常，配套浏览器内判分练习（151 题）',
    practice: { engine: 'pyodide', path: '/python', label: '浏览器实操判分', progressKey: 'python-progress', examPath: '/python/exam', examLabel: '模拟考试' },
    modules: [
      { no: '01', name: '基础语法' }, { no: '02', name: '流程控制' }, { no: '03', name: '字符串' },
      { no: '04', name: '组合数据类型' }, { no: '05', name: '函数' }, { no: '06', name: '文件与异常' },
      { no: '07', name: '类与对象' }, { no: '08', name: '常用模块' }, { no: '09', name: '算法思维' },
      { no: '10', name: '爬虫与数据分析' },
    ],
  },
  {
    slug: 'network', title: '计算机网络', category: '专业核心',
    color: '#4cc9f0', glow: 'rgba(76,201,240,0.12)', emoji: '🌐',
    summary: '网络体系结构、TCP/IP 协议栈、传输层与网络层、路由与交换',
    practice: { engine: 'quiz', path: '/quiz/network', label: '知识点测验', progressKey: 'network-quiz-progress' },
    modules: [
      { no: '01', name: '网络体系结构' }, { no: '02', name: '物理层' }, { no: '03', name: '数据链路层' },
      { no: '04', name: '网络层（IP 与路由）' }, { no: '05', name: '传输层' }, { no: '06', name: '应用层' },
      { no: '07', name: '网络安全' }, { no: '08', name: '无线与移动网络' }, { no: '09', name: '网络编程（socket）' },
      { no: '10', name: '综合复习与术语表' },
    ],
  },
  {
    slug: 'algorithm', title: '算法设计与分析', category: '专业核心',
    color: '#f472b6', glow: 'rgba(244,114,182,0.12)', emoji: '🧩',
    summary: '算法复杂度分析、分治、贪心、动态规划与图算法',
    practice: { engine: 'quiz', path: '/quiz/algorithm', label: '例题测验', progressKey: 'algorithm-quiz-progress' },
    modules: [
      { no: '01', name: '算法基础与复杂度' }, { no: '02', name: '递归与分治' }, { no: '03', name: '排序算法' },
      { no: '04', name: '贪心算法' }, { no: '05', name: '动态规划' }, { no: '06', name: '回溯与分支限界' },
      { no: '07', name: '图算法' }, { no: '08', name: '最短路径与最小生成树' }, { no: '09', name: '查找与字符串算法' },
      { no: '10', name: '综合复习与术语表' },
    ],
  },
  {
    slug: 'advanced-db', title: '高级数据库', category: '编程与数据',
    color: '#a3e635', glow: 'rgba(163,230,53,0.12)', emoji: '🗄️',
    summary: 'SQL 语言、事务与并发控制、索引与查询优化、数据库设计，配套浏览器内 SQL 判分练习（20 题）',
    practice: { engine: 'pyodide', path: '/advanced-db', label: '浏览器 SQL 实操', progressKey: 'advanced-db-progress' },
    modules: [
      { no: '01', name: 'SQL 基础' }, { no: '02', name: '高级查询' }, { no: '03', name: '多表查询' },
      { no: '04', name: '增删改' }, { no: '05', name: '约束与事务' }, { no: '06', name: '综合实战' },
    ],
  },
  {
    slug: 'java-web', title: 'Java Web 后端', category: '编程与数据',
    color: '#fb923c', glow: 'rgba(251,146,60,0.12)', emoji: '☕',
    summary: 'Java Web 开发：Servlet、HTTP 请求处理、前后端接口与常用框架，配套知识点测验',
    practice: { engine: 'quiz', path: '/quiz/java-web', label: '知识点测验', progressKey: 'java-web-quiz-progress' },
    modules: [
      { no: '01', name: 'Web 基础' }, { no: '02', name: 'HTTP 详解' }, { no: '03', name: 'Servlet 基础' },
      { no: '04', name: '会话与状态' }, { no: '05', name: '前后端接口' }, { no: '06', name: '框架入门' },
      { no: '07', name: '综合复习' },
    ],
  },
  {
    slug: 'software-eng', title: '软件工程', category: '工程与架构',
    color: '#a78bfa', glow: 'rgba(167,139,250,0.12)', emoji: '🧱',
    summary: '软件过程模型、需求工程、软件设计与测试、项目管理',
  },
  {
    slug: 'software-design', title: '软件设计与体系结构', category: '工程与架构',
    color: '#94a3b8', glow: 'rgba(148,163,184,0.12)', emoji: '🏗️',
    summary: '设计模式与软件体系结构风格、组件化系统设计',
  },
  {
    slug: 'docker', title: 'Docker 云容器', category: '工程与架构',
    color: '#38bdf8', glow: 'rgba(56,189,248,0.12)', emoji: '🐳',
    summary: '容器与镜像、Docker 常用命令与容器化部署',
  },
  {
    slug: 'mvvm', title: 'MVVM 前端', category: '工程与架构',
    color: '#e879f9', glow: 'rgba(232,121,249,0.12)', emoji: '🖥️',
    summary: '前端基础与 MVVM 架构模式、数据绑定与组件化开发',
  },
];

export const COURSE_COLORS: Record<string, string> = Object.fromEntries(
  COURSES.map((c) => [c.title, c.color])
);
export const COURSE_GLOWS: Record<string, string> = Object.fromEntries(
  COURSES.map((c) => [c.title, c.glow])
);

export const courseBySlug = (slug: string) => COURSES.find((c) => c.slug === slug);
