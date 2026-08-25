/**
 * 实验室数据接口定义与配置
 *
 * 存放所有实验室的展示信息，供 <uem-labs> 组件消费
 */

/** 单个实验室的数据结构 */
export interface LabItem {
  /** 实验室名称 */
  name: string;
  /** 实验室英文简称 / 代号 */
  code: string;
  /** 研究方向简述 */
  description: string;
  /** 指导教师（可选） */
  advisor?: string;
  /** 教授（可选，支持数组或单个字符串） */
  readonly professors?: string | readonly string[];
  /** 所属学院 / 系所 */
  department: string;
  /** 主要研究关键词标签 */
  tags: readonly string[];
  /** Material Symbols 图标名称 */
  icon: string;
  /** 外部链接（可选） */
  href?: string;
}

/** 实验室候选数据列表 */
export const LAB_ITEMS: readonly LabItem[] = [
  {
    name: '物联网实验室（AKA 数字孪生暨虚拟现实实验室）',
    code: 'IoT-Lab',
    description:
      '开展物联网架构、嵌入式硬件开发与实时数据采集研究，结合数字孪生与虚拟现实技术实现物理世界的数字化映射。',
    department: '计算机科学与工程学院',
    professors: ['陈超'],
    tags: ['物联网', '数字孪生', '虚拟现实', '嵌入式'],
    icon: 'sensors',
    href: 'https://uem-stu.github.io/IOT-lab-web/',
  },
  {
    name: '河北省安全生产与应急处置特种机器人重点实验室',
    code: 'SER-Lab',
    description:
      '致力于应急救援、特种作业机器人的研发，开展智能环境感知、鲁棒控制及人机协作技术等关键课题攻关。',
    department: '应急管理学院',
    tags: ['特种机器人', '应急处置', '智能控制', '环境感知'],
    icon: 'precision_manufacturing',
  },
  {
    name: 'ArkLab方舟实验室',
    code: 'Ark-Lab',
    description:
      '专注于学生技术创新与工程实践，覆盖全栈软件开发、算法研究及软硬件协同设计，培养核心技术人才。',
    department: '电子信息工程学院',
    tags: ['软件工程', '算法设计', '技术创新', '全栈开发'],
    icon: 'sailing',
  },
  {
    name: '利刃网安攻防实验室',
    code: 'Blade-Sec-Lab',
    description:
      '聚焦于网络空间安全，开展渗透测试、漏洞挖掘、红蓝对抗以及安全防御体系建设等核心攻防技术研究。',
    department: '计算机科学与工程学院',
    tags: ['网络安全', '漏洞挖掘', '红蓝对抗', '渗透测试'],
    icon: 'shield_lock',
  },
] as const;
