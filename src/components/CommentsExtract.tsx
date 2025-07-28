import React from 'react';
import ExtractTypeBase, { ExtractTypeProps } from './ExtractTypeBase';

const CommentsExtract: React.FC<ExtractTypeProps> = (props) => {
  const config = {
    id: 'comments',
    title: '评论批量提取',
    description: '提取指定内容的评论数据',
    icon: (
      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    supportPlatforms: ['抖音', '快手'],
    formList: [
      {
        type: 'url' as const,
        name: 'url',
        label: '详情页面链接',
        placeholder: 'https://example.com/post/details',
        required: true,
      },
      {
        type: 'number' as const,
        name: 'range',
        label: '评论获取范围（页数）',
        tooltip: '每页5积分，实际扣费会按照获取的页数计算',
        suffix: '页',
        min: 1,
        max: 50,
        required: true,
      },
      {
        type: 'checkbox' as const,
        name: 'includeReplies',
        label: '包含回复',
        tooltip: '是否提取评论的回复内容',
        defaultValue: false,
      },
    ],
  };

  return <ExtractTypeBase {...props} config={config} />;
};

export default CommentsExtract;
