/**
 * 开源项目数据接口定义
 */
export interface ProjectItem {
  name: string;
  description: string;
  languages: readonly string[];
  stars: number;
  color: string;
  href: string;
}

/** 优秀开源项目候选数据列表 */
export const PROJECT_ITEMS: readonly ProjectItem[] = [
  {
    name: 'EmergencyTeleoperatedRobotSystem-Jetson',
    description: '应急遥操作机器人系统 Jetson 端：机器人主控核心，负责为客户端提供三维场景重建与目标检测功能，以及接收和处理来自客户端的控制指令。',
    languages: ['C++', 'Python'],
    stars: 48,
    color: '#3572A5',
    href: 'https://github.com/UEM-Stu/EmergencyTeleoperatedRobotSystem-Jetson'
  },
  {
    name: 'EmergencyTeleoperatedRobotSystem-Unity',
    description: '应急遥操作机器人系统 Unity 端：机器人控制客户端，基于 MRTK 框架并面向 HoloLens 2 平台开发，提供 3D 虚拟孪生、遥操作与三维现场呈现。',
    languages: ['C#'],
    stars: 62,
    color: '#178600',
    href: 'https://github.com/UEM-Stu/EmergencyTeleoperatedRobotSystem-Unity'
  },
  {
    name: 'skills',
    description: '校园相关 Agent Skills。',
    languages: ['Markdown'],
    stars: 128,
    color: '#083fa6',
    href: 'https://github.com/UEM-Stu/skills'
  },
  {
    name: 'UEM-Stu-Site',
    description: 'UEM-Stu 官网源码。',
    languages: ['TypeScript', 'HTML', 'CSS'],
    stars: 35,
    color: '#3178c6',
    href: 'https://github.com/UEM-Stu/UEM-Stu-Site'
  },
  {
    name: 'UEM-Stu-Blog',
    description: 'UEM-Stu 技术博客的内容仓库，包含所有的文章 Markdown 源文件与相关静态资源，欢迎你的投稿。',
    languages: ['Markdown'],
    stars: 28,
    color: '#083fa6',
    href: 'https://github.com/UEM-Stu/UEM-Stu-Blog'
  },
  {
    name: 'CUEDC-2024-Drone-code',
    description: '2024 年全国大学生电子设计竞赛无人机赛题方案。基于 Fast-LIO 激光 SLAM 实现室内自主定位，融合 PX4 飞控、STM32 下位机路径规划 与 OpenMV 视觉识别，完成自主航点飞行与目标检测任务。',
    languages: ['C'],
    stars: 56,
    color: '#555555',
    href: 'https://github.com/UEM-Stu/CUEDC-2024-Drone-code'
  },
  {
    name: 'IOT-lab-web',
    description: '物联网实验室实验室门户站点，基于 Next.js + Tailwind 的纯前端实验室站点，包含新生导览、毕业路径文章与项目索引。',
    languages: ['TypeScript', 'CSS', 'JavaScript'],
    stars: 0,
    color: '#3178c6',
    href: 'https://github.com/UEM-Stu/IOT-lab-web'
  }
] as const;
