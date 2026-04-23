import type { OnboardingTutorial } from '../store/useOnboardingStore';

export const INITIAL_SETUP_TUTORIAL: OnboardingTutorial = {
  id: 'initial_setup',
  steps: [
    {
      id: 'welcome',
      title: '你好呀！欢迎加入！',
      content: '欢迎来到 Odysseia Forum！我是这里的看板娘类脑娘。看起来你是第一次来呢，需要我带你快速熟悉一下社区的功能吗？',
      emotion: 'hi',
      placement: 'center',
    },
    {
      id: 'sidebar',
      target: '.od-sidebar-nav',
      title: '这里是导航区',
      content: '你可以通过侧边栏快速切换广场、书单或者是查看自己的个人主页。试试看，以后这里就是你的主舞台啦！',
      emotion: 'success',
      placement: 'right',
    },
    {
      id: 'topbar',
      target: '.od-topbar-actions',
      title: '功能都在这儿',
      content: '搜索你想看的内容，或者查看系统发出的最新动态。别忘了常来看看通知中心哦，说不定会有小惊喜！',
      emotion: 'letsgo',
      placement: 'bottom',
    },
    {
      id: 'settings_hint',
      target: '[data-tour="sidebar-settings"]',
      title: '最重要的配置',
      content: '为了保证你能正常打开 Discord 帖子，请一定要配置好「跳转方式」。跟我去偏好设置页面看看吧？',
      emotion: 'pride',
      placement: 'right',
    }
  ]
};

export const SETTINGS_GUIDE_TUTORIAL: OnboardingTutorial = {
  id: 'settings_guide',
  steps: [
    {
      id: 'open_mode',
      target: '[data-tour="open-mode-setting"]',
      title: '选择你的打开方式',
      content: '你可以设置点击帖子时是直接进入详情，还是开启侧边预览模式。找到最适合你的节奏！',
      emotion: 'hi',
      placement: 'bottom',
    },
    {
      id: 'atmosphere',
      target: '[data-tour="atmosphere-settings"]',
      title: '定制社区氛围',
      content: '在这里你可以开启背景图、调节透明度和毛玻璃效果。让社区界面更符合你的审美！',
      emotion: 'sparkles',
      placement: 'bottom',
    },
    {
      id: 'atmosphere_preview',
      target: '[data-tour="atmosphere-preview"]',
      title: '即时效果预览',
      content: '所有的调整都会在这里实时显示。你可以一边调参一边看效果，直到满意为止哦！',
      emotion: 'searching',
      placement: 'bottom',
    },
    {
      id: 'finish',
      title: '配置完成！',
      content: '好啦，基础的配置就到这里。你可以继续探索，有任何需要记得随时召唤我哦！',
      emotion: 'success',
      placement: 'center',
    }
  ]
};

export const ME_GUIDE_TUTORIAL: OnboardingTutorial = {
  id: 'me_guide',
  steps: [
    {
      id: 'user_info',
      target: '[data-tour="user-header"]',
      title: '你的个人主页',
      content: '这里展示了你的 ID 和基本信息。点击头像可以快速复制自己的个人主页链接分享给朋友哦！',
      emotion: 'hi',
      placement: 'bottom',
    },
    {
      id: 'user_stats',
      target: '[data-tour="user-stats"]',
      title: '成就不止于此',
      content: '你的发帖量、获赞数和回复数都在这里一目了然。每一次互动都是在社区留下的足迹呢！',
      emotion: 'success',
      placement: 'bottom',
    },
    {
      id: 'me_preferences_tab',
      target: '[data-tour="me-tab-preferences"]',
      title: '最重要的偏好设置',
      content: '在这里你可以设置你感兴趣的频道、想要包含或排除的标签。配置好后，整个社区都会变成你喜欢的样子！',
      emotion: 'pride',
      placement: 'bottom',
    }
  ]
};

export const SEARCH_GUIDE_TUTORIAL: OnboardingTutorial = {
  id: 'search_guide',
  steps: [
    {
      id: 'search_header',
      target: '[data-tour="search-header"]',
      title: '探索无限可能',
      content: '在这里你可以看到当前的搜索关键词和找到的结果总数。我们会尽可能准确地帮你匹配内容。',
      emotion: 'searching',
      placement: 'bottom',
    },
    {
      id: 'search_type',
      target: '[data-tour="search-type-toggle"]',
      title: '灵活切换分类',
      content: '你可以随时在「帖子」和「书单」之间切换。如果搜不到帖子，说不定在书单里有意外发现呢！',
      emotion: 'hi2',
      placement: 'bottom',
    },
    {
      id: 'open_filters',
      target: '[data-tour="search-filters-btn"]',
      title: '还没找到想要的？',
      content: '点击这里的筛选图标，可以展开高级面板，按作者、标签或时间进行更精准的定位哦！',
      emotion: 'letsgo',
      placement: 'bottom',
    }
  ]
};

export const ADVANCED_SEARCH_GUIDE_TUTORIAL: OnboardingTutorial = {
  id: 'advanced_search_guide',
  steps: [
    {
      id: 'filter_panel',
      target: '[data-tour="filter-panel"]',
      title: '高级筛选面板',
      content: '欢迎来到进阶搜索！在这里你可以组合复杂的过滤条件。比如“必须包含 A 标签但不包含 B 标签”。',
      emotion: 'searching',
      placement: 'left',
    },
    {
      id: 'filter_logic',
      target: '[data-tour="filter-logic"]',
      title: '逻辑开关',
      content: '选择标签逻辑是「且」还是「或」。这在处理多个标签时非常有用，试试不同的组合吧！',
      emotion: 'pride',
      placement: 'bottom',
    }
  ]
};
