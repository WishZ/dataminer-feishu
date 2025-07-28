import React from 'react';

export type ExtractType = 'homepage' | 'comments' | 'details';

interface ExtractTypeSelectorProps {
  value: ExtractType;
  onChange: (value: ExtractType) => void;
}

// 从各个组件的配置中获取数据 - 统一管理支持平台信息
const getExtractTypeConfigs = () => {
  return [
    {
      id: 'homepage' as ExtractType,
      title: '主页提取',
      // 与 HomepageExtract 组件的 config.supportPlatforms 保持一致
      platforms: ['抖音', '小红书', 'TikTok', 'YouTube'],
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: 'comments' as ExtractType,
      title: '评论提取',
      // 与 CommentsExtract 组件的 config.supportPlatforms 保持一致
      platforms: ['抖音', '快手'],
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'details' as ExtractType,
      title: '详情提取',
      // 与 DetailsExtract 组件的 config.supportPlatforms 保持一致
      platforms: ['抖音', '快手', 'TikTok', 'YouTube'],
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];
};

const ExtractTypeSelector: React.FC<ExtractTypeSelectorProps> = ({ value, onChange }) => {
  const types = getExtractTypeConfigs();

  // 获取当前选中类型的支持平台
  const currentType = types.find(type => type.id === value);
  const supportedPlatforms = currentType?.platforms || [];

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        数据提取类型 <span className="text-red-500">*</span>
      </label>
      <div className="flex space-x-2">
        {types.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type.id)}
            className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
              value === type.id
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className={`mb-1 ${value === type.id ? 'text-indigo-500' : 'text-gray-400'}`}>
              {type.icon}
            </div>
            <span className="text-xs font-medium text-center leading-tight">
              {type.title}
            </span>
          </button>
        ))}
      </div>

      {/* 平台支持提示 */}
      {supportedPlatforms.length > 0 && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-slate-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">
                支持平台
              </p>
              <div className="flex flex-wrap gap-1">
                {supportedPlatforms.map((platform: string) => (
                  <span
                    key={platform}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractTypeSelector;
