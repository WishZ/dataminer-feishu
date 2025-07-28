import React from 'react';
import ExtractTypeBase, { ExtractTypeProps } from './ExtractTypeBase';

const HomepageExtract: React.FC<ExtractTypeProps> = (props) => {
  const config = {
    id: 'homepage',
    title: '主页批量提取',
    description: '提取博主主页的内容数据',
    icon: (
      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    supportPlatforms: ['抖音', '小红书', 'TikTok', 'YouTube'],
    formList: [
      {
        type: 'url' as const,
        name: 'url',
        label: '博主主页链接',
        tooltip: '仅支持博主主页链接，其他链接不支持',
        placeholder: 'https://example.com/user/homepage',
        required: true,
      },
      {
        type: 'quickButtons' as const,
        name: 'range_type',
        label: '数据获取范围（页数）',
        tooltip: '小红书50积分/页，其他平台10积分/页',
        required: true,
        options: [
          { label: '全量', value: 'all' },
          { label: '5页', value: 5 },
          { label: '10页', value: 10 },
          { label: '自定义', value: 'custom' },
        ],
        max: 100,
        targetField: 'range', // 指定要设置的目标字段
      },
      {
        type: 'number' as const,
        name: 'range',
        label: '自定义页数',
        tooltip: '小红书50积分/页，其他平台10积分/页',
        suffix: '页',
        min: 1,
        max: 100,
        required: true,
        showWhen: (formData: any) => formData.range_type === 'custom',
      },
      {
        type: 'date' as const,
        name: 'startDate',
        label: '数据获取时间范围',
        required: false,
        options: [
          { label: '最近一周', value: '7' },
          { label: '最近一个月', value: '30' },
          { label: '最近三个月', value: '90' },
        ],
      },
    ],
  };

  return <ExtractTypeBase {...props} config={config} />;
};

export default HomepageExtract;
